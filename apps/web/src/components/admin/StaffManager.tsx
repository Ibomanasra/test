"use client";

import { formatPhone } from "@sa/core";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Badge, Button, Card, Field, Input, Num, Select, Table, Td, Th } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

interface Role {
  id: string;
  name: string;
}
interface Staff {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  roleIds: string[];
}

export function StaffManager({ staff, roles, currentUserId }: { staff: Staff[]; roles: Role[]; currentUserId: string }) {
  const t = useTranslations("admin.users");
  const tc = useTranslations("common");
  const ta = useTranslations("auth");
  const format = useFormatter();
  const router = useRouter();
  const locale = useLocale();
  const { call, pending, error } = useApi();
  const [editing, setEditing] = useState<Staff | "new" | null>(null);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const roleIds = fd.getAll("roleIds").map(String);
    const body = {
      name: String(fd.get("name")),
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
      roleIds,
      ...(editing === "new" ? { phone: String(fd.get("phone")), locale: String(fd.get("locale") ?? locale) } : {}),
    };
    const res =
      editing === "new"
        ? await call("/api/v1/admin/users", { body })
        : await call(`/api/v1/admin/users/${(editing as Staff).id}`, { method: "PATCH", body });
    if (res) {
      setEditing(null);
      router.refresh();
    }
  }

  async function toggleActive(s: Staff) {
    const res = await call(`/api/v1/admin/users/${s.id}`, { method: "PATCH", body: { isActive: !s.isActive } });
    if (res) router.refresh();
  }

  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? id;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")} data-testid="new-staff">{t("new")}</Button>
      </div>
      {error ? <Alert tone="red">{error}</Alert> : null}

      {editing ? (
        <Card title={editing === "new" ? t("new") : editing.name}>
          <form method="post" className="grid gap-4 sm:grid-cols-2" onSubmit={save} key={editing === "new" ? "new" : editing.id}>
            <Field label={tc("name")} htmlFor="s-name">
              <Input id="s-name" name="name" required minLength={2} defaultValue={editing === "new" ? "" : editing.name} />
            </Field>
            {editing === "new" ? (
              <Field label={tc("phone")} htmlFor="s-phone">
                <Input id="s-phone" name="phone" type="tel" dir="ltr" className="num" required />
              </Field>
            ) : (
              <Field label={tc("phone")}>
                <p className="num py-2.5">{formatPhone(editing.phone)}</p>
              </Field>
            )}
            <Field label={tc("email")} htmlFor="s-email">
              <Input id="s-email" name="email" type="email" dir="ltr" defaultValue={editing === "new" ? "" : (editing.email ?? "")} />
            </Field>
            <Field
              label={editing === "new" ? ta("password") : t("newPassword")}
              htmlFor="s-password"
              hint={editing === "new" ? t("passwordHint") : `${t("keepPassword")} – ${t("passwordHint")}`}
            >
              <Input id="s-password" name="password" type="password" autoComplete="new-password" required={editing === "new"} minLength={10} />
            </Field>
            {editing === "new" ? (
              <Field label={t("preferredLanguage")} htmlFor="s-locale">
                <Select id="s-locale" name="locale" defaultValue={locale}>
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </Select>
              </Field>
            ) : null}
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-sm font-medium text-ink-700">{t("roles")}</legend>
              <div className="flex flex-wrap gap-3">
                {roles.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm ring-1 ring-ink-200">
                    <input type="checkbox" name="roleIds" value={r.id} defaultChecked={editing !== "new" && editing.roleIds.includes(r.id)} className="size-4 accent-brand-700" />
                    {r.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={pending}>{tc("save")}</Button>
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>{tc("cancel")}</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Table>
        <thead>
          <tr>
            <Th>{tc("name")}</Th>
            <Th>{tc("phone")}</Th>
            <Th>{t("roles")}</Th>
            <Th>{tc("status")}</Th>
            <Th>{t("lastLogin")}</Th>
            <Th>{tc("actions")}</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {staff.map((s) => (
            <tr key={s.id} data-testid="staff-row">
              <Td>{s.name}</Td>
              <Td><Num>{formatPhone(s.phone)}</Num></Td>
              <Td><div className="flex flex-wrap gap-1">{s.roleIds.map((r) => <Badge key={r} tone="brand">{roleName(r)}</Badge>)}</div></Td>
              <Td><Badge tone={s.isActive ? "green" : "neutral"}>{s.isActive ? tc("active") : tc("inactive")}</Badge></Td>
              <Td><Num>{s.lastLoginAt ? format.dateTime(new Date(s.lastLoginAt), "short") : "–"}</Num></Td>
              <Td>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setEditing(s)}>{tc("edit")}</Button>
                  {s.id !== currentUserId ? (
                    <Button size="sm" variant={s.isActive ? "danger" : "secondary"} disabled={pending} onClick={() => void toggleActive(s)}>
                      {s.isActive ? t("deactivate") : t("activate")}
                    </Button>
                  ) : null}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
