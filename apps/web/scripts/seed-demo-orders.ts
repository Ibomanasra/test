/**
 * Beispielbestellungen in allen Status (Demo-Daten, isDemo = true).
 * Läuft über die echten Services → Reservierungen, Lieferscheine, Rückstände und
 * Bestandsbewegungen sind konsistent. Idempotent: bricht ab, wenn schon Demo-Bestellungen existieren.
 *
 *   pnpm demo:orders      (nach pnpm db:seed mit Demo-Daten)
 */
import { ALL_PERMISSIONS, businessDate, effectiveChannel } from "@sa/core";
import { prisma, type OrderStatus, type PaymentMethod } from "@sa/db";
import type { AuthContext } from "../src/server/auth/context";
import { closePdfBrowser } from "@sa/pdf";
import { addCartItem } from "../src/server/services/cart";
import { archivePendingDocuments } from "../src/server/services/invoicing";
import { processPrintJobs } from "../src/server/services/print-jobs";
import { advanceOrder, cancelOrder, checkoutOptions, dispatchOrder, failDelivery, markDelivered, placeOrder } from "../src/server/services/orders";

type Step = "NEW" | "CONFIRMED" | "PICKING" | "READY" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED" | "PARTIAL" | "FAILED";

interface Plan {
  phone: string;
  method: PaymentMethod;
  items: [sku: string, unit: string, qty: number][];
  step: Step;
}

const PLANS: Plan[] = [
  { phone: "+970599100001", method: "CASH_ON_DELIVERY", items: [["CL-001", "PIECE", 2], ["KI-001", "PIECE", 1]], step: "NEW" },
  { phone: "+970569100002", method: "CASH_ON_DELIVERY", items: [["BA-001", "PIECE", 3]], step: "CONFIRMED" },
  { phone: "+970599100003", method: "ON_ACCOUNT", items: [["CL-001", "CARTON", 5], ["PA-001", "CARTON", 2]], step: "PICKING" },
  { phone: "+970599100004", method: "BANK_TRANSFER", items: [["PL-001", "CARTON", 8]], step: "READY" },
  { phone: "+970599100003", method: "ON_ACCOUNT", items: [["FO-001", "CARTON", 3]], step: "OUT_FOR_DELIVERY" },
  { phone: "+970599100001", method: "CASH_ON_DELIVERY", items: [["KI-002", "PIECE", 2]], step: "DELIVERED" },
  { phone: "+970599100004", method: "ON_ACCOUNT", items: [["CL-002", "CARTON", 4], ["PA-002", "CARTON", 8]], step: "PARTIAL" },
  { phone: "+970569100002", method: "CASH_ON_DELIVERY", items: [["BA-002", "PIECE", 8]], step: "CANCELLED" },
  { phone: "+970599100003", method: "ON_ACCOUNT", items: [["KI-003", "CARTON", 2]], step: "FAILED" },
];

async function customerContext(phone: string): Promise<AuthContext & { customer: NonNullable<AuthContext["customer"]> }> {
  const user = await prisma.user.findUniqueOrThrow({ where: { phone }, include: { memberships: { include: { customer: true } } } });
  const m = user.memberships[0]!;
  const c = m.customer;
  return {
    sessionId: "seed",
    via: "bearer",
    user: { id: user.id, kind: "CUSTOMER", name: user.name, phone: user.phone, locale: user.locale },
    permissions: new Set(),
    roleKeys: [],
    customer: { id: c.id, number: c.number, type: c.type, status: c.status, displayName: c.displayName, groupId: c.groupId, memberRole: m.role },
    channel: effectiveChannel({ customerType: c.type, customerStatus: c.status }),
    isStaff: false,
  };
}

async function staffContext(): Promise<AuthContext> {
  const owner = await prisma.user.findFirstOrThrow({ where: { kind: "STAFF", roles: { some: { role: { key: "owner" } } } }, orderBy: { createdAt: "asc" } });
  return {
    sessionId: "seed",
    via: "bearer",
    user: { id: owner.id, kind: "STAFF", name: owner.name, phone: owner.phone, locale: owner.locale },
    permissions: new Set(ALL_PERMISSIONS),
    roleKeys: ["owner"],
    customer: null,
    channel: "B2C",
    isStaff: true,
  };
}

async function variantId(sku: string) {
  const v = await prisma.productVariant.findFirst({ where: { sku }, select: { id: true } });
  if (!v) throw new Error(`demo sku ${sku} missing – run the demo catalog seed first`);
  return v.id;
}

async function main() {
  if (!(await prisma.customer.findFirst({ where: { isDemo: true } }))) {
    console.info("[demo-orders] no demo customers – skipped");
    return;
  }
  if (await prisma.order.findFirst({ where: { isDemo: true } })) {
    console.info("[demo-orders] demo orders exist – skipped");
    return;
  }
  const staff = await staffContext();
  const today = businessDate(new Date());
  const created: { number: string; step: Step; status: OrderStatus }[] = [];
  for (const plan of PLANS) {
    const ctx = await customerContext(plan.phone);
    for (const [sku, unitCode, qty] of plan.items) await addCartItem({ customerId: ctx.customer.id, channel: ctx.channel }, { variantId: await variantId(sku), unitCode, qty });
    const opts = await checkoutOptions(ctx);
    const address = opts.addresses[0]!;
    const date = address.deliveryDates.find((d) => d >= today) ?? address.deliveryDates[0]!;
    const order = await placeOrder(ctx, { addressId: address.id, paymentMethod: plan.method, requestedDeliveryDate: date, customerNote: "طلب تجريبي (مثال)" });
    await prisma.order.update({ where: { id: order.id }, data: { isDemo: true } });

    const go = async (...to: ("CONFIRMED" | "PICKING" | "READY")[]) => {
      for (const s of to) await advanceOrder(staff, order.id, s);
    };
    switch (plan.step) {
      case "NEW":
        break;
      case "CONFIRMED":
        await go("CONFIRMED");
        break;
      case "PICKING":
        await go("CONFIRMED", "PICKING");
        break;
      case "READY":
        await go("CONFIRMED", "PICKING", "READY");
        break;
      case "OUT_FOR_DELIVERY":
        await go("CONFIRMED", "PICKING", "READY");
        await dispatchOrder(staff, order.id, { remainder: "CANCEL" });
        break;
      case "DELIVERED":
        await go("CONFIRMED", "PICKING", "READY");
        await dispatchOrder(staff, order.id, { remainder: "CANCEL" });
        await markDelivered(staff, order.id, "العميل");
        break;
      case "PARTIAL": {
        await go("CONFIRMED", "PICKING", "READY");
        const items = await prisma.orderItem.findMany({ where: { orderId: order.id }, orderBy: { sortOrder: "asc" } });
        const first = items[0]!;
        const res = await dispatchOrder(staff, order.id, { quantities: { [first.id]: Math.floor(first.qtyBase / 2) }, remainder: "BACKORDER" });
        if (res.backorder) await prisma.order.update({ where: { id: res.backorder.id }, data: { isDemo: true } });
        await markDelivered(staff, order.id);
        break;
      }
      case "CANCELLED":
        await cancelOrder(staff, order.id, "طلب العميل الإلغاء (مثال)");
        break;
      case "FAILED":
        await go("CONFIRMED", "PICKING", "READY");
        await dispatchOrder(staff, order.id, { remainder: "CANCEL" });
        await failDelivery(staff, order.id, "العميل غير موجود (مثال)");
        break;
    }
    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, select: { status: true } });
    created.push({ number: order.number, step: plan.step, status: after.status });
  }
  console.table(created);
  // Rechnungen/Gutschriften einfrieren und Auto-Druckaufträge rendern, bevor der Prozess endet
  let printed = 0;
  for (let n = await processPrintJobs(100); n > 0; n = await processPrintJobs(100)) printed += n;
  console.info(`[demo-orders] archived ${await archivePendingDocuments(100)} documents, rendered ${printed} print jobs`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePdfBrowser();
    await prisma.$disconnect();
  });
