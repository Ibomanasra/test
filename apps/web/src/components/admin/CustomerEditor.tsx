"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "@/components/admin/Icon";
import { CityZoneFields } from "@/components/shared/CityZoneFields";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

export interface CustomerMaster {
  id: string;
  type: "B2C" | "B2B";
  displayName: string;
  companyName: string | null;
  ownerName: string | null;
  dealerNumber: string | null;
  phone: string;
  email: string | null;
  preferredLocale: "ar" | "en" | "he";
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Karte „Stammdaten“: Anzeige (children) oder Bearbeitungsformular */
export function CustomerMasterCard({ c, canEdit, title, children }: { c: CustomerMaster; canEdit: boolean; title: string; children: ReactNode }) {
  const t = useTranslations("admin.customers");
  const tc = useTranslations("common");
  const tr = useTranslations("register");
  const router = useRouter();
  const { call, pending, error } = useApi();
  const [edit, setEdit] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      displayName: str(f, "displayName"),
      companyName: str(f, "companyName"),
      ownerName: str(f, "ownerName"),
      dealerNumber: str(f, "dealerNumber"),
      phone: str(f, "phone"),
      email: str(f, "email"),
      preferredLocale: str(f, "preferredLocale"),
    };
    if (await call(`/api/v1/admin/customers/${c.id}`, { method: "PUT", body })) {
      setEdit(false);
      router.refresh();
    }
  }

  return (
    <Card
      title={title}
      actions={canEdit && !edit ? (
        <Button size="sm" variant="secondary" onClick={() => setEdit(true)} data-testid="edit-master">
          <Icon name="edit" className="size-4" /> {tc("edit")}
        </Button>
      ) : null}
    >
      {edit ? (
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" data-testid="master-form">
          <Field label={t("displayName")} htmlFor="m-displayName" className="sm:col-span-2">
            <Input id="m-displayName" name="displayName" required minLength={2} defaultValue={c.displayName} />
          </Field>
          {c.type === "B2B" ? (
            <>
              <Field label={tr("companyName")} htmlFor="m-companyName"><Input id="m-companyName" name="companyName" defaultValue={c.companyName ?? ""} /></Field>
              <Field label={tr("ownerName")} htmlFor="m-ownerName"><Input id="m-ownerName" name="ownerName" defaultValue={c.ownerName ?? ""} /></Field>
              <Field label={tr("dealerNumber")} htmlFor="m-dealerNumber">
                <Input id="m-dealerNumber" name="dealerNumber" inputMode="numeric" dir="ltr" className="num text-start" pattern="[0-9]{6,12}" defaultValue={c.dealerNumber ?? ""} />
              </Field>
            </>
          ) : null}
          <Field label={tc("phone")} htmlFor="m-phone" hint={t("phoneLoginHint")}>
            <Input id="m-phone" name="phone" type="tel" dir="ltr" className="num text-start" required defaultValue={c.phone} />
          </Field>
          <Field label={tc("email")} htmlFor="m-email"><Input id="m-email" name="email" type="email" dir="ltr" className="text-start" defaultValue={c.email ?? ""} /></Field>
          <Field label={t("language")} htmlFor="m-locale">
            <Select id="m-locale" name="preferredLocale" defaultValue={c.preferredLocale}>
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </Select>
          </Field>
          {error ? <div className="sm:col-span-2"><Alert tone="red">{error}</Alert></div> : null}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={pending} data-testid="save-master">{tc("save")}</Button>
            <Button type="button" variant="ghost" onClick={() => setEdit(false)}>{tc("cancel")}</Button>
          </div>
        </form>
      ) : children}
    </Card>
  );
}

export interface AddressItem {
  id: string;
  label: string | null;
  recipient: string;
  phone: string;
  phoneText: string;
  city: string;
  street: string | null;
  details: string | null;
  zoneId: string;
  zoneName: string;
  isDefault: boolean;
}

/** Adressen des Kunden: anzeigen, bearbeiten, hinzufügen, löschen */
export function CustomerAddresses({ customerId, addresses, zones, canEdit, title }: { customerId: string; addresses: AddressItem[]; zones: { id: string; name: string }[]; canEdit: boolean; title: string }) {
  const t = useTranslations("admin.customers");
  const tc = useTranslations("common");
  const tr = useTranslations("register");
  const tco = useTranslations("shop.checkout");
  const router = useRouter();
  const { call, pending, error } = useApi();
  const [editing, setEditing] = useState<string | null>(null); // Adress-ID oder "new"

  async function submit(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      zoneId: str(f, "zoneId"),
      label: str(f, "label") || undefined,
      recipient: str(f, "recipient"),
      phone: str(f, "phone"),
      city: str(f, "city"),
      street: str(f, "street") || undefined,
      details: str(f, "details") || undefined,
      isDefault: f.get("isDefault") === "on",
    };
    const path = `/api/v1/admin/customers/${customerId}/addresses${id === "new" ? "" : `/${id}`}`;
    if (await call(path, { method: id === "new" ? "POST" : "PUT", body })) {
      setEditing(null);
      router.refresh();
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t("deleteAddressConfirm"))) return;
    if (await call(`/api/v1/admin/customers/${customerId}/addresses/${id}`, { method: "DELETE" })) router.refresh();
  }

  const form = (a: AddressItem | null, id: string) => (
    <form onSubmit={(e) => submit(e, id)} className="grid gap-3 rounded-xl bg-ink-50 p-4 sm:grid-cols-2" data-testid="address-form">
      <Field label={tco("recipient")} htmlFor={`${id}-rec`}><Input id={`${id}-rec`} name="recipient" required minLength={2} defaultValue={a?.recipient} /></Field>
      <Field label={tc("phone")} htmlFor={`${id}-phone`}><Input id={`${id}-phone`} name="phone" type="tel" dir="ltr" className="num text-start" required defaultValue={a?.phone} /></Field>
      <CityZoneFields zones={zones} idPrefix={`${id}-`} defaultCity={a?.city} defaultZoneId={a?.zoneId} />
      <Field label={tr("street")} htmlFor={`${id}-street`}><Input id={`${id}-street`} name="street" defaultValue={a?.street ?? ""} /></Field>
      <Field label={tr("details")} htmlFor={`${id}-details`}><Input id={`${id}-details`} name="details" defaultValue={a?.details ?? ""} /></Field>
      <Field label={t("addressLabel")} htmlFor={`${id}-label`}><Input id={`${id}-label`} name="label" defaultValue={a?.label ?? ""} /></Field>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input type="checkbox" name="isDefault" defaultChecked={a?.isDefault ?? false} className="accent-brand-700" /> {t("defaultAddress")}
      </label>
      {error ? <div className="sm:col-span-2"><Alert tone="red">{error}</Alert></div> : null}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending} data-testid="save-address">{tc("save")}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>{tc("cancel")}</Button>
      </div>
    </form>
  );

  return (
    <Card
      title={title}
      actions={canEdit && editing !== "new" ? (
        <Button size="sm" variant="secondary" onClick={() => setEditing("new")} data-testid="add-address">
          <Icon name="plus" className="size-4" /> {t("addAddress")}
        </Button>
      ) : null}
    >
      <ul className="space-y-2 text-sm">
        {editing === "new" ? <li>{form(null, "new")}</li> : null}
        {addresses.map((a) => (
          <li key={a.id}>
            {editing === a.id ? form(a, a.id) : (
              <div className="flex flex-wrap items-start gap-3 rounded-xl bg-ink-50 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink-900">
                    {a.city} <span className="text-ink-500">· {a.zoneName}</span>
                    {a.isDefault ? <span className="ms-2 rounded-full bg-brand-100 px-2 py-px text-xs text-brand-800">{t("defaultAddress")}</span> : null}
                  </p>
                  <p className="text-ink-600">{[a.label, a.street, a.details].filter(Boolean).join("، ")}</p>
                  <p className="text-ink-500">{a.recipient} · <span className="num">{a.phoneText}</span></p>
                </div>
                {canEdit ? (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(a.id)} aria-label={tc("edit")} data-testid="edit-address"><Icon name="edit" className="size-4" /></Button>
                    {addresses.length > 1 ? <Button size="sm" variant="ghost" onClick={() => remove(a.id)} className="text-red-700">{tc("delete")}</Button> : null}
                  </div>
                ) : null}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Neues Passwort für den Kunden setzen (Login: Telefon + Passwort) */
export function CustomerPasswordCard({ customerId, phone }: { customerId: string; phone: string }) {
  const t = useTranslations("admin.customers");
  const tc = useTranslations("common");
  const { call, pending, error } = useApi();
  const [done, setDone] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const password = String(new FormData(form).get("password") ?? "");
    if (await call(`/api/v1/admin/customers/${customerId}/password`, { body: { password } })) {
      setDone(true);
      form.reset();
    }
  }
  return (
    <Card title={t("loginTitle")}>
      <p className="mb-3 text-sm text-ink-600">{t("loginText", { phone })}</p>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2" data-testid="customer-password">
        <Field label={t("newPassword")} htmlFor="c-pw"><Input id="c-pw" name="password" type="text" autoComplete="off" required minLength={8} dir="ltr" className="font-mono" /></Field>
        <Button type="submit" disabled={pending}>{tc("save")}</Button>
      </form>
      {done ? <p className="mt-2 text-sm text-green-700">{t("passwordSet")}</p> : null}
      {error ? <div className="mt-2"><Alert tone="red">{error}</Alert></div> : null}
    </Card>
  );
}
