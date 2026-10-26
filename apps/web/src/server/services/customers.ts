import "server-only";
import type { ApproveCustomer, RegisterB2B, RegisterB2C } from "@sa/contracts";
import { nextCustomerNumber, prisma, type CustomerStatus, type CustomerType, type Locale, type Prisma } from "@sa/db";
import { smsAdapter } from "../adapters/sms";
import { sniffMimeType, storeFile } from "../adapters/storage";
import { audit } from "../audit";
import type { AuthContext } from "../auth/context";
import { env } from "../env";
import { AppError, badRequest, conflict, notFound } from "../errors";

async function assertPhoneFree(phone: string) {
  if (await prisma.user.findUnique({ where: { phone }, select: { id: true } })) throw conflict("phone_already_registered");
}

async function assertZone(zoneId: string) {
  const zone = await prisma.deliveryZone.findFirst({ where: { id: zoneId, active: true }, select: { id: true } });
  if (!zone) throw badRequest("invalid_zone");
}

/** Privatkunde: sofort aktiv. */
export async function registerB2C(phone: string, input: RegisterB2C) {
  await assertPhoneFree(phone);
  await assertZone(input.address.zoneId);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { kind: "CUSTOMER", phone, phoneVerifiedAt: new Date(), name: input.name, locale: input.locale },
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
        addresses: { create: { ...input.address, recipient: input.name, phone, isDefault: true } },
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
export async function registerB2B(phone: string, input: RegisterB2B, license: LicenseUpload) {
  await assertPhoneFree(phone);
  await assertZone(input.address.zoneId);
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
      data: { kind: "CUSTOMER", phone, phoneVerifiedAt: new Date(), name: input.name, locale: input.locale, email: input.email },
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
        addresses: { create: { ...input.address, recipient: input.ownerName, phone, isDefault: true } },
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
  },
  rejected: {
    ar: "نعتذر، لم تتم الموافقة على طلب حساب التاجر. يرجى التواصل معنا.",
    en: "Sorry, your business account request was not approved. Please contact us.",
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

export async function addCustomerNote(ctx: AuthContext, id: string, body: string) {
  if (!(await prisma.customer.findUnique({ where: { id }, select: { id: true } }))) throw notFound();
  return prisma.$transaction(async (tx) => {
    const note = await tx.customerNote.create({ data: { customerId: id, authorId: ctx.user.id, body } });
    await audit(ctx, { action: "customer.note", entityType: "Customer", entityId: id, after: note }, tx);
    return note;
  });
}
