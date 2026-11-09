import { getTranslations, setRequestLocale } from "next-intl/server";
import { Forbidden } from "@/components/admin/Forbidden";
import { MiniBars } from "@/components/admin/MiniBars";
import { Alert, Card, Num, PageHeader, cn } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { staffPagePermission } from "@/server/auth/page-guards";
import { VISIT_RANGES, type VisitRange, type VisitSource, visitStats } from "@/server/services/visits";

const SOURCE_ICON: Record<VisitSource, string> = { whatsapp: "💬", instagram: "📸", facebook: "👍", tiktok: "🎵", google: "🔎", telegram: "✈️", direct: "🔗", other: "🌐" };
const DEVICE_ICON: Record<string, string> = { mobile: "📱", tablet: "📲", desktop: "💻" };
const LOCALE_NAME: Record<string, string> = { ar: "العربية", en: "English", he: "עברית" };

const pct = (part: number, whole: number) => {
  if (whole <= 0) return 0;
  const v = (part / whole) * 100;
  return v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
};

export const dynamic = "force-dynamic";

export default async function VisitorsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ days?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await staffPagePermission(locale, "report.view");
  if (!auth) return <Forbidden />;
  const sp = await searchParams;
  const days = (VISIT_RANGES as readonly number[]).includes(Number(sp.days)) ? (Number(sp.days) as VisitRange) : 7;
  const [t, s] = await Promise.all([getTranslations("admin.visitors"), visitStats(days, locale)]);
  const short = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
  const perVisitor = s.visitors ? Math.round((s.views / s.visitors) * 10) / 10 : 0;

  const kpis = [
    { key: "visitors", label: t("kpi.visitors"), value: s.visitors, sub: t("kpi.visitorsSub", { n: s.newVisitors }), accent: "bg-sky-50 text-sky-700", icon: "👥" },
    { key: "views", label: t("kpi.views"), value: s.views, sub: t("kpi.viewsSub", { n: perVisitor }), accent: "bg-violet-50 text-violet-700", icon: "👀" },
    { key: "orders", label: t("kpi.orders"), value: s.orders, sub: t("kpi.ordersSub", { p: s.conversionBps / 100 }), accent: "bg-brand-50 text-brand-700", icon: "🛍️" },
    { key: "online", label: t("kpi.online"), value: s.online, sub: t("kpi.onlineSub"), accent: "bg-green-50 text-green-700", icon: "🟢" },
  ];

  const funnel = [
    { key: "visitors", n: s.funnel.visitors },
    { key: "product", n: s.funnel.product },
    { key: "cart", n: s.funnel.cart },
    { key: "checkout", n: s.funnel.checkout },
    { key: "orders", n: s.funnel.orders },
  ];
  const sourceMax = Math.max(1, ...s.sources.map((x) => x.visits));
  const sourceTotal = s.sources.reduce((a, x) => a + x.visits, 0);
  const bestHour = s.hours.reduce((best, v, h) => (v > s.hours[best]! ? h : best), 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {/* Zeitraum */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("range")}>
        {VISIT_RANGES.map((d) => (
          <Link key={d} href={`/admin/visitors?days=${d}`} role="tab" aria-selected={d === days} className={cn("rounded-full px-4 py-1.5 text-sm font-medium ring-1", d === days ? "bg-ink-900 text-white ring-ink-900" : "bg-white text-ink-700 ring-ink-200 hover:bg-ink-50")} data-testid={`range-${d}`}>
            {t(`ranges.${d}`)}
          </Link>
        ))}
        <span className="num ms-auto self-center text-sm text-ink-500">{s.from === s.to ? s.to : `${s.from} → ${s.to}`}</span>
      </div>

      {s.visitors === 0 ? <Alert tone="blue">{t("empty")}</Alert> : null}

      {/* Kennzahlen */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.key} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200" data-testid={`kpi-${k.key}`}>
            <div className="flex items-center gap-2">
              <span className={cn("grid size-9 place-items-center rounded-xl text-lg", k.accent)} aria-hidden>{k.icon}</span>
              <p className="text-sm text-ink-600">{k.label}</p>
            </div>
            <p className="mt-2 text-3xl font-bold text-ink-900"><Num>{k.value}</Num></p>
            <p className="mt-1 text-xs text-ink-500">{k.sub}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-600">
        <span>🆕 {t("signups")}: <Num className="font-semibold text-ink-900">{s.signups}</Num></span>
        <span>📲 {t("appUsers")}: <Num className="font-semibold text-ink-900">{s.appVisitors}</Num></span>
      </div>

      {/* Verlauf */}
      {days > 1 ? (
        <Card title={t("daily")}>
          <MiniBars
            testId="visitors-chart"
            title={t("dailyHint")}
            table={{ label: t("table"), value: t("kpi.visitors") }}
            labelEvery={days > 30 ? 14 : days > 7 ? 5 : 1}
            data={s.series.map((d) => ({ key: d.day, label: short(d.day), value: d.visitors, tip: `${d.day} · ${t("tipVisitors", { n: d.visitors })} · ${t("tipViews", { n: d.views })}` }))}
          />
        </Card>
      ) : null}

      {/* Weg zum Kauf */}
      <Card title={t("funnel.title")}>
        <p className="mb-4 text-sm text-ink-500">{t("funnel.hint")}</p>
        <ol className="space-y-3" data-testid="funnel">
          {funnel.map((f, i) => {
            const share = pct(f.n, s.funnel.visitors);
            const prev = i > 0 ? funnel[i - 1]!.n : 0;
            return (
              <li key={f.key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-ink-900"><span className="num me-1 text-ink-400">{i + 1}.</span>{t(`funnel.${f.key}`)}</span>
                  <span className="whitespace-nowrap">
                    <Num className="font-semibold text-ink-900">{f.n}</Num>
                    {i > 0 ? <span className="num ms-2 inline-block rounded bg-ink-100 px-1.5 text-xs text-ink-600">{share}%</span> : null}
                  </span>
                </div>
                <div className="mt-1 h-3 overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full rounded-full bg-[#2a78d6]" style={{ width: `${Math.max(f.n > 0 ? 2 : 0, i === 0 ? (f.n > 0 ? 100 : 0) : share)}%` }} />
                </div>
                {i > 0 && prev > f.n ? <p className="mt-0.5 text-xs text-ink-500">{t("funnel.lost", { n: prev - f.n })}</p> : null}
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Herkunft */}
        <Card title={t("sources.title")}>
          {s.sources.length === 0 ? <p className="text-sm text-ink-500">{t("none")}</p> : (
            <ul className="space-y-3" data-testid="sources">
              {s.sources.map((x) => (
                <li key={x.source}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-ink-900"><span aria-hidden className="me-1.5">{SOURCE_ICON[x.source] ?? "🌐"}</span>{t(`sources.${x.source}`)}</span>
                    <span className="whitespace-nowrap"><Num className="font-semibold">{x.visits}</Num><span className="num ms-2 inline-block rounded bg-ink-100 px-1.5 text-xs text-ink-600">{pct(x.visits, sourceTotal)}%</span></span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-[#2a78d6]" style={{ width: `${Math.max(2, (x.visits / sourceMax) * 100)}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">💡 {t("sources.tip")} <span className="num block pt-1 font-mono" dir="ltr">sholataljanoub.com/?ref=instagram</span></p>
        </Card>

        {/* Beliebte Produkte */}
        <Card title={t("products.title")}>
          {s.topProducts.length === 0 ? <p className="text-sm text-ink-500">{t("none")}</p> : (
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[20rem] text-sm" data-testid="top-products">
                <thead className="text-xs text-ink-500">
                  <tr><th className="py-2 text-start font-medium">{t("products.product")}</th><th className="py-2 text-end font-medium">{t("products.views")}</th><th className="py-2 text-end font-medium">{t("products.adds")}</th></tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {s.topProducts.map((p) => (
                    <tr key={p.slug}>
                      <td className="py-2">
                        <Link href={`/products/${p.slug}`} className="flex items-center gap-2 hover:underline">
                          {p.imageId ? <img src={`/api/v1/images/${p.imageId}`} alt="" className="size-9 shrink-0 rounded-lg bg-ink-50 object-cover" /> : <span className="size-9 shrink-0 rounded-lg bg-ink-100" />}
                          <span className="line-clamp-2">{p.name}</span>
                        </Link>
                      </td>
                      <td className="py-2 text-end"><Num className="font-semibold">{p.views}</Num></td>
                      <td className="py-2 text-end"><Num>{p.adds}</Num></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Uhrzeiten */}
        <Card title={t("hours.title")}>
          {s.visitors > 0 ? <p className="mb-2 text-sm text-ink-600">{t("hours.best", { h: `${String(bestHour).padStart(2, "0")}:00` })}</p> : null}
          <MiniBars
            testId="hours-chart"
            title={t("hours.hint")}
            table={{ label: t("table"), value: t("kpi.visitors") }}
            labelEvery={3}
            height={170}
            data={s.hours.map((v, h) => ({ key: String(h), label: String(h), value: v, tip: `${String(h).padStart(2, "0")}:00 · ${t("tipVisitors", { n: v })}` }))}
          />
        </Card>

        {/* Suchbegriffe */}
        <Card title={t("searches.title")}>
          {s.searches.length === 0 ? <p className="text-sm text-ink-500">{t("searches.none")}</p> : (
            <ul className="divide-y divide-ink-100 text-sm" data-testid="searches">
              {s.searches.map((q) => (
                <li key={q.query} className="flex items-center justify-between gap-3 py-2">
                  <span className="truncate">🔍 {q.query}</span>
                  <Num className="font-semibold">{q.count}</Num>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink-500">{t("searches.hint")}</p>
        </Card>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card title={t("devices.title")}>
          <ul className="space-y-2 text-sm">
            {s.devices.map((d) => (
              <li key={d.device} className="flex items-center justify-between gap-3"><span>{DEVICE_ICON[d.device] ?? "📱"} {t(`devices.${d.device}`)}</span><span><Num className="font-semibold">{d.visitors}</Num><span className="num ms-2 inline-block rounded bg-ink-100 px-1.5 text-xs text-ink-600">{pct(d.visitors, s.visitors)}%</span></span></li>
            ))}
            {s.devices.length === 0 ? <li className="text-ink-500">{t("none")}</li> : null}
          </ul>
        </Card>
        <Card title={t("languages")}>
          <ul className="space-y-2 text-sm">
            {s.locales.map((d) => (
              <li key={d.locale} className="flex items-center justify-between gap-3"><span>{LOCALE_NAME[d.locale] ?? d.locale}</span><span><Num className="font-semibold">{d.visitors}</Num><span className="num ms-2 inline-block rounded bg-ink-100 px-1.5 text-xs text-ink-600">{pct(d.visitors, s.visitors)}%</span></span></li>
            ))}
            {s.locales.length === 0 ? <li className="text-ink-500">{t("none")}</li> : null}
          </ul>
        </Card>
      </div>

      <p className="text-xs text-ink-500">🔒 {t("privacy")}</p>
    </div>
  );
}
