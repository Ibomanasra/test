"use client";

import { useTranslations } from "next-intl";
import { Input, cn } from "@/components/ui";

export interface CompanyChoice {
  companyId: string;
  newName: string;
  /** „+ neue Firma“ ist geöffnet */
  adding: boolean;
}

export const emptyChoice = (companies: { id: string }[]): CompanyChoice => ({ companyId: companies.length === 1 ? companies[0]!.id : "", newName: "", adding: companies.length === 0 });

export function choiceBody(c: CompanyChoice) {
  return c.adding ? { newCompanyName: c.newName.trim() || undefined } : { companyId: c.companyId || undefined };
}

export const choiceReady = (c: CompanyChoice) => (c.adding ? c.newName.trim().length >= 2 : Boolean(c.companyId));

/** Große Auswahlknöpfe: an welche Zustellfirma übergeben wird (+ neue Firma direkt anlegen) */
export function CompanyPicker({ companies, value, onChange }: { companies: { id: string; name: string }[]; value: CompanyChoice; onChange: (c: CompanyChoice) => void }) {
  const t = useTranslations("admin.companies");
  const chip = (active: boolean) => cn("rounded-xl px-4 py-2.5 text-sm font-medium ring-1 transition", active ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-ink-800 ring-ink-300 hover:bg-ink-50");
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-ink-800">{t("pick")}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup">
        {companies.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={!value.adding && value.companyId === c.id} className={chip(!value.adding && value.companyId === c.id)} onClick={() => onChange({ ...value, companyId: c.id, adding: false })} data-testid="company-chip">
            🚚 {c.name}
          </button>
        ))}
        <button type="button" className={chip(value.adding)} onClick={() => onChange({ ...value, adding: true })} data-testid="company-new">＋ {t("new")}</button>
      </div>
      {value.adding ? (
        <Input value={value.newName} onChange={(e) => onChange({ ...value, newName: e.target.value })} placeholder={t("namePlaceholder")} className="max-w-sm" autoFocus aria-label={t("name")} data-testid="company-new-name" />
      ) : null}
    </div>
  );
}
