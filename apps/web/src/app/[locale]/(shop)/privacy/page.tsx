import { prisma } from "@sa/db";
import { setRequestLocale } from "next-intl/server";
import { Fragment } from "react";
import { PRIVACY, PRIVACY_UPDATED } from "@/content/privacy";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const p = PRIVACY[locale] ?? PRIVACY.ar!;
  return { title: p.title, description: p.intro.replace(/\*\*/g, "").slice(0, 160) };
}

/** **fett** im Text hervorheben */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("**").map((part, i) => (i % 2 ? <strong key={i} className="font-semibold text-ink-900">{part}</strong> : <Fragment key={i}>{part}</Fragment>))}
    </>
  );
}

/** Datenschutzerklärung (öffentlich, ohne Anmeldung) – Kontaktdaten aus den Firmen-Einstellungen */
export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const p = PRIVACY[locale] ?? PRIVACY.ar!;
  const company = await prisma.companySettings.findUnique({ where: { id: 1 }, select: { phone: true, email: true, addressAr: true, addressEn: true } });
  const address = company ? (locale === "ar" ? company.addressAr : company.addressEn || company.addressAr) : null;
  const tel = company?.phone?.replace(/[^\d+]/g, "");

  return (
    <article className="mx-auto max-w-3xl space-y-6" data-testid="privacy-page">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-ink-900">{p.title}</h1>
        <p className="text-sm text-ink-500">{p.updated}: <span className="num">{PRIVACY_UPDATED}</span></p>
        <p className="text-base leading-relaxed text-ink-700"><Rich text={p.intro} /></p>
      </header>

      {p.sections.map((s, i) => (
        <section key={s.title} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-200">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-ink-900">
            <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-brand-50 text-sm text-brand-700">{i + 1}</span>
            {s.title}
          </h2>
          <div className="space-y-2 text-[15px] leading-relaxed text-ink-700">
            {s.body.map((b, j) =>
              Array.isArray(b) ? (
                <ul key={j} className="list-disc space-y-1.5 ps-5 marker:text-brand-600">
                  {b.map((li) => <li key={li}><Rich text={li} /></li>)}
                </ul>
              ) : (
                <p key={j}><Rich text={b} /></p>
              ),
            )}
          </div>
        </section>
      ))}

      <section className="rounded-2xl bg-ink-900 p-5 text-white" data-testid="privacy-contact">
        <h2 className="mb-1 text-lg font-bold">{p.contactTitle}</h2>
        <p className="mb-3 text-sm text-ink-200">{p.contactIntro}</p>
        <ul className="space-y-1.5 text-[15px]">
          {company?.phone ? <li>📞 {p.phone}: <a href={`tel:${tel}`} className="num font-semibold underline-offset-2 hover:underline" dir="ltr">{company.phone}</a></li> : null}
          {company?.email ? <li>✉️ {p.email}: <a href={`mailto:${company.email}`} className="inline-block break-all font-semibold underline-offset-2 hover:underline" dir="ltr">{company.email}</a></li> : null}
          {address ? <li>📍 {p.address}: {address}</li> : null}
        </ul>
      </section>
    </article>
  );
}
