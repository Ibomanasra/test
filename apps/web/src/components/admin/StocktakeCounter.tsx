"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Alert, Button, Input, Table, Td, Th } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

interface Line {
  id: string;
  bin: string;
  sku: string;
  name: string;
  expected: number;
  counted: number | null;
}

/** Zählerfassung (blind: Soll erst nach Abschluss sichtbar); Suche per SKU/Barcode-Scanner */
export function StocktakeCounter({ stocktakeId, lines, editable }: { stocktakeId: string; lines: Line[]; editable: boolean }) {
  const t = useTranslations("admin.stock");
  const locale = useLocale();
  const router = useRouter();
  const { call, pending, error } = useApi();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(lines.map((l) => [l.id, l.counted == null ? "" : String(l.counted)])));
  const [filter, setFilter] = useState("");
  const [saved, setSaved] = useState(false);
  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? lines.filter((l) => l.sku.toLowerCase().includes(f) || l.bin.toLowerCase().includes(f) || l.name.toLowerCase().includes(f)) : lines;
  }, [filter, lines]);

  async function save() {
    const body = { lines: lines.map((l) => ({ lineId: l.id, countedQty: values[l.id] === "" ? null : Number(values[l.id]) })) };
    if (await call(`/api/v1/admin/stocktakes/${stocktakeId}`, { method: "PUT", body, locale })) {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t("countFilter")} className="max-w-xs" dir="ltr" />
        {editable ? <Button onClick={() => void save()} disabled={pending} data-testid="save-counts">{t("saveCounts")}</Button> : null}
        {saved ? <span className="text-sm text-green-700">✓</span> : null}
      </div>
      {error ? <Alert tone="red">{error}</Alert> : null}
      <Table>
        <thead>
          <tr>
            <Th>{t("bin")}</Th>
            <Th>SKU</Th>
            <Th>{t("product")}</Th>
            {!editable ? <Th>{t("expected")}</Th> : null}
            <Th>{t("counted")}</Th>
            {!editable ? <Th>{t("difference")}</Th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {shown.map((l) => {
            const diff = l.counted == null ? null : l.counted - l.expected;
            return (
              <tr key={l.id} data-testid="count-row">
                <Td className="num">{l.bin || "–"}</Td>
                <Td className="num">{l.sku}</Td>
                <Td>{l.name}</Td>
                {!editable ? <Td className="num">{l.expected}</Td> : null}
                <Td>
                  {editable ? (
                    <Input type="number" min={0} dir="ltr" className="num w-24" value={values[l.id] ?? ""} onChange={(e) => { setValues({ ...values, [l.id]: e.target.value }); setSaved(false); }} aria-label={`${t("counted")} ${l.sku}`} />
                  ) : (
                    <span className="num">{l.counted ?? "–"}</span>
                  )}
                </Td>
                {!editable ? <Td className={`num ${diff ? (diff > 0 ? "text-green-700" : "text-red-700") : ""}`}>{diff == null ? "–" : diff > 0 ? `+${diff}` : diff}</Td> : null}
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
