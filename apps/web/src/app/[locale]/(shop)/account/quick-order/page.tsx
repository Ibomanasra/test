import { getTranslations, setRequestLocale } from "next-intl/server";
import { QuickOrderForm } from "@/components/shop/QuickOrderForm";
import { CartActionButton } from "@/components/shop/ReorderButton";
import { Alert, PageHeader } from "@/components/ui";
import { requireCustomerPage } from "@/server/auth/page-guards";
import { lastOrderId } from "@/server/services/orders";

export const dynamic = "force-dynamic";

export default async function QuickOrderPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const auth = await requireCustomerPage(locale, "/account/quick-order");
  const t = await getTranslations("account.quick");
  if (auth.channel !== "B2B") return <Alert tone="amber">{(await getTranslations("account.quotes"))("b2bOnly")}</Alert>;
  const last = await lastOrderId(auth.customer!.id);
  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} actions={last ? <CartActionButton endpoint="/api/v1/cart/reorder" body={{ orderId: last }} label={t("repeatLast")} variant="primary" testId="repeat-last" /> : null} />
      <QuickOrderForm />
    </div>
  );
}
