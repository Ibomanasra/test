"use client";

import { useTranslations } from "next-intl";
import { Alert, Button, Input, Table, Td, Th } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

export interface PaymentMethodRow {
  id: string;
  method: "CASH_ON_DELIVERY" | "BANK_TRANSFER" | "CARD_GATEWAY" | "ON_ACCOUNT";
  channel: "B2C" | "B2B";
  enabled: boolean;
  labelAr: string;
  labelEn: string;
  sortOrder: number;
}

export function PaymentMethodsEditor({ rows, canEdit }: { rows: PaymentMethodRow[]; canEdit: boolean }) {
  const t = useTranslations("admin.settings");
  const tc = useTranslations("common");
  const tAll = useTranslations();
  const router = useRouter();
  const { call, pending, error } = useApi();

  async function save(e: React.FormEvent<HTMLFormElement>, row: PaymentMethodRow) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await call(`/api/v1/admin/settings/payment-methods/${row.id}`, {
      method: "PUT",
      body: {
        enabled: fd.get("enabled") === "on",
        labelAr: String(fd.get("labelAr")),
        labelEn: String(fd.get("labelEn")),
        sortOrder: Number(fd.get("sortOrder") ?? 0),
      },
    });
    if (res) router.refresh();
  }

  return (
    <div className="space-y-4">
      {error ? <Alert tone="red">{error}</Alert> : null}
      <Table>
        <thead>
          <tr>
            <Th>{t("channel")}</Th>
            <Th>{t("method")}</Th>
            <Th>{t("nameAr")}</Th>
            <Th>{t("nameEn")}</Th>
            <Th>{t("sortOrder")}</Th>
            <Th>{t("enabled")}</Th>
            <Th />
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((r) => {
            const locked = r.method === "ON_ACCOUNT" && r.channel === "B2C";
            const formId = `pm-${r.id}`;
            return (
              <tr key={r.id}>
                <Td>{tAll(`channel.${r.channel}`)}</Td>
                <Td>{tAll(`paymentMethod.${r.method}`)}</Td>
                <Td><Input form={formId} name="labelAr" dir="rtl" defaultValue={r.labelAr} disabled={!canEdit} required /></Td>
                <Td><Input form={formId} name="labelEn" dir="ltr" defaultValue={r.labelEn} disabled={!canEdit} required /></Td>
                <Td><Input form={formId} name="sortOrder" type="number" min={0} dir="ltr" className="num w-20" defaultValue={r.sortOrder} disabled={!canEdit} /></Td>
                <Td><input form={formId} type="checkbox" name="enabled" defaultChecked={r.enabled} disabled={!canEdit || locked} className="size-4 accent-brand-700" /></Td>
                <Td>
                  {canEdit ? (
                    <form id={formId} onSubmit={(e) => void save(e, r)}>
                      <Button size="sm" variant="secondary" type="submit" disabled={pending}>{tc("save")}</Button>
                    </form>
                  ) : null}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
