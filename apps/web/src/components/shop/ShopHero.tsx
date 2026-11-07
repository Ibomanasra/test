import { getTranslations } from "next-intl/server";
import { HeroIllustration } from "@/components/shop/HeroIllustration";
import { Link } from "@/i18n/navigation";

/**
 * Kopf der Startseite in Logofarben (Anthrazit + Rot).
 * Hintergrund: eigenes Bild (Einstellungen → Startseite) → sonst Collage echter Produktfotos → sonst Illustration.
 */
export async function ShopHero({
  title,
  text,
  imageFileId,
  photoIds,
  productCount,
}: {
  title: string | null;
  text: string | null;
  imageFileId: string | null;
  photoIds: string[];
  productCount: number;
}) {
  const t = await getTranslations("shop.hero");
  const collage = !imageFileId && photoIds.length >= 3 ? photoIds.slice(0, 6) : [];
  return (
    <section className="relative isolate overflow-hidden rounded-3xl bg-[#232327] text-white shadow-xl" data-testid="hero">
      {imageFileId ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- großes Hintergrundbild, bereits optimiert hochgeladen */}
          <img src={`/api/v1/images/${imageFileId}`} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-l from-[#1b1b1f]/95 via-[#1b1b1f]/70 to-[#1b1b1f]/20 ltr:bg-gradient-to-r" />
        </>
      ) : (
        <>
          {/* weiches Licht + Rot-Akzent */}
          <div className="absolute -start-24 -top-24 -z-10 size-96 rounded-full bg-[#c1272d]/25 blur-3xl" />
          <div className="absolute -bottom-32 end-10 -z-10 size-96 rounded-full bg-white/10 blur-3xl" />
        </>
      )}

      <div className="grid items-center gap-8 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-2">
        <div className="max-w-xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-medium ring-1 ring-white/20 backdrop-blur">
            <span className="size-2 rounded-full bg-[#e0353b]" /> {t("badge")}
          </p>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-5xl sm:leading-tight">{title ?? t("title")}</h1>
          <p className="mt-4 text-base text-white/80 sm:text-lg">{text ?? t("text", { count: productCount })}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/products" className="rounded-xl bg-white px-6 py-3 font-bold text-[#232327] shadow-lg hover:bg-white/90">
              {t("ctaShop")}
            </Link>
            <Link href="/offers" className="rounded-xl bg-[#c1272d] px-6 py-3 font-bold text-white shadow-lg hover:bg-[#a8202c]">
              🔥 {t("ctaOffers")}
            </Link>
            <Link href="/register?type=b2b" className="rounded-xl px-6 py-3 font-semibold text-white ring-1 ring-white/40 hover:bg-white/10">
              {t("ctaBusiness")}
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
            {(["trust1", "trust2", "trust3"] as const).map((k) => (
              <li key={k} className="inline-flex items-center gap-2">
                <span className="grid size-5 place-items-center rounded-full bg-white/15 text-xs">✓</span>
                {t(k)}
              </li>
            ))}
          </ul>
        </div>

        {/* Bildseite */}
        {imageFileId ? null : collage.length ? (
          <div className="relative hidden h-80 lg:block" aria-hidden="true">
            <div className="absolute inset-0 grid rotate-[-6deg] grid-cols-3 gap-4">
              {collage.map((id, i) => (
                <div key={id} className={`overflow-hidden rounded-2xl bg-white p-2 shadow-2xl ring-1 ring-black/5 ${i % 3 === 1 ? "translate-y-8" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- Produktfotos aus dem Shop */}
                  <img src={`/api/v1/images/${id}`} alt="" className="aspect-square w-full rounded-xl object-contain" loading="eager" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <HeroIllustration className="mx-auto hidden w-full max-w-md drop-shadow-2xl lg:block" />
        )}
      </div>
    </section>
  );
}
