/**
 * Seed (idempotent – kann bei jedem Start laufen).
 *
 *  Basis (immer):   Firmendaten-Platzhalter, MwSt. 16 %, Einheiten, Liefergebiete,
 *                   Zahlungsarten, Auto-Druckregeln, Rollen, Inhaber, Lager, B2B-Gruppen
 *  Demo (SEED_DEMO_DATA=true): ein Mitarbeiter pro Rolle, 5 Beispielkunden (isDemo = true)
 *
 * Bestehende Datensätze werden NICHT überschrieben (Admin-Änderungen bleiben erhalten).
 * Produkte, Preise und Bestellungen folgen mit Phase 2/3.
 */
import { hash } from "@node-rs/argon2";
import { SYSTEM_ROLES, normalizePhone } from "@sa/core";
import { PrismaClient, type Channel, type PaymentMethod } from "@prisma/client";
import { DEMO_CATEGORIES, DEMO_PRODUCTS, demoEan } from "./demo-catalog";

const prisma = new PrismaClient();
const ARGON = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

const env = (key: string, fallback: string) => process.env[key]?.trim() || fallback;
const log = (msg: string) => console.info(`[seed] ${msg}`);

async function seedCompany() {
  await prisma.companySettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      nameAr: "شعلة الجنوب للتجارة العامة",
      nameEn: "Sholat Aljanoub General Trading",
      addressAr: "الخليل – شارع السلام (عنوان مثال، يرجى التعديل)",
      addressEn: "Hebron – Al-Salam Street (sample address, please update)",
      phone: "+970 2 222 0000",
      email: "info@sholat-aljanoub.example",
      dealerNumber: "000000000",
      minMarginBps: 500,
      defaultPaymentTermDays: 30,
      quoteValidityDays: 14,
      // Pflichtangaben der Steuerrechnung – mit Steuerberater prüfen (ROADMAP)
      taxInvoiceFields: {
        sellerDealerNumber: true,
        buyerDealerNumberForB2B: true,
        vatSeparated: true,
        sequentialNumber: true,
        issueDate: true,
        supplyDate: false,
      },
    },
  });
}

async function seedTax() {
  await prisma.taxRate.upsert({
    where: { code_validFrom: { code: "STANDARD", validFrom: new Date("2020-01-01T00:00:00+02:00") } },
    update: {},
    create: { code: "STANDARD", rateBps: 1600, validFrom: new Date("2020-01-01T00:00:00+02:00") },
  });
}

async function seedUnits() {
  const units = [
    ["PIECE", "قطعة", "Piece"],
    ["PACK", "علبة", "Pack"],
    ["CARTON", "كرتونة", "Carton"],
    ["PALLET", "طبلية", "Pallet"],
  ] as const;
  for (const [code, nameAr, nameEn] of units) {
    await prisma.unitOfMeasure.upsert({ where: { code }, update: {}, create: { code, nameAr, nameEn } });
  }
}

/** Gebühren in Agorot: [B2C-Gebühr brutto, B2C-Mindestwert, B2C-gratis-ab, B2B-Gebühr, B2B-Mindestwert netto, B2B-gratis-ab] */
const ZONES: [string, string, string, (number | null)[]][] = [
  ["HEBRON", "الخليل", "Hebron", [1000, 5000, 30000, 0, 50000, null]],
  ["BETHLEHEM", "بيت لحم", "Bethlehem", [1500, 7000, 40000, 2000, 80000, 200000]],
  ["RAMALLAH", "رام الله والبيرة", "Ramallah / Al-Bireh", [2500, 10000, 50000, 3500, 100000, 300000]],
  ["JERUSALEM", "القدس", "Jerusalem", [3000, 15000, 60000, 5000, 150000, 400000]],
  ["NABLUS", "نابلس", "Nablus", [3000, 10000, 50000, 4000, 100000, 300000]],
  ["JENIN", "جنين", "Jenin", [3500, 12000, 60000, 5000, 120000, 350000]],
  ["TULKARM", "طولكرم", "Tulkarm", [3500, 12000, 60000, 5000, 120000, 350000]],
  ["JERICHO", "أريحا", "Jericho", [3000, 10000, 50000, 4500, 100000, 300000]],
];

async function seedZones() {
  for (const [i, [code, nameAr, nameEn, r]] of ZONES.entries()) {
    const existing = await prisma.deliveryZone.findUnique({ where: { code } });
    if (existing) continue;
    await prisma.deliveryZone.create({
      data: {
        code,
        nameAr,
        nameEn,
        sortOrder: (i + 1) * 10,
        deliveryWeekdays: [],
        rates: {
          create: [
            { channel: "B2C", feeGrossAgorot: r[0] ?? 0, minOrderAgorot: r[1] ?? 0, freeFromAgorot: r[2] ?? null },
            { channel: "B2B", feeGrossAgorot: r[3] ?? 0, minOrderAgorot: r[4] ?? 0, freeFromAgorot: r[5] ?? null },
          ],
        },
      },
    });
  }
}

async function seedPaymentMethods() {
  const methods: [PaymentMethod, string, string][] = [
    ["CASH_ON_DELIVERY", "الدفع عند الاستلام", "Cash on delivery"],
    ["BANK_TRANSFER", "تحويل بنكي (دفع مسبق)", "Bank transfer (prepayment)"],
    ["CARD_GATEWAY", "بطاقة عبر البنك", "Card (bank gateway)"],
    ["ON_ACCOUNT", "على الحساب (آجل)", "On account (invoice)"],
  ];
  for (const channel of ["B2C", "B2B"] as Channel[]) {
    for (const [i, [method, labelAr, labelEn]] of methods.entries()) {
      // Karte erst mit Gateway-Adapter (Phase 6), Rechnungskauf nur B2B
      const enabled = method !== "CARD_GATEWAY" && !(method === "ON_ACCOUNT" && channel === "B2C");
      await prisma.paymentMethodConfig.upsert({
        where: { method_channel: { method, channel } },
        update: {},
        create: { method, channel, enabled, labelAr, labelEn, sortOrder: (i + 1) * 10 },
      });
    }
  }
}

async function seedAutoPrint() {
  const rules = [
    { onStatus: "CONFIRMED", docType: "PICK_LIST", withPrices: false },
    { onStatus: "OUT_FOR_DELIVERY", docType: "DELIVERY_NOTE", withPrices: true },
  ] as const;
  for (const r of rules) {
    await prisma.autoPrintRule.upsert({
      where: { onStatus_docType: { onStatus: r.onStatus, docType: r.docType } },
      update: {},
      create: { ...r, enabled: true },
    });
  }
}

async function seedRoles() {
  for (const r of SYSTEM_ROLES) {
    await prisma.role.upsert({
      where: { key: r.key },
      // Rechte nur beim Anlegen setzen – im Admin angepasste Rollen bleiben unverändert
      update: { isSystem: true },
      create: { key: r.key, nameAr: r.nameAr, nameEn: r.nameEn, isSystem: true, permissions: [...r.permissions] },
    });
  }
}

async function upsertStaff(phone: string, name: string, password: string, roleKey: string) {
  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) return existing;
  const role = await prisma.role.findUniqueOrThrow({ where: { key: roleKey } });
  return prisma.user.create({
    data: {
      kind: "STAFF",
      phone,
      phoneVerifiedAt: new Date(),
      name,
      passwordHash: await hash(password, ARGON),
      roles: { create: { roleId: role.id } },
    },
  });
}

async function seedOwner() {
  const phone = normalizePhone(env("SEED_OWNER_PHONE", "+970599000001"));
  const user = await upsertStaff(phone, env("SEED_OWNER_NAME", "المالك"), env("SEED_OWNER_PASSWORD", "ChangeMe!2026"), "owner");
  log(`owner: ${user.phone}`);
}

async function seedWarehouse() {
  await prisma.warehouse.upsert({ where: { code: "MAIN" }, update: {}, create: { code: "MAIN", name: "المستودع الرئيسي / Main warehouse", isDefault: true } });
}

async function seedGroups() {
  const groups = [
    { code: "STANDARD", nameAr: "عادي", nameEn: "Standard", discountBps: 0, sortOrder: 10, defaultPaymentTermDays: 0, defaultCreditLimitAgorot: 0 },
    { code: "SILVER", nameAr: "فضي", nameEn: "Silver", discountBps: 300, sortOrder: 20, defaultPaymentTermDays: 15, defaultCreditLimitAgorot: 500_000 },
    { code: "GOLD", nameAr: "ذهبي", nameEn: "Gold", discountBps: 600, sortOrder: 30, defaultPaymentTermDays: 30, defaultCreditLimitAgorot: 2_000_000 },
  ];
  for (const g of groups) {
    await prisma.customerGroup.upsert({ where: { code: g.code }, update: {}, create: { ...g, pricingMode: "DISCOUNT_PERCENT" } });
  }
}

// ---------------------------------------------------------------------------
// Demo-Daten (alle mit isDemo = true bzw. Namenszusatz „(مثال)“)
// ---------------------------------------------------------------------------

const DEMO_STAFF = [
  ["+970599000002", "سامي – المبيعات (مثال)", "sales"],
  ["+970599000003", "ليلى – الأسعار (مثال)", "pricing"],
  ["+970599000004", "خالد – المستودع (مثال)", "warehouse"],
  ["+970599000005", "يوسف – سائق (مثال)", "driver"],
  ["+970599000006", "منى – المحاسبة (مثال)", "accounting"],
] as const;

async function nextCustomerNumber(): Promise<string> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`SELECT nextval('customer_number_seq') AS n`;
  return `K-${String(Number(rows[0]!.n)).padStart(6, "0")}`;
}

interface DemoCustomer {
  phone: string;
  name: string;
  type: "B2C" | "B2B";
  status: "ACTIVE" | "PENDING_APPROVAL";
  zone: string;
  city: string;
  company?: { name: string; owner: string; dealerNumber: string; group?: string; terms?: number; credit?: number };
}

const DEMO_CUSTOMERS: DemoCustomer[] = [
  { phone: "+970599100001", name: "أحمد الجعبري (مثال)", type: "B2C", status: "ACTIVE", zone: "HEBRON", city: "الخليل" },
  { phone: "+970569100002", name: "مريم عيسى (مثال)", type: "B2C", status: "ACTIVE", zone: "BETHLEHEM", city: "بيت جالا" },
  {
    phone: "+970599100003",
    name: "سوبرماركت النور (مثال)",
    type: "B2B",
    status: "ACTIVE",
    zone: "HEBRON",
    city: "الخليل",
    company: { name: "سوبرماركت النور (مثال)", owner: "محمود النتشة", dealerNumber: "562100003", group: "GOLD", terms: 30, credit: 2_000_000 },
  },
  {
    phone: "+970599100004",
    name: "بقالة الأمل (مثال)",
    type: "B2B",
    status: "ACTIVE",
    zone: "RAMALLAH",
    city: "البيرة",
    company: { name: "بقالة الأمل (مثال)", owner: "رامي حمدان", dealerNumber: "562100004", group: "SILVER", terms: 15, credit: 500_000 },
  },
  {
    phone: "+970599100005",
    name: "محلات الريان للأدوات المنزلية (مثال)",
    type: "B2B",
    status: "PENDING_APPROVAL",
    zone: "NABLUS",
    city: "نابلس",
    company: { name: "محلات الريان للأدوات المنزلية (مثال)", owner: "سعيد الشكعة", dealerNumber: "562100005" },
  },
];

async function seedDemo() {
  const password = env("SEED_DEMO_PASSWORD", "Demo-2026-pass");
  for (const [phone, name, role] of DEMO_STAFF) await upsertStaff(phone, name, password, role);
  log(`demo staff: ${DEMO_STAFF.length} (password from SEED_DEMO_PASSWORD)`);

  for (const c of DEMO_CUSTOMERS) {
    if (await prisma.user.findUnique({ where: { phone: c.phone } })) continue;
    const zone = await prisma.deliveryZone.findUniqueOrThrow({ where: { code: c.zone } });
    const group = c.company?.group ? await prisma.customerGroup.findUniqueOrThrow({ where: { code: c.company.group } }) : null;
    const user = await prisma.user.create({
      data: { kind: "CUSTOMER", phone: c.phone, phoneVerifiedAt: new Date(), name: c.company?.owner ?? c.name },
    });
    await prisma.customer.create({
      data: {
        number: await nextCustomerNumber(),
        type: c.type,
        status: c.status,
        displayName: c.name,
        companyName: c.company?.name,
        ownerName: c.company?.owner,
        dealerNumber: c.company?.dealerNumber,
        groupId: group?.id,
        paymentTermDays: c.company?.terms,
        creditLimitAgorot: c.company?.credit ?? 0,
        allowOnAccount: !!c.company?.credit,
        approvedAt: c.type === "B2B" && c.status === "ACTIVE" ? new Date() : null,
        phone: c.phone,
        isDemo: true,
        members: { create: { userId: user.id, role: "OWNER" } },
        addresses: {
          create: { zoneId: zone.id, recipient: c.company?.owner ?? c.name, phone: c.phone, city: c.city, street: "شارع المثال 1", isDefault: true },
        },
      },
    });
  }
  log(`demo customers: ${DEMO_CUSTOMERS.length}`);
}

async function seedRounding() {
  if ((await prisma.roundingRule.count()) > 0) return;
  // B2C-Aktionspreise enden auf ,90 (Basispreise bleiben wie gepflegt)
  await prisma.roundingRule.create({
    data: { channel: "B2C", mode: "END_90", minAgorot: 0, appliesToPromotions: true, appliesToBasePrices: false, active: true, sortOrder: 10 },
  });
}

async function seedDemoCatalog() {
  if (await prisma.product.findFirst({ where: { isDemo: true } })) {
    log("demo catalog already present");
    return;
  }
  const units = Object.fromEntries((await prisma.unitOfMeasure.findMany()).map((u) => [u.code, u.id]));
  const warehouse = await prisma.warehouse.findUniqueOrThrow({ where: { code: "MAIN" } });
  const categories: Record<string, string> = {};
  for (const [i, c] of DEMO_CATEGORIES.entries()) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: { slug: c.slug, nameAr: c.nameAr, nameEn: c.nameEn, sortOrder: (i + 1) * 10 },
    });
    categories[c.slug] = cat.id;
  }
  let ean = 1;
  for (const p of DEMO_PRODUCTS) {
    const brand = p.brand ? await prisma.brand.upsert({ where: { name: p.brand }, update: {}, create: { name: p.brand } }) : null;
    const bin = await prisma.bin.upsert({
      where: { warehouseId_code: { warehouseId: warehouse.id, code: p.bin } },
      update: {},
      create: { warehouseId: warehouse.id, code: p.bin, sortKey: Number(p.bin.replace(/\D/g, "")) || 0 },
    });
    const variants = [
      { sku: p.sku, nameAr: null as string | null, nameEn: null as string | null, cost: p.cost, b2c: p.b2c, b2b: p.b2b, stock: p.stock },
      ...(p.variants ?? []).map((v) => ({ sku: `${p.sku}-${v.suffix}`, nameAr: v.nameAr, nameEn: v.nameEn, cost: v.cost, b2c: v.b2c, b2b: v.b2b, stock: Math.round(p.stock / 2) })),
    ];
    await prisma.product.create({
      data: {
        slug: p.sku.toLowerCase(),
        nameAr: `${p.nameAr} (مثال)`,
        nameEn: `${p.nameEn} (demo)`,
        descriptionAr: "منتج تجريبي لأغراض العرض.",
        descriptionEn: "Sample product for demonstration.",
        categoryId: categories[p.category]!,
        brandId: brand?.id,
        isDemo: true,
        variants: {
          create: variants.map((v, i) => ({
            sku: v.sku,
            barcode: demoEan(ean++),
            nameAr: v.nameAr,
            nameEn: v.nameEn,
            costPrice: v.cost,
            b2cPrice: v.b2c,
            b2bBasePrice: v.b2b,
            minStock: p.minStock,
            defaultBinId: bin.id,
            sortOrder: i,
            units: {
              create: [
                { unitId: units.PIECE!, factor: 1 },
                { unitId: units.CARTON!, factor: p.carton },
                ...(p.pack ? [{ unitId: units.PACK!, factor: p.pack }] : []),
              ],
            },
            channelRules: {
              create: [
                { channel: "B2C", defaultUnitId: units.PIECE!, allowedUnitIds: [units.PIECE!], minQtyBase: 1, qtyStepBase: 1 },
                {
                  channel: "B2B",
                  defaultUnitId: units.CARTON!,
                  allowedUnitIds: [units.CARTON!, units.PIECE!],
                  minQtyBase: p.carton * (p.minCartons ?? 1),
                  qtyStepBase: p.carton,
                },
              ],
            },
            stockLevels: { create: { warehouseId: warehouse.id, onHand: v.stock } },
            stockMovements: {
              create: { warehouseId: warehouse.id, binId: bin.id, type: "RECEIPT", qtyBase: v.stock, unitCost: v.cost, note: "Anfangsbestand (Demo)" },
            },
          })),
        },
      },
    });
  }
  log(`demo catalog: ${DEMO_PRODUCTS.length} products`);
  await seedDemoPricing(categories);
}

async function seedDemoPricing(categories: Record<string, string>) {
  const v = async (sku: string) => (await prisma.productVariant.findUniqueOrThrow({ where: { sku } })).id;
  const gold = await prisma.customerGroup.findUniqueOrThrow({ where: { code: "GOLD" } });
  const goldCustomer = await prisma.customer.findFirst({ where: { isDemo: true, groupId: gold.id } });
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86_400_000);

  await prisma.tierPrice.createMany({
    data: [
      { variantId: await v("CL-001"), minQtyBase: 48, priceNet: 890 },
      { variantId: await v("CL-001"), minQtyBase: 120, priceNet: 850 },
      { variantId: await v("PA-002"), minQtyBase: 20, priceNet: 3190 },
      { variantId: await v("FO-001"), groupId: gold.id, minQtyBase: 48, priceNet: 3690 },
    ],
  });
  await prisma.categoryDiscount.create({ data: { categoryId: categories.cleaning!, groupId: gold.id, discountBps: 300 } });
  if (goldCustomer) {
    await prisma.customerPrice.create({
      data: { customerId: goldCustomer.id, variantId: await v("CL-002"), priceNet: 3490, isFixed: true, note: "اتفاق سنوي (مثال)" },
    });
  }
  await prisma.promotion.create({
    data: {
      nameAr: "خصم 10% على مواد التنظيف (مثال)",
      nameEn: "10% off cleaning (demo)",
      channel: "B2C",
      type: "PERCENT",
      percentBps: 1000,
      startsAt: now,
      endsAt: in30,
      targets: { create: { categoryId: categories.cleaning! } },
    },
  });
  await prisma.promotion.create({
    data: {
      nameAr: "زيت زيتون بسعر خاص للتجار (مثال)",
      nameEn: "Olive oil special price for businesses (demo)",
      channel: "B2B",
      type: "FIXED_PRICE",
      startsAt: now,
      endsAt: in30,
      targets: { create: { variantId: await v("FO-001"), fixedPrice: 3790 } },
    },
  });
  await prisma.promotion.create({
    data: {
      nameAr: "اشترِ 10 واحصل على 1 مجاناً – شاي (مثال)",
      nameEn: "Buy 10 get 1 free – tea (demo)",
      channel: "BOTH",
      type: "BUY_X_GET_Y",
      buyQty: 10,
      getQty: 1,
      startsAt: now,
      endsAt: in30,
      targets: { create: { variantId: await v("FO-004") } },
    },
  });
  log("demo pricing rules");
}

async function main() {
  await seedCompany();
  await seedTax();
  await seedUnits();
  await seedZones();
  await seedPaymentMethods();
  await seedAutoPrint();
  await seedRoles();
  await seedOwner();
  await seedWarehouse();
  await seedGroups();
  await seedRounding();
  if (env("SEED_DEMO_DATA", "false") === "true") {
    await seedDemo();
    await seedDemoCatalog();
  }
  log("done");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
