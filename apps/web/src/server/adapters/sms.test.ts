import { describe, expect, it, vi } from "vitest";

const created: unknown[] = [];
vi.mock("@sa/db", () => ({ prisma: { notificationLog: { create: vi.fn(async (a: { data: unknown }) => created.push(a.data)) } } }));
vi.mock("../env", () => ({ env: () => ({ NODE_ENV: "test" }) }));

const { HttpSmsAdapter, TwilioSmsAdapter, WhatsAppCloudAdapter } = await import("./sms");

const msg = { to: "+970599100001", template: "otp", locale: "ar" as const, text: "رمز الدخول: 482913" };

describe("message adapters", () => {
  it("sends SMS over HTTP and masks OTP codes in the log", async () => {
    const http = vi.fn(async (_u: string, _i?: RequestInit) => new Response("{}", { status: 200 }));
    await new HttpSmsAdapter({ url: "https://sms.example/send", apiKey: "K", sender: "SA" }, http as unknown as typeof fetch).send(msg);
    expect(http.mock.calls[0]![0]).toBe("https://sms.example/send");
    expect(JSON.parse(String(http.mock.calls[0]![1]!.body))).toEqual({ to: "+970599100001", from: "SA", text: msg.text });
    expect(JSON.stringify(created.at(-1))).not.toContain("482913");
    expect(created.at(-1)).toMatchObject({ status: "SENT", provider: "http" });
  });

  it("fails loudly only for OTP messages", async () => {
    const down = vi.fn(async () => new Response("", { status: 500 }));
    const a = new HttpSmsAdapter({ url: "https://sms.example", apiKey: "K", sender: "SA" }, down as unknown as typeof fetch);
    await expect(a.send(msg)).rejects.toThrow(/delivery failed/);
    await expect(a.send({ ...msg, template: "order.confirmed", text: "ok" })).resolves.toBeUndefined();
    expect(created.at(-1)).toMatchObject({ status: "FAILED" });
  });

  it("sends SMS through Twilio with basic auth and form body", async () => {
    const http = vi.fn(async (_u: string, _i?: RequestInit) => new Response("{}", { status: 201 }));
    await new TwilioSmsAdapter({ accountSid: "AC123", authToken: "tok", from: "SholaJanoub" }, http as unknown as typeof fetch).send(msg);
    const [url, init] = http.mock.calls[0]!;
    expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json");
    expect((init!.headers as Record<string, string>).authorization).toBe(`Basic ${Buffer.from("AC123:tok").toString("base64")}`);
    const body = new URLSearchParams(String(init!.body));
    expect(body.get("To")).toBe("+970599100001");
    expect(body.get("From")).toBe("SholaJanoub");
    expect(body.get("Body")).toBe(msg.text);
    expect(created.at(-1)).toMatchObject({ status: "SENT", provider: "twilio" });
    // Messaging-Service statt Absender
    await new TwilioSmsAdapter({ accountSid: "AC123", authToken: "tok", from: "MG999" }, http as unknown as typeof fetch).send(msg);
    expect(new URLSearchParams(String(http.mock.calls[1]![1]!.body)).get("MessagingServiceSid")).toBe("MG999");
  });

  it("reports Twilio error codes", async () => {
    const http = vi.fn(async () => new Response(JSON.stringify({ code: 21408, message: "Permission to send an SMS has not been enabled for the region" }), { status: 400 }));
    await expect(new TwilioSmsAdapter({ accountSid: "AC1", authToken: "t", from: "+15550001" }, http as unknown as typeof fetch).send(msg)).rejects.toThrow(/21408/);
  });

  it("posts WhatsApp Cloud API text messages", async () => {
    const http = vi.fn(async (_u: string, _i?: RequestInit) => new Response("{}", { status: 200 }));
    await new WhatsAppCloudAdapter({ apiUrl: "https://graph.facebook.com/v21.0", phoneNumberId: "123", token: "T" }, http as unknown as typeof fetch).send({ ...msg, template: "order.placed", text: "طلبك SO-1" });
    expect(http.mock.calls[0]![0]).toBe("https://graph.facebook.com/v21.0/123/messages");
    expect(JSON.parse(String(http.mock.calls[0]![1]!.body))).toMatchObject({ messaging_product: "whatsapp", to: "970599100001", type: "text", text: { body: "طلبك SO-1" } });
  });
});
