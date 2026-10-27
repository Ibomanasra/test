"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui";

export interface PrintTableData {
  title: string | { ar: string; en: string };
  subtitle?: string;
  columns: { key: string; label: string; kind?: "text" | "num" | "money" }[];
  rows: Record<string, string | number | null>[];
  landscape?: boolean;
}

/** Druckt die angezeigte Liste als A4-PDF (Vorschau in neuem Tab) */
export function PrintTableButton({ data, size = "sm" }: { data: PrintTableData; size?: "sm" | "md" }) {
  const t = useTranslations("print");
  const locale = useLocale();
  const [pending, setPending] = useState(false);

  async function print() {
    // Fenster sofort öffnen (Popup-Blocker), Inhalt nach dem Rendern setzen
    const win = window.open("", "_blank");
    setPending(true);
    try {
      const res = await fetch(`/api/v1/print/table?lang=${locale}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error(String(res.status));
      const url = URL.createObjectURL(await res.blob());
      if (win) win.location.href = url;
      else window.location.href = url;
    } catch {
      win?.close();
      alert(t("failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="secondary" size={size} onClick={() => void print()} disabled={pending} data-testid="print-table">
      <span aria-hidden="true">🖨 </span>
      {pending ? t("rendering") : t("button")}
    </Button>
  );
}
