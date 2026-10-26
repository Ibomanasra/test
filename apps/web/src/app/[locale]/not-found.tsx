import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("common");
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="num text-5xl font-bold text-brand-700">404</p>
      <h1 className="text-xl font-semibold">{t("notFoundTitle")}</h1>
      <Link href="/" className="text-brand-700 underline">
        {t("home")}
      </Link>
    </main>
  );
}
