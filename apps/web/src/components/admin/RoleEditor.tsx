"use client";

import { PERMISSIONS, WILDCARD } from "@sa/core";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Field, Input } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

export interface RoleRow {
  id: string;
  key: string;
  nameAr: string;
  nameEn: string;
  isSystem: boolean;
  permissions: string[];
  users: number;
}

const ALL = Object.keys(PERMISSIONS);

export function RoleEditor({ roles, locale }: { roles: RoleRow[]; locale: string }) {
  const t = useTranslations("admin.roles");
  const tc = useTranslations("common");
  const tp = useTranslations("permissions");
  const tg = useTranslations("permissionGroups");
  const router = useRouter();
  const { call, pending, error } = useApi();
  const [selected, setSelected] = useState<RoleRow | "new" | null>(null);
  const [perms, setPerms] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of ALL) {
      const g = p.split(".")[0]!;
      map.set(g, [...(map.get(g) ?? []), p]);
    }
    return [...map.entries()];
  }, []);

  function open(role: RoleRow | "new") {
    setSelected(role);
    setPerms(new Set(role === "new" ? [] : role.permissions));
  }

  function toggle(p: string) {
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      key: String(fd.get("key") ?? (selected !== "new" ? selected?.key : "")),
      nameAr: String(fd.get("nameAr")),
      nameEn: String(fd.get("nameEn")),
      permissions: [...perms],
    };
    const res = selected === "new" ? await call("/api/v1/admin/roles", { body }) : await call(`/api/v1/admin/roles/${(selected as RoleRow).id}`, { method: "PUT", body });
    if (res) {
      setSelected(null);
      router.refresh();
    }
  }

  async function remove(role: RoleRow) {
    const res = await call(`/api/v1/admin/roles/${role.id}`, { method: "DELETE" });
    if (res) router.refresh();
  }

  const isOwner = selected !== "new" && selected?.permissions.includes(WILDCARD);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-2">
        <Button onClick={() => open("new")} className="w-full">{t("new")}</Button>
        <ul className="space-y-2">
          {roles.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => open(r)}
                className="w-full rounded-xl bg-white p-3 text-start shadow-sm ring-1 ring-ink-200 hover:ring-brand-400"
                data-testid={`role-${r.key}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{locale === "ar" ? r.nameAr : r.nameEn}</span>
                  {r.isSystem ? <Badge>{t("system")}</Badge> : null}
                </div>
                <p className="mt-1 text-xs text-ink-500">
                  <span className="num">{r.key}</span> · {t("usersCount", { count: r.users })}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="lg:col-span-2">
        {error ? <div className="mb-4"><Alert tone="red">{error}</Alert></div> : null}
        {selected ? (
          <Card title={selected === "new" ? t("new") : locale === "ar" ? selected.nameAr : selected.nameEn}>
            <form onSubmit={save} className="space-y-5" key={selected === "new" ? "new" : selected.id}>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={t("key")} htmlFor="key">
                  <Input id="key" name="key" dir="ltr" className="num" required pattern="[a-z][a-z0-9_\-]{1,40}" defaultValue={selected === "new" ? "" : selected.key} disabled={selected !== "new" && selected.isSystem} />
                </Field>
                <Field label={t("nameAr")} htmlFor="nameAr">
                  <Input id="nameAr" name="nameAr" dir="rtl" required defaultValue={selected === "new" ? "" : selected.nameAr} />
                </Field>
                <Field label={t("nameEn")} htmlFor="nameEn">
                  <Input id="nameEn" name="nameEn" dir="ltr" required defaultValue={selected === "new" ? "" : selected.nameEn} />
                </Field>
              </div>
              {isOwner ? (
                <Alert tone="blue">{t("allPermissions")}</Alert>
              ) : (
                <fieldset className="space-y-4">
                  <legend className="text-sm font-medium text-ink-700">{t("permissions")}</legend>
                  {groups.map(([group, keys]) => (
                    <div key={group}>
                      <p className="mb-2 text-xs font-semibold tracking-wide text-ink-500 uppercase">{tg(group)}</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {keys.map((p) => (
                          <label key={p} className="flex items-start gap-2 text-sm">
                            <input type="checkbox" checked={perms.has(p)} onChange={() => toggle(p)} className="mt-0.5 size-4 accent-brand-700" />
                            <span>
                              {tp(p.replace(".", "_"))}
                              <span className="num block text-xs text-ink-400">{p}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </fieldset>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={pending}>{tc("save")}</Button>
                <Button type="button" variant="secondary" onClick={() => setSelected(null)}>{tc("cancel")}</Button>
                {selected !== "new" && !selected.isSystem ? (
                  <Button type="button" variant="danger" disabled={pending || selected.users > 0} onClick={() => void remove(selected)} className="ms-auto">
                    {tc("delete")}
                  </Button>
                ) : null}
              </div>
            </form>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
