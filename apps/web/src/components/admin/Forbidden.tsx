import { getTranslations } from "next-intl/server";
import { Alert } from "@/components/ui";

export async function Forbidden() {
  const t = await getTranslations("common");
  return (
    <div className="mx-auto max-w-lg space-y-2 py-10" data-testid="forbidden">
      <h1 className="text-xl font-semibold">{t("forbiddenTitle")}</h1>
      <Alert tone="red">{t("forbiddenText")}</Alert>
    </div>
  );
}
