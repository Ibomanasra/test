import "server-only";
import { DOC_PREFIX, DOC_TYPES, DEFAULT_PADDING, GAPLESS_DOC_TYPES, businessYear, type DocTypeKey } from "@sa/core";
import type { autoPrintRuleSchema, bankAccountSchema, documentTextSchema, sequenceUpdateSchema, taxInvoiceFieldsSchema } from "@sa/contracts";
import { prisma } from "@sa/db";
import type { z } from "zod";
import { sniffMimeType, storeFile } from "../adapters/storage";
import { audit } from "../audit";
import type { AuthContext } from "../auth/context";
import { AppError, badRequest, notFound } from "../errors";

/** Einstellungen → Dokumente: Logo, Bankdaten, Texte, Nummernkreise, Auto-Druck, Steuerrechnung */

// --- Bankkonten --------------------------------------------------------------

export function listBankAccounts() {
  return prisma.bankAccount.findMany({ orderBy: [{ sortOrder: "asc" }, { bankNameEn: "asc" }] });
}

export async function saveBankAccount(ctx: AuthContext, id: string | null, input: z.infer<typeof bankAccountSchema>) {
  const data = { ...input, branch: input.branch ?? null, iban: input.iban ?? null, swift: input.swift ?? null };
  const before = id ? await prisma.bankAccount.findUnique({ where: { id } }) : null;
  if (id && !before) throw notFound();
  const row = id ? await prisma.bankAccount.update({ where: { id }, data }) : await prisma.bankAccount.create({ data });
  await audit(ctx, { action: id ? "settings.bank.update" : "settings.bank.create", entityType: "BankAccount", entityId: row.id, before, after: row });
  return row;
}

export async function deleteBankAccount(ctx: AuthContext, id: string) {
  const before = await prisma.bankAccount.findUnique({ where: { id } });
  if (!before) throw notFound();
  await prisma.bankAccount.delete({ where: { id } });
  await audit(ctx, { action: "settings.bank.delete", entityType: "BankAccount", entityId: id, before });
}

// --- Dokumenttexte -----------------------------------------------------------

export function listDocumentTexts() {
  return prisma.documentTemplateText.findMany({ orderBy: [{ docType: "asc" }, { locale: "asc" }] });
}

export async function saveDocumentText(ctx: AuthContext, input: z.infer<typeof documentTextSchema>) {
  const data = { titleText: input.titleText ?? null, headerText: input.headerText ?? null, footerText: input.footerText ?? null, termsText: input.termsText ?? null };
  const row = await prisma.documentTemplateText.upsert({
    where: { docType_locale: { docType: input.docType, locale: input.locale } },
    create: { docType: input.docType, locale: input.locale, ...data },
    update: data,
  });
  await audit(ctx, { action: "settings.document_text", entityType: "DocumentTemplateText", entityId: row.id, after: row });
  return row;
}

export async function deleteDocumentText(ctx: AuthContext, id: string) {
  const before = await prisma.documentTemplateText.findUnique({ where: { id } });
  if (!before) throw notFound();
  await prisma.documentTemplateText.delete({ where: { id } });
  await audit(ctx, { action: "settings.document_text.delete", entityType: "DocumentTemplateText", entityId: id, before });
}

// --- Nummernkreise -----------------------------------------------------------

/** Alle Belegarten mit Stand des laufenden Jahres (Zeile entsteht beim ersten Beleg) */
export async function listSequences() {
  const year = businessYear(new Date());
  const rows = await prisma.numberSequence.findMany({ orderBy: { year: "desc" } });
  return DOC_TYPES.map((docType) => {
    const current = rows.find((r) => r.docType === docType && r.year === year);
    const latest = rows.find((r) => r.docType === docType);
    return {
      docType,
      year,
      prefix: current?.prefix ?? latest?.prefix ?? DOC_PREFIX[docType],
      padding: current?.padding ?? latest?.padding ?? DEFAULT_PADDING,
      nextNumber: current?.nextNumber ?? 1,
      gapless: GAPLESS_DOC_TYPES.has(docType),
    };
  });
}

/**
 * Präfix/Stellen ändern. Gilt ab dem nächsten Beleg. Lückenlose Belegarten (Rechnung,
 * Gutschrift) nur, solange im laufenden Jahr noch keine Nummer vergeben wurde.
 */
export async function updateSequence(ctx: AuthContext, docType: string, input: z.infer<typeof sequenceUpdateSchema>) {
  if (!(DOC_TYPES as readonly string[]).includes(docType)) throw notFound();
  const key = docType as DocTypeKey;
  const year = businessYear(new Date());
  const current = await prisma.numberSequence.findUnique({ where: { docType_year: { docType: key, year } } });
  if (GAPLESS_DOC_TYPES.has(key) && current && current.nextNumber > 1 && (current.prefix !== input.prefix || current.padding !== input.padding)) {
    throw new AppError(409, "sequence_in_use");
  }
  const row = await prisma.numberSequence.upsert({
    where: { docType_year: { docType: key, year } },
    create: { docType: key, year, prefix: input.prefix, padding: input.padding, nextNumber: 1, gapless: GAPLESS_DOC_TYPES.has(key) },
    update: { prefix: input.prefix, padding: input.padding },
  });
  await audit(ctx, { action: "settings.sequence", entityType: "NumberSequence", entityId: row.id, before: current, after: row });
  return row;
}

// --- Auto-Druck --------------------------------------------------------------

export function listAutoPrintRules() {
  return prisma.autoPrintRule.findMany({ orderBy: [{ onStatus: "asc" }, { docType: "asc" }] });
}

export async function saveAutoPrintRule(ctx: AuthContext, id: string | null, input: z.infer<typeof autoPrintRuleSchema>) {
  const clash = await prisma.autoPrintRule.findUnique({ where: { onStatus_docType: { onStatus: input.onStatus, docType: input.docType } } });
  if (clash && clash.id !== id) throw new AppError(409, "duplicate");
  const row = id ? await prisma.autoPrintRule.update({ where: { id }, data: input }) : await prisma.autoPrintRule.create({ data: input });
  await audit(ctx, { action: "settings.auto_print", entityType: "AutoPrintRule", entityId: row.id, after: row });
  return row;
}

export async function deleteAutoPrintRule(ctx: AuthContext, id: string) {
  const before = await prisma.autoPrintRule.findUnique({ where: { id } });
  if (!before) throw notFound();
  await prisma.autoPrintRule.delete({ where: { id } });
  await audit(ctx, { action: "settings.auto_print.delete", entityType: "AutoPrintRule", entityId: id, before });
}

// --- Logo & Steuerrechnung ----------------------------------------------------

const LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function setCompanyLogo(ctx: AuthContext, file: File | null) {
  if (!file) {
    await prisma.companySettings.update({ where: { id: 1 }, data: { logoFileId: null } });
    await audit(ctx, { action: "settings.logo.remove", entityType: "CompanySettings", entityId: "1" });
    return { logoFileId: null };
  }
  if (file.size > 2 * 1024 * 1024) throw badRequest("file_too_large");
  const data = Buffer.from(await file.arrayBuffer());
  const mime = sniffMimeType(data);
  if (!mime || !LOGO_TYPES.has(mime)) throw badRequest("invalid_file_type");
  const stored = await storeFile({ data, mimeType: mime, originalName: file.name, purpose: "company-logo", uploadedById: ctx.user.id });
  await prisma.companySettings.update({ where: { id: 1 }, data: { logoFileId: stored.id } });
  await audit(ctx, { action: "settings.logo", entityType: "CompanySettings", entityId: "1", after: { fileId: stored.id } });
  return { logoFileId: stored.id };
}

export async function updateTaxInvoiceFields(ctx: AuthContext, input: z.infer<typeof taxInvoiceFieldsSchema>) {
  const before = await prisma.companySettings.findUniqueOrThrow({ where: { id: 1 }, select: { taxInvoiceFields: true } });
  const value = { ...((before.taxInvoiceFields ?? {}) as Record<string, unknown>), notesAr: input.notesAr ?? null, notesEn: input.notesEn ?? null };
  await prisma.companySettings.update({ where: { id: 1 }, data: { taxInvoiceFields: value } });
  await audit(ctx, { action: "settings.tax_invoice_fields", entityType: "CompanySettings", entityId: "1", before: before.taxInvoiceFields, after: value });
  return value;
}
