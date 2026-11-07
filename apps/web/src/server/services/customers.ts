import "server-only";
import type { ApproveCustomer, CustomerUpdate, RegisterB2B, RegisterB2C } from "@sa/contracts";
import type { z } from "zod";
import type { addressCreateSchema } from "@sa/contracts";
import { businessDate, invoiceOpenAmount, startOfBusinessDay } from "@sa/core";
import { nextCustomerNumber, prisma, type CustomerStatus, type CustomerType, type Locale, type Prisma } from "@sa/db";
import { smsAdapter } from "../adapters/sms";
import { sniffMimeType, storeFile } from "../adapters/storage";
import { audit } from "../audit";
import type { AuthContext } from "../auth/context";
import { env } from "../env";
import { AppError, badRequest, conflict, notFound } from "../errors";
import { resolveZoneId } from "./zones";

async function assertPhoneFree(phone: string) {
  if (await prisma.user.findUnique({ where: { phone }, select: { id: true } })) throw conflict("phone_already_registered");
}


/** Privatkunde: sofort aktiv. */
/** Anmeldedaten bei der Registrierung: Passwort-Hash (ohne SMS) bzw. Nummer per Code bestätigt */
export interface RegisterAuth {
  passwordHash?: string;
  phoneVerified: boolean;
}

export async function registerB2C(phone: string, input: RegisterB2C, auth: RegisterAuth = { phoneVerified: true }) {
  await assertPhoneFree(phone);
  const zoneId = await resolveZoneId(input.address.city, input.address.zoneId);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { kind: "CUSTOMER", phone, phoneVerifiedAt: auth.phoneVerified ? new Date() : null, passwordHash: auth.passwordHash, name: input.name, locale: input.locale },
    });
    const customer = await tx.customer.create({
      data: {
        number: await nextCustomerNumber(tx),
        type: "B2C",
        status: "ACTIVE",
        displayName: input.name,
        phone,
        preferredLocale: input.locale,
        members: { create: { userId: user.id, role: "OWNER" } },
        addresses: { create: { ...input.address, zoneId, recipient: input.name, phone, isDefault: true } },
      },
    });
    await audit({ user: { id: user.id } }, { action: "customer.register", entityType: "Customer", entityId: customer.id, after: customer }, tx);
    return { user, customer };
  });
}

export interface LicenseUpload {
  data: Buffer;
  originalName: string;
}

/** Händler: Status "wartet auf Freigabe" – sieht bis dahin B2C-Preise. */
export async function registerB2B(phone: string, input: RegisterB2B, license: LicenseUpload, auth: RegisterAuth = { phoneVerified: true }) {
  await assertPhoneFree(phone);
  const zoneId = await resolveZoneId(input.address.city, input.address.zoneId);
  const maxBytes = env().UPLOAD_MAX_MB * 1024 * 1024;
  if (license.data.length === 0) throw badRequest("license_required");
  if (license.data.length > maxBytes) throw badRequest("file_too_large");
  const mimeType = sniffMimeType(license.data);
  if (!mimeType) throw badRequest("invalid_file_type");

  const duplicate = await prisma.customer.findFirst({
    where: { type: "B2B", dealerNumber: input.dealerNumber, status: { not: "REJECTED" } },
    select: { id: true },
  });
  if (duplicate) throw conflict("dealer_number_exists");

  const file = await storeFile({ data: license.data, mimeType, originalName: license.originalName, purpose: "trade-license" });

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { kind: "CUSTOMER", phone, phoneVerifiedAt: auth.phoneVerified ? new Date() : null, passwordHash: auth.passwordHash, name: input.name, locale: input.locale, email: input.email },
    });
    await tx.fileObject.update({ where: { id: file.id }, data: { uploadedById: user.id } });
    const customer = await tx.customer.create({
      data: {
        number: await nextCustomerNumber(tx),
        type: "B2B",
        status: "PENDING_APPROVAL",
        displayName: input.companyName,
        companyName: input.companyName,
        ownerName: input.ownerName,
        dealerNumber: input.dealerNumber,
        licenseFileId: file.id,
        phone,
        email: input.email,
        preferredLocale: input.locale,
        members: { create: { userId: user.id, role: "OWNER" } },
        addresses: { create: { ...input.address, zoneId, recipient: input.ownerName, phone, isDefault: true } },
        files: { create: { fileId: file.id, title: "Trade license / رخصة المهن" } },
      },
    });
    await audit({ user: { id: user.id } }, { action: "customer.register_b2b", entityType: "Customer", entityId: customer.id, after: customer }, tx);
    return { user, customer };
  });
}

export interface CustomerListFilter {
  q?: string;
  type?: CustomerType;
  status?: CustomerStatus;
  page: number;
}

export const CUSTOMER_PAGE_SIZE = 25;

export async function listCustomers(f: CustomerListFilter) {
  const where: Prisma.CustomerWhereInput = {
    type: f.type,
    status: f.status,
    ...(f.q
      ? {
          OR: [
            { displayName: { contains: f.q, mode: "insensitive" } },
            { companyName: { contains: f.q, mode: "insensitive" } },
            { number: { contains: f.q, mode: "insensitive" } },
            { phone: { contains: f.q } },
            { dealerNumber: { contains: f.q } },
          ],
        }
      : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.customer.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (f.page - 1) * CUSTOMER_PAGE_SIZE,
      take: CUSTOMER_PAGE_SIZE,
      include: { group: { select: { nameAr: true, nameEn: true } } },
    }),
    prisma.customer.count({ where }),
  ]);
  return { items, total, pageSize: CUSTOMER_PAGE_SIZE };
}

export async function getCustomerDetail(id: string) {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      group: true,
      members: { include: { user: { select: { id: true, name: true, phone: true, isActive: true, lastLoginAt: true } } } },
      addresses: { include: { zone: { select: { nameAr: true, nameEn: true } } }, orderBy: { isDefault: "desc" } },
      notes: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 50 },
      files: { include: { file: { select: { id: true, mimeType: true, originalName: true, sizeBytes: true } } } },
      licenseFile: { select: { id: true, mimeType: true, originalName: true } },
    },
  });
  if (!customer) throw notFound();
  return customer;
}

const STATUS_TEXT: Record<"approved" | "rejected", Record<Locale, string>> = {
  approved: {
    ar: "تمت الموافقة على حساب التاجر الخاص بك لدى شعلة الجنوب. يمكنك الآن مشاهدة أسعار الجملة.",
    en: "Your Sholat Aljanoub business account has been approved. Wholesale prices are now available.",
    he: "חשבון העסק שלך בשולת אלג'נוב אושר. מחירי הסיטונאות זמינים כעת.",
  },
  rejected: {
    ar: "نعتذر، لم تتم الموافقة على طلب حساب التاجر. يرجى التواصل معنا.",
    en: "Sorry, your business account request was not approved. Please contact us.",
    he: "מצטערים, בקשת חשבון העסק שלך לא אושרה. אנא צור איתנו קשר.",
  },
};

async function notifyCustomer(customerId: string, kind: "approved" | "rejected") {
  const c = await prisma.customer.findUnique({ where: { id: customerId }, select: { phone: true, preferredLocale: true } });
  if (!c?.phone) return;
  await smsAdapter().send({ to: c.phone, template: `customer.${kind}`, locale: c.preferredLocale, text: STATUS_TEXT[kind][c.preferredLocale] });
}

/** Händler freigeben: Gruppe, Zahlungsziel, Kreditlimit. */
export async function approveCustomer(ctx: AuthContext, id: string, input: ApproveCustomer) {
  const before = await prisma.customer.findUnique({ where: { id } });
  if (!before) throw notFound();
  if (before.type !== "B2B") throw badRequest("not_b2b");
  if (before.status !== "PENDING_APPROVAL" && before.status !== "REJECTED") throw new AppError(409, "invalid_status");
  const group = await prisma.customerGroup.findFirst({ where: { id: input.groupId, active: true } });
  if (!group) throw badRequest("invalid_group");

  const after = await prisma.$transaction(async (tx) => {
    const updated = await tx.customer.update({
      where: { id },
      data: {
        status: "ACTIVE",
        groupId: input.groupId,
        paymentTermDays: input.paymentTermDays,
        creditLimitAgorot: input.creditLimitAgorot,
        allowOnAccount: input.allowOnAccount,
        approvedAt: new Date(),
        approvedById: ctx.user.id,
        rejectedReason: null,
      },
    });
    await audit(ctx, { action: "customer.approve", entityType: "Customer", entityId: id, before, after: updated }, tx);
    return updated;
  });
  await notifyCustomer(id, "approved");
  return after;
}

export async function rejectCustomer(ctx: AuthContext, id: string, reason: string) {
  const before = await prisma.customer.findUnique({ where: { id } });
  if (!before) throw notFound();
  if (before.type !== "B2B" || before.status !== "PENDING_APPROVAL") throw new AppError(409, "invalid_status");
  const after = await prisma.$transaction(async (tx) => {
    const updated = await tx.customer.update({ where: { id }, data: { status: "REJECTED", rejectedReason: reason } });
    await audit(ctx, { action: "customer.reject", entityType: "Customer", entityId: id, before, after: updated }, tx);
    return updated;
  });
  await notifyCustomer(id, "rejected");
  return after;
}

/** Sperren: Kunde kann sich anmelden und Dokumente sehen, aber nicht bestellen. */
export async function blockCustomer(ctx: AuthContext, id: string, reason: string) {
  const before = await prisma.customer.findUnique({ where: { id } });
  if (!before) throw notFound();
  if (before.status === "BLOCKED") throw new AppError(409, "invalid_status");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.customer.update({ where: { id }, data: { status: "BLOCKED", blockedReason: reason } });
    await audit(ctx, { action: "customer.block", entityType: "Customer", entityId: id, before, after: updated }, tx);
    return updated;
  });
}

export async function unblockCustomer(ctx: AuthContext, id: string) {
  const before = await prisma.customer.findUnique({ where: { id } });
  if (!before) throw notFound();
  if (before.status !== "BLOCKED") throw new AppError(409, "invalid_status");
  const status: CustomerStatus = before.type === "B2B" && !before.approvedAt ? "PENDING_APPROVAL" : "ACTIVE";
  return prisma.$transaction(async (tx) => {
    const updated = await tx.customer.update({ where: { id }, data: { status, blockedReason: null } });
    await audit(ctx, { action: "customer.unblock", entityType: "Customer", entityId: id, before, after: updated }, tx);
    return updated;
  });
}

/** Zahlungsziel/Kreditlimit/Gruppe für bereits freigegebene Händler ändern. */
export async function updateCustomerCredit(ctx: AuthContext, id: string, input: ApproveCustomer) {
  const before = await prisma.customer.findUnique({ where: { id } });
  if (!before) throw notFound();
  if (before.type !== "B2B") throw badRequest("not_b2b");
  const group = await prisma.customerGroup.findFirst({ where: { id: input.groupId, active: true } });
  if (!group) throw badRequest("invalid_group");
  return prisma.$transaction(async (tx) => {
    const updated = await tx.customer.update({
      where: { id },
      data: {
        groupId: input.groupId,
        paymentTermDays: input.paymentTermDays,
        creditLimitAgorot: input.creditLimitAgorot,
        allowOnAccount: input.allowOnAccount,
      },
    });
    await audit(ctx, { action: "customer.update_credit", entityType: "Customer", entityId: id, before, after: updated }, tx);
    return updated;
  });
}

/** Stammdaten ändern (Verwaltung). Telefonänderung gilt auch für die Anmeldung des Inhabers. */
export async function updateCustomerMaster(ctx: AuthContext, id: string, input: CustomerUpdate) {
  const before = await prisma.customer.findUnique({ where: { id }, include: { members: { where: { role: "OWNER" }, select: { userId: true, user: { select: { phone: true } } } } } });
  if (!before) throw notFound();
  const owner = before.members[0];
  if (input.phone !== before.phone || (owner && owner.user.phone !== input.phone)) {
    const taken = await prisma.user.findUnique({ where: { phone: input.phone }, select: { id: true } });
    if (taken && taken.id !== owner?.userId) throw conflict("phone_already_registered");
  }
  const b2b = before.type === "B2B";
  if (b2b && input.dealerNumber && input.dealerNumber !== before.dealerNumber) {
    const dup = await prisma.customer.findFirst({ where: { dealerNumber: input.dealerNumber, id: { not: id } }, select: { id: true } });
    if (dup) throw conflict("dealer_number_taken");
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.customer.update({
      where: { id },
      data: {
        displayName: input.displayName,
        phone: input.phone,
        email: input.email ?? null,
        preferredLocale: input.preferredLocale,
        ...(b2b ? { companyName: input.companyName ?? null, ownerName: input.ownerName ?? null, dealerNumber: input.dealerNumber ?? null } : {}),
      },
    });
    if (owner && owner.user.phone !== input.phone) {
      await tx.user.update({ where: { id: owner.userId }, data: { phone: input.phone, phoneVerifiedAt: null } });
    }
    const { members: _m, ...plainBefore } = before;
    await audit(ctx, { action: "customer.update", entityType: "Customer", entityId: id, before: plainBefore, after: updated }, tx);
    return updated;
  });
}

type AddressBody = z.infer<typeof addressCreateSchema>;

export async function saveCustomerAddress(ctx: AuthContext, customerId: string, input: AddressBody, addressId?: string) {
  if (!(await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } }))) throw notFound();
  const zoneId = await resolveZoneId(input.city, input.zoneId);
  const before = addressId ? await prisma.address.findFirst({ where: { id: addressId, customerId } }) : null;
  if (addressId && !before) throw notFound();
  const hasDefault = await prisma.address.count({ where: { customerId, isDefault: true, id: addressId ? { not: addressId } : undefined } });
  return prisma.$transaction(async (tx) => {
    const isDefault = input.isDefault || hasDefault === 0;
    if (isDefault) await tx.address.updateMany({ where: { customerId }, data: { isDefault: false } });
    const data = { ...input, zoneId, isDefault };
    const a = addressId ? await tx.address.update({ where: { id: addressId }, data }) : await tx.address.create({ data: { ...data, customerId } });
    await audit(ctx, { action: addressId ? "address.update" : "address.create", entityType: "Address", entityId: a.id, before, after: a }, tx);
    return a;
  });
}

export async function deleteCustomerAddress(ctx: AuthContext, customerId: string, addressId: string) {
  const a = await prisma.address.findFirst({ where: { id: addressId, customerId } });
  if (!a) throw notFound();
  if ((await prisma.address.count({ where: { customerId } })) <= 1) throw badRequest("last_address");
  await prisma.$transaction(async (tx) => {
    await tx.address.delete({ where: { id: addressId } });
    if (a.isDefault) {
      const next = await tx.address.findFirst({ where: { customerId }, orderBy: { createdAt: "asc" } });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    await audit(ctx, { action: "address.delete", entityType: "Address", entityId: addressId, before: a }, tx);
  });
  return { ok: true };
}

export async function addCustomerNote(ctx: AuthContext, id: string, body: string) {
  if (!(await prisma.customer.findUnique({ where: { id }, select: { id: true } }))) throw notFound();
  return prisma.$transaction(async (tx) => {
    const note = await tx.customerNote.create({ data: { customerId: id, authorId: ctx.user.id, body } });
    await audit(ctx, { action: "customer.note", entityType: "Customer", entityId: id, after: note }, tx);
    return note;
  });
}

/** Kennzahlen für die Kundendetailseite: Umsatz (Jahr), offene Posten, letzte Bestellungen */
export async function customerFinance(customerId: string) {
  const yearStart = startOfBusinessDay(`${businessDate(new Date()).slice(0, 4)}-01-01`);
  const [inv, cn, open, orders] = await Promise.all([
    prisma.invoice.aggregate({ where: { customerId, issueDate: { gte: yearStart } }, _sum: { subtotalNet: true } }),
    prisma.creditNote.aggregate({ where: { customerId, issueDate: { gte: yearStart } }, _sum: { subtotalNet: true } }),
    prisma.invoice.findMany({ where: { customerId, status: { in: ["ISSUED", "PARTIALLY_PAID"] } }, orderBy: { dueDate: "asc" }, select: { id: true, number: true, dueDate: true, totalGross: true, paidAmount: true, creditedAmount: true } }),
    prisma.order.findMany({ where: { customerId }, orderBy: { placedAt: "desc" }, take: 8, select: { id: true, number: true, status: true, placedAt: true, totalGross: true } }),
  ]);
  const now = new Date();
  const items = open.map((i) => ({ ...i, open: invoiceOpenAmount(i), overdue: i.dueDate < now }));
  return {
    revenueYtd: (inv._sum.subtotalNet ?? 0) - (cn._sum.subtotalNet ?? 0),
    openTotal: items.reduce((a, i) => a + i.open, 0),
    overdueTotal: items.filter((i) => i.overdue).reduce((a, i) => a + i.open, 0),
    openItems: items,
    orders,
  };
}

/** Verwaltung setzt ein neues Kunden-Passwort (z. B. nach Anfrage per WhatsApp) – für den Inhaber des Kontos */
export async function setCustomerPassword(ctx: AuthContext, customerId: string, password: string) {
  const owner = await prisma.customerMember.findFirst({ where: { customerId, role: "OWNER" }, select: { userId: true } });
  if (!owner) throw notFound();
  const { hashPassword } = await import("../auth/password");
  const { revokeAllSessions } = await import("../auth/session");
  await prisma.user.update({ where: { id: owner.userId }, data: { passwordHash: await hashPassword(password) } });
  await revokeAllSessions(owner.userId);
  await audit(ctx, { action: "customer.password_set", entityType: "Customer", entityId: customerId });
  return { ok: true };
}
