import { getTranslations, setRequestLocale } from "next-intl/server";
import { ListActions } from "@/components/shop/ListActions";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireCustomerPage } from "@/server/auth/page-guards";
import { listOrderLists } from "@/server/services/lists";

export const dynamic = "force-dynamic";

export default async function ListsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await requireCustomerPage(locale, "/account/lists");
  const t = await getTranslations("account.lists");
  if (auth.channel !== "B2B") return <Alert tone="amber">{(await getTranslations("account.quotes"))("b2bOnly")}</Alert>;
  const lists = await listOrderLists(auth.customer!.id);
  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} subtitle={t("hint")} />
      {lists.length === 0 ? <EmptyState>{t("none")}</EmptyState> : null}
      {lists.map((l) => (
        <Card key={l.id} title={l.name} actions={<ListActions id={l.id} />}>
          <ul className="space-y-1 text-sm">
            {l.items.map((i) => (
              <li key={i.id}>
                <span className="num">{i.variant.sku}</span> · {locale === "ar" ? i.variant.product.nameAr : i.variant.product.nameEn} – <span className="num">{i.qty} × {i.unitCode}</span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
