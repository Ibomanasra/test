import { hasPermission } from "@sa/core";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CrudManager } from "@/components/admin/CrudManager";
import { LogoForm, TaxInvoiceForm } from "@/components/admin/DocumentBrandingForms";
import { Forbidden } from "@/components/admin/Forbidden";
import { Card } from "@/components/ui";
import { staffPagePermission } from "@/server/auth/page-guards";
import { listAutoPrintRules, listBankAccounts, listDocumentTexts, listSequences } from "@/server/services/document-settings";
import { getCompanySettings } from "@/server/services/settings";

const TEXT_DOC_TYPES = ["QUOTE", "ORDER_CONFIRMATION", "PICK_LIST", "DELIVERY_NOTE", "INVOICE", "RECEIPT", "CREDIT_NOTE", "TOUR_SHEET", "CASH_CLOSING", "ACCOUNT_STATEMENT", "DUNNING", "PURCHASE_ORDER", "PRICE_LIST", "STOCKTAKE", "STOCK_LIST"] as const;
const AUTO_DOC_TYPES = ["ORDER_CONFIRMATION", "PICK_LIST", "DELIVERY_NOTE", "INVOICE"] as const;
const STATUSES = ["NEW", "CONFIRMED", "PICKING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"] as const;

export default async function DocumentSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "settings.view");
  if (!auth) return <Forbidden />;
  const canEdit = hasPermission(auth.permissions, "settings.edit");
  const [t, tc, tAll, company, banks, texts, sequences, rules] = await Promise.all([
    getTranslations("admin.settings.docs"),
    getTranslations("common"),
    getTranslations(),
    getCompanySettings(),
    listBankAccounts(),
    listDocumentTexts(),
    listSequences(),
    listAutoPrintRules(),
  ]);
  const docName = (d: string) => t(`docType.${d}`);
  const langName = (l: string) => t(`language.${l}`);
  const yes = (b: boolean) => (b ? "✓" : "–");
  const tif = (company.taxInvoiceFields ?? {}) as { notesAr?: string | null; notesEn?: string | null };
  const short = (s: string | null) => (s ? (s.length > 60 ? `${s.slice(0, 60)}…` : s) : "–");
  return (
    <div className="space-y-8">
      <LogoForm logoFileId={company.logoFileId} canEdit={canEdit} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("banks")}</h2>
        <p className="text-sm text-ink-600">{t("banksHint")}</p>
        <CrudManager
          endpoint="/api/v1/admin/settings/banks"
          canEdit={canEdit}
          createLabel={t("newBank")}
          testId="banks"
          defaults={{ showOnDocs: true, active: true, sortOrder: "0" }}
          fields={[
            { name: "bankNameAr", label: t("bankNameAr"), type: "text", required: true, dir: "rtl" },
            { name: "bankNameEn", label: t("bankNameEn"), type: "text", required: true, dir: "ltr" },
            { name: "branch", label: t("branch"), type: "text" },
            { name: "accountName", label: t("accountName"), type: "text", required: true },
            { name: "accountNo", label: t("accountNo"), type: "text", required: true, dir: "ltr" },
            { name: "iban", label: "IBAN", type: "text", dir: "ltr" },
            { name: "swift", label: "SWIFT/BIC", type: "text", dir: "ltr" },
            { name: "sortOrder", label: tAll("admin.settings.sortOrder"), type: "int" },
            { name: "showOnDocs", label: t("showOnDocs"), type: "checkbox" },
            { name: "active", label: tc("active"), type: "checkbox" },
          ]}
          columns={[
            { key: "bank", label: t("bank") },
            { key: "accountNo", label: t("accountNo"), className: "num" },
            { key: "iban", label: "IBAN", className: "num" },
            { key: "showOnDocs", label: t("showOnDocs") },
          ]}
          rows={banks.map((b) => ({
            id: b.id,
            tone: b.active ? undefined : "muted",
            values: { bankNameAr: b.bankNameAr, bankNameEn: b.bankNameEn, branch: b.branch ?? "", accountName: b.accountName, accountNo: b.accountNo, iban: b.iban ?? "", swift: b.swift ?? "", sortOrder: String(b.sortOrder), showOnDocs: b.showOnDocs, active: b.active },
            cells: { bank: `${locale === "ar" ? b.bankNameAr : b.bankNameEn}${b.branch ? ` (${b.branch})` : ""}`, accountNo: b.accountNo, iban: b.iban ?? "–", showOnDocs: yes(b.showOnDocs) },
          }))}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("sequences")}</h2>
        <p className="text-sm text-ink-600">{t("sequencesHint")}</p>
        <CrudManager
          endpoint="/api/v1/admin/settings/sequences"
          canEdit={canEdit}
          allowCreate={false}
          deletable={false}
          createLabel=""
          testId="sequences"
          fields={[
            { name: "prefix", label: t("prefix"), type: "text", required: true, dir: "ltr" },
            { name: "padding", label: t("padding"), type: "int", required: true },
          ]}
          columns={[
            { key: "doc", label: t("docTypeLabel") },
            { key: "example", label: t("example"), className: "num" },
            { key: "next", label: t("nextNumber"), className: "num" },
            { key: "gapless", label: t("gapless") },
          ]}
          rows={sequences.map((s) => ({
            id: s.docType,
            values: { prefix: s.prefix, padding: String(s.padding) },
            cells: { doc: docName(s.docType), example: `${s.prefix}-${s.year}-${String(s.nextNumber).padStart(s.padding, "0")}`, next: String(s.nextNumber), gapless: yes(s.gapless) },
          }))}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("texts")}</h2>
        <p className="text-sm text-ink-600">{t("textsHint")}</p>
        <CrudManager
          endpoint="/api/v1/admin/settings/document-texts"
          canEdit={canEdit}
          createLabel={t("newText")}
          testId="doc-texts"
          defaults={{ locale: "ar", docType: "INVOICE" }}
          fields={[
            { name: "docType", label: t("docTypeLabel"), type: "select", required: true, createOnly: true, options: TEXT_DOC_TYPES.map((d) => ({ value: d, label: docName(d) })) },
            { name: "locale", label: t("languageLabel"), type: "select", required: true, createOnly: true, options: [{ value: "ar", label: "العربية" }, { value: "en", label: "English" }] },
            { name: "titleText", label: t("titleText"), type: "text" },
            { name: "headerText", label: t("headerText"), type: "textarea" },
            { name: "termsText", label: t("termsText"), type: "textarea" },
            { name: "footerText", label: t("footerText"), type: "textarea" },
          ]}
          columns={[
            { key: "doc", label: t("docTypeLabel") },
            { key: "locale", label: t("languageLabel") },
            { key: "title", label: t("titleText") },
            { key: "terms", label: t("termsText") },
          ]}
          rows={texts.map((x) => ({
            id: x.id,
            values: { docType: x.docType, locale: x.locale, titleText: x.titleText ?? "", headerText: x.headerText ?? "", termsText: x.termsText ?? "", footerText: x.footerText ?? "" },
            cells: { doc: docName(x.docType), locale: x.locale === "ar" ? "العربية" : "English", title: short(x.titleText), terms: short(x.termsText) },
          }))}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("autoPrint")}</h2>
        <p className="text-sm text-ink-600">{t("autoPrintHint")}</p>
        <CrudManager
          endpoint="/api/v1/admin/settings/auto-print"
          canEdit={canEdit}
          createLabel={t("newRule")}
          testId="auto-print"
          defaults={{ onStatus: "CONFIRMED", docType: "PICK_LIST", language: "AR", withPrices: true, enabled: true }}
          fields={[
            { name: "onStatus", label: t("onStatus"), type: "select", required: true, options: STATUSES.map((s) => ({ value: s, label: tAll(`orderStatus.${s}`) })) },
            { name: "docType", label: t("docTypeLabel"), type: "select", required: true, options: AUTO_DOC_TYPES.map((d) => ({ value: d, label: docName(d) })) },
            { name: "language", label: t("languageLabel"), type: "select", required: true, options: ["AR", "EN", "BILINGUAL"].map((l) => ({ value: l, label: langName(l) })) },
            { name: "withPrices", label: t("withPrices"), type: "checkbox" },
            { name: "enabled", label: tc("active"), type: "checkbox" },
          ]}
          columns={[
            { key: "status", label: t("onStatus") },
            { key: "doc", label: t("docTypeLabel") },
            { key: "language", label: t("languageLabel") },
            { key: "withPrices", label: t("withPrices") },
          ]}
          rows={rules.map((r) => ({
            id: r.id,
            tone: r.enabled ? undefined : "muted",
            values: { onStatus: r.onStatus, docType: r.docType, language: r.language, withPrices: r.withPrices, enabled: r.enabled },
            cells: { status: tAll(`orderStatus.${r.onStatus}`), doc: docName(r.docType), language: langName(r.language), withPrices: yes(r.withPrices) },
          }))}
        />
      </section>

      <TaxInvoiceForm notesAr={tif.notesAr ?? ""} notesEn={tif.notesEn ?? ""} canEdit={canEdit} />
      <Card><p className="text-sm text-ink-600">{t("printJobsHint")}</p></Card>
    </div>
  );
}
