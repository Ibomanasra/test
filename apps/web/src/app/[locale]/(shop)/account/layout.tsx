import { getTranslations } from "next-intl/server";
import { SubTabs } from "@/components/admin/SubTabs";
import { getAuth } from "@/server/auth/context";

/** Unternavigation im Kundenkonto; B2B-Funktionen nur für freigegebene Händler */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const [t, auth] = await Promise.all([getTranslations("account.nav"), getAuth()]);
  const b2b = auth?.channel === "B2B";
  const tabs = [
    { href: "/account", label: t("overview") },
    { href: "/account/orders", label: t("orders") },
    ...(b2b
      ? [
          { href: "/account/quick-order", label: t("quickOrder") },
          { href: "/account/lists", label: t("lists") },
          { href: "/account/quotes", label: t("quotes") },
          { href: "/account/statement", label: t("statement") },
        ]
      : []),
    { href: "/account/documents", label: t("documents") },
  ];
  return (
    <div>
      {auth?.customer ? <SubTabs tabs={tabs} /> : null}
      {children}
    </div>
  );
}
