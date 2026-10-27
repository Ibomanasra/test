import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env";

/**
 * Zahlungs-Gateway-Adapter (Phase 6). Keine Kartendaten berühren unseren Server:
 * der Kunde zahlt auf der gehosteten Seite des Anbieters, wir prüfen das Ergebnis
 * serverseitig (signierter Callback bzw. Statusabfrage) und vergleichen den Betrag.
 *
 *  - fake:     Entwicklung/Tests – eigene Testseite, HMAC-signierter Callback
 *  - paytabs:  PayTabs PT2 Hosted Payment Page (payment/request, HMAC-SHA256-Callback, payment/query)
 *  - arabbank: Mastercard Gateway (MPGS) Hosted Checkout – INITIATE_CHECKOUT, Status per order-Abfrage
 */

export type GatewayName = "fake" | "paytabs" | "arabbank";

export interface SessionInput {
  intentId: string;
  /** Agorot */
  amount: number;
  currency: "ILS";
  description: string;
  locale: "ar" | "en";
  customer: { name: string; phone: string; email?: string | null; city?: string | null; street?: string | null };
  returnUrl: string;
  callbackUrl: string;
}

export interface GatewaySession {
  providerRef: string | null;
  redirectUrl: string;
}

export interface GatewayResult {
  intentId: string;
  providerRef: string | null;
  status: "CAPTURED" | "FAILED" | "CANCELLED" | "PENDING";
  /** Agorot, wie vom Anbieter bestätigt */
  amount: number | null;
  raw: unknown;
}

export interface PaymentGateway {
  readonly name: GatewayName;
  createSession(input: SessionInput): Promise<GatewaySession>;
  /** Server-zu-Server-Benachrichtigung prüfen (wirft bei ungültiger Signatur) */
  verifyCallback(rawBody: string, headers: Headers): Promise<GatewayResult>;
  /** Status aktiv abfragen (Rückkehr des Kunden, Nachprüfung) */
  fetchStatus(intentId: string, providerRef: string | null): Promise<GatewayResult>;
}

export class GatewayError extends Error {}

// --- Hilfsfunktionen (exportiert für Tests) ----------------------------------

export function hmacHex(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

/** 12345 Agorot → 123.45 (Anbieter erwarten Dezimalbeträge) */
export const toDecimal = (agorot: number) => Number((agorot / 100).toFixed(2));
export const fromDecimal = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

type Fetch = typeof fetch;

// --- Fake --------------------------------------------------------------------

export class FakeGateway implements PaymentGateway {
  readonly name = "fake" as const;
  constructor(private readonly secret: string, private readonly appUrl: string) {}

  async createSession(i: SessionInput): Promise<GatewaySession> {
    return { providerRef: `fake_${i.intentId}`, redirectUrl: `${this.appUrl}/${i.locale}/pay/fake/${i.intentId}` };
  }

  /** Callback-Körper der Testseite signieren */
  sign(body: string): string {
    return hmacHex(this.secret, body);
  }

  async verifyCallback(rawBody: string, headers: Headers): Promise<GatewayResult> {
    const sig = headers.get("x-fake-signature") ?? "";
    if (!safeEqualHex(sig, this.sign(rawBody))) throw new GatewayError("invalid signature");
    const b = JSON.parse(rawBody) as { intentId: string; approved: boolean; amount: number };
    return { intentId: b.intentId, providerRef: `fake_${b.intentId}`, status: b.approved ? "CAPTURED" : "FAILED", amount: b.amount, raw: b };
  }

  async fetchStatus(intentId: string, providerRef: string | null): Promise<GatewayResult> {
    return { intentId, providerRef, status: "PENDING", amount: null, raw: null };
  }
}

// --- PayTabs -----------------------------------------------------------------

export class PayTabsGateway implements PaymentGateway {
  readonly name = "paytabs" as const;
  constructor(
    private readonly cfg: { baseUrl: string; profileId: string; serverKey: string },
    private readonly http: Fetch = fetch,
  ) {}

  private async post(path: string, body: unknown) {
    const res = await this.http(`${this.cfg.baseUrl}${path}`, { method: "POST", headers: { authorization: this.cfg.serverKey, "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new GatewayError(`paytabs ${path} ${res.status}: ${String(data.message ?? "")}`);
    return data;
  }

  async createSession(i: SessionInput): Promise<GatewaySession> {
    const data = await this.post("/payment/request", {
      profile_id: Number(this.cfg.profileId) || this.cfg.profileId,
      tran_type: "sale",
      tran_class: "ecom",
      cart_id: i.intentId,
      cart_currency: i.currency,
      cart_amount: toDecimal(i.amount),
      cart_description: i.description.slice(0, 120),
      paypage_lang: i.locale,
      customer_details: { name: i.customer.name, phone: i.customer.phone, email: i.customer.email ?? "no-reply@example.com", street1: i.customer.street ?? "-", city: i.customer.city ?? "-", country: "PS" },
      hide_shipping: true,
      callback: i.callbackUrl,
      return: i.returnUrl,
    });
    if (typeof data.redirect_url !== "string") throw new GatewayError("paytabs: no redirect_url");
    return { providerRef: typeof data.tran_ref === "string" ? data.tran_ref : null, redirectUrl: data.redirect_url };
  }

  static parse(data: Record<string, unknown>): GatewayResult {
    const result = (data.payment_result ?? {}) as { response_status?: string };
    const s = result.response_status;
    return {
      intentId: String(data.cart_id ?? ""),
      providerRef: typeof data.tran_ref === "string" ? data.tran_ref : null,
      // A = autorisiert/bezahlt, H = in Prüfung, P = ausstehend, sonst abgelehnt/storniert
      status: s === "A" ? "CAPTURED" : s === "H" || s === "P" ? "PENDING" : s === "V" ? "CANCELLED" : "FAILED",
      amount: fromDecimal(data.tran_total ?? data.cart_amount),
      raw: data,
    };
  }

  async verifyCallback(rawBody: string, headers: Headers): Promise<GatewayResult> {
    const sig = headers.get("signature") ?? "";
    if (!safeEqualHex(sig, hmacHex(this.cfg.serverKey, rawBody))) throw new GatewayError("invalid signature");
    return PayTabsGateway.parse(JSON.parse(rawBody) as Record<string, unknown>);
  }

  async fetchStatus(intentId: string, providerRef: string | null): Promise<GatewayResult> {
    if (!providerRef) return { intentId, providerRef, status: "PENDING", amount: null, raw: null };
    const data = await this.post("/payment/query", { profile_id: Number(this.cfg.profileId) || this.cfg.profileId, tran_ref: providerRef });
    return { ...PayTabsGateway.parse(data), intentId };
  }
}

// --- Arab Bank (Mastercard Gateway / MPGS) -------------------------------------

export class ArabBankGateway implements PaymentGateway {
  readonly name = "arabbank" as const;
  constructor(
    private readonly cfg: { baseUrl: string; merchantId: string; password: string; merchantName: string },
    private readonly http: Fetch = fetch,
  ) {}

  private auth() {
    return `Basic ${Buffer.from(`merchant.${this.cfg.merchantId}:${this.cfg.password}`).toString("base64")}`;
  }

  private url(path: string) {
    return `${this.cfg.baseUrl}/api/rest/version/72/merchant/${encodeURIComponent(this.cfg.merchantId)}${path}`;
  }

  async createSession(i: SessionInput): Promise<GatewaySession> {
    const res = await this.http(this.url("/session"), {
      method: "POST",
      headers: { authorization: this.auth(), "content-type": "application/json" },
      body: JSON.stringify({
        apiOperation: "INITIATE_CHECKOUT",
        interaction: { operation: "PURCHASE", returnUrl: i.returnUrl, locale: i.locale === "ar" ? "ar_SA" : "en_US", merchant: { name: this.cfg.merchantName } },
        order: { id: i.intentId, amount: toDecimal(i.amount).toFixed(2), currency: i.currency, description: i.description.slice(0, 120) },
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { session?: { id?: string }; successIndicator?: string; result?: string };
    if (!res.ok || !data.session?.id) throw new GatewayError(`arabbank session ${res.status}`);
    // Gehostete Bezahlseite (Hosted Checkout, Weiterleitungsmodus)
    return { providerRef: data.session.id, redirectUrl: `${this.cfg.baseUrl}/checkout/pay/${encodeURIComponent(data.session.id)}` };
  }

  static parseOrder(intentId: string, data: Record<string, unknown>): GatewayResult {
    const status = String(data.status ?? "");
    const result = String(data.result ?? "");
    return {
      intentId,
      providerRef: typeof data.id === "string" ? data.id : intentId,
      status: status === "CAPTURED" && result === "SUCCESS" ? "CAPTURED" : ["FAILED", "DECLINED"].includes(status) || result === "FAILURE" ? "FAILED" : status === "CANCELLED" ? "CANCELLED" : "PENDING",
      amount: fromDecimal(data.totalCapturedAmount ?? data.amount),
      raw: data,
    };
  }

  /** MPGS-Benachrichtigungen enthalten keine eigene Signatur → immer Statusabfrage beim Gateway */
  async verifyCallback(rawBody: string): Promise<GatewayResult> {
    const b = JSON.parse(rawBody) as { order?: { id?: string } };
    const id = b.order?.id;
    if (!id) throw new GatewayError("missing order id");
    return this.fetchStatus(id);
  }

  async fetchStatus(intentId: string): Promise<GatewayResult> {
    const res = await this.http(this.url(`/order/${encodeURIComponent(intentId)}`), { headers: { authorization: this.auth() } });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.status === 404) return { intentId, providerRef: null, status: "PENDING", amount: null, raw: data };
    if (!res.ok) throw new GatewayError(`arabbank order ${res.status}`);
    return ArabBankGateway.parseOrder(intentId, data);
  }
}

let gateway: PaymentGateway | undefined;

export function paymentGateway(): PaymentGateway {
  if (gateway) return gateway;
  const e = env();
  switch (e.PAYMENT_GATEWAY) {
    case "paytabs":
      gateway = new PayTabsGateway({ baseUrl: e.PAYMENT_GATEWAY_URL ?? "https://secure.paytabs.com", profileId: e.PAYMENT_GATEWAY_MERCHANT_ID, serverKey: e.PAYMENT_GATEWAY_API_KEY });
      break;
    case "arabbank":
      gateway = new ArabBankGateway({ baseUrl: e.PAYMENT_GATEWAY_URL ?? "https://ap-gateway.mastercard.com", merchantId: e.PAYMENT_GATEWAY_MERCHANT_ID, password: e.PAYMENT_GATEWAY_API_KEY, merchantName: "Sholat Aljanoub" });
      break;
    default:
      if (e.NODE_ENV === "production") throw new GatewayError("fake payment gateway is disabled in production");
      gateway = new FakeGateway(e.PAYMENT_GATEWAY_CALLBACK_SECRET || e.SESSION_SECRET, e.APP_URL);
  }
  return gateway;
}
