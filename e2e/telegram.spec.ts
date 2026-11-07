import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { OWNER, customerLogin, db, placeCodOrder, staffLogin } from "./helpers";

/**
 * Telegram-Benachrichtigungen gegen einen Test-Server statt api.telegram.org
 * (TELEGRAM_API_URL=http://127.0.0.1:4599 in der lokalen .env).
 */
const sent: { chat_id: string; text: string }[] = [];
// Nur mit lokalem Test-Server (nie gegen das echte Telegram)
test.skip(!process.env.TELEGRAM_API_URL?.startsWith("http://127.0.0.1:4599"), "TELEGRAM_API_URL=http://127.0.0.1:4599 in .env setzen");
let server: Server;

test.beforeAll(async () => {
  await db.setting.deleteMany({ where: { key: "notify.telegram" } });
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const method = req.url?.split("/").pop();
      const json = body ? JSON.parse(body) : {};
      const reply = (result: unknown) => {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ ok: true, result }));
      };
      if (method === "getMe") return reply({ id: 1, is_bot: true, username: "sholat_test_bot" });
      if (method === "getUpdates") return reply([{ update_id: 1, message: { chat: { id: -1001234, title: "فريق الطلبات", type: "group" } } }]);
      if (method === "sendMessage") {
        sent.push({ chat_id: String(json.chat_id), text: String(json.text) });
        return reply({ message_id: sent.length });
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ ok: false, description: "not found" }));
    });
  });
  await new Promise<void>((r) => server.listen(4599, "127.0.0.1", () => r()));
});

test.afterAll(async () => {
  await db.setting.deleteMany({ where: { key: "notify.telegram" } });
  await new Promise<void>((r) => server.close(() => r()));
  await db.$disconnect();
});

test("telegram: connect bot, pick the group, test message, and a new order is announced", async ({ page, browser }) => {
  await staffLogin(page, OWNER.phone, OWNER.password);
  await page.goto("/ar/admin/settings/notifications");
  await page.getByTestId("telegram-token").fill("123456789:AAtesttokenABCDEFGHIJKLMNOPQRS");
  await page.getByTestId("telegram-connect").click();
  await expect(page.getByTestId("telegram-connected")).toContainText("sholat_test_bot");

  await page.getByTestId("telegram-discover").click();
  await page.getByTestId("telegram-add").click();
  await expect(page.getByTestId("telegram-chats")).toContainText("فريق الطلبات");

  await page.getByTestId("telegram-test").click();
  await expect.poll(() => sent.filter((m) => m.chat_id === "-1001234").length).toBeGreaterThan(0);

  // neue Bestellung → Nachricht an die Gruppe
  const shop = await browser.newPage();
  await customerLogin(shop, { local: "0599100001", e164: "+970599100001" });
  const orderId = await placeCodOrder(shop.request, "+970599100001", "BA-001", 3);
  const { number } = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  await expect.poll(() => sent.find((m) => m.text.includes(number))?.text ?? "").toContain("طلب جديد");
  const msg = sent.find((m) => m.text.includes(number))!;
  expect(msg.chat_id).toBe("-1001234");
  expect(msg.text).toContain("₪");
});
