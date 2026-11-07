"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert, Button, Card, Input, cn } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { useApi } from "@/lib/api-client";

type Event = "order.new" | "stock.low" | "dealer.new";
const EVENTS: Event[] = ["order.new", "stock.low", "dealer.new"];
interface Chat {
  id: string;
  title: string;
  events: Event[];
}

/** Telegram-Bot verbinden, Chats finden und je Chat die Nachrichtenarten wählen */
export function TelegramSettings({ initial, canEdit }: { initial: { connected: boolean; botUsername: string; chats: Chat[] }; canEdit: boolean }) {
  const t = useTranslations("admin.notify");
  const router = useRouter();
  const { call, pending, error } = useApi();
  const [token, setToken] = useState("");
  const [chats, setChats] = useState<Chat[]>(initial.chats);
  const [found, setFound] = useState<{ id: string; title: string; type: string }[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const connect = async () => {
    setMsg(null);
    if (await call("/api/v1/admin/settings/telegram", { method: "PUT", body: { token } })) {
      setToken("");
      router.refresh();
    }
  };
  const disconnect = async () => {
    if (!confirm(t("disconnectConfirm"))) return;
    if (await call("/api/v1/admin/settings/telegram", { method: "DELETE" })) {
      setChats([]);
      router.refresh();
    }
  };
  const discover = async () => {
    setMsg(null);
    const r = await call<{ chats: { id: string; title: string; type: string }[] }>("/api/v1/admin/settings/telegram/discover", { method: "POST" });
    if (r) setFound(r.chats);
  };
  const saveChats = async (next: Chat[]) => {
    setChats(next);
    if (await call("/api/v1/admin/settings/telegram/chats", { method: "PUT", body: { chats: next } })) setMsg(t("saved"));
  };
  const test = async (chatId: string) => {
    setMsg(null);
    if (await call("/api/v1/admin/settings/telegram/test", { body: { chatId } })) setMsg(t("testSent"));
  };

  return (
    <Card title={`✈️ ${t("title")}`}>
      <div className="space-y-5" data-testid="telegram-settings">
        <p className="text-sm text-ink-600">{t("intro")}</p>

        {/* Schritt 1: Bot verbinden */}
        <section className="space-y-2">
          <h3 className="font-semibold text-ink-900">1. {t("step1")}</h3>
          {initial.connected ? (
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-green-50 px-4 py-3 ring-1 ring-green-200">
              <span className="font-medium text-green-800" data-testid="telegram-connected">✓ {t("connected")} {initial.botUsername ? <span dir="ltr">@{initial.botUsername}</span> : null}</span>
              {canEdit ? <Button size="sm" variant="ghost" onClick={() => void disconnect()}>{t("disconnect")}</Button> : null}
            </div>
          ) : canEdit ? (
            <>
              <ol className="list-decimal space-y-1 ps-5 text-sm text-ink-600">
                <li>{t("howBot1")}</li>
                <li>{t("howBot2")}</li>
              </ol>
              <form
                className="flex flex-wrap gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void connect();
                }}
              >
                <Input type="password" autoComplete="off" dir="ltr" value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456789:AA…" className="min-w-0 flex-1" aria-label={t("token")} data-testid="telegram-token" />
                <Button type="submit" disabled={pending || token.length < 20} data-testid="telegram-connect">{t("connect")}</Button>
              </form>
            </>
          ) : null}
        </section>

        {/* Schritt 2: Chats */}
        {initial.connected ? (
          <section className="space-y-3">
            <h3 className="font-semibold text-ink-900">2. {t("step2")}</h3>
            <p className="text-sm text-ink-600">{t("howChat")}</p>
            {canEdit ? <Button variant="secondary" onClick={() => void discover()} disabled={pending} data-testid="telegram-discover">🔎 {t("discover")}</Button> : null}
            {found ? (
              found.length === 0 ? (
                <p className="text-sm text-amber-800">{t("noneFound")}</p>
              ) : (
                <ul className="space-y-1">
                  {found.filter((f) => !chats.some((c) => c.id === f.id)).map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-2 rounded-lg bg-ink-50 px-3 py-2 text-sm">
                      <span>{f.type === "private" ? "👤" : "👥"} {f.title}</span>
                      <Button size="sm" onClick={() => void saveChats([...chats, { id: f.id, title: f.title, events: [...EVENTS] }])} data-testid="telegram-add">{t("add")}</Button>
                    </li>
                  ))}
                </ul>
              )
            ) : null}

            {chats.length ? (
              <ul className="space-y-2" data-testid="telegram-chats">
                {chats.map((c) => (
                  <li key={c.id} className="rounded-xl p-3 ring-1 ring-ink-200">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-ink-900">{c.title}</span>
                      <span className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => void test(c.id)} disabled={pending} data-testid="telegram-test">{t("test")}</Button>
                        {canEdit ? <Button size="sm" variant="ghost" onClick={() => void saveChats(chats.filter((x) => x.id !== c.id))}>✕</Button> : null}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {EVENTS.map((e) => {
                        const on = c.events.includes(e);
                        return (
                          <button
                            key={e}
                            type="button"
                            disabled={!canEdit || pending}
                            onClick={() => void saveChats(chats.map((x) => (x.id === c.id ? { ...x, events: on ? x.events.filter((y) => y !== e) : [...x.events, e] } : x)))}
                            className={cn("rounded-full px-3 py-1 text-xs font-medium ring-1", on ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-ink-600 ring-ink-300")}
                            aria-pressed={on}
                          >
                            {on ? "✓ " : ""}{t(`events.${e.replace(".", "_")}`)}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        {error ? <Alert tone="red">{error}</Alert> : null}
        {msg ? <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800" role="status">{msg}</p> : null}
      </div>
    </Card>
  );
}
