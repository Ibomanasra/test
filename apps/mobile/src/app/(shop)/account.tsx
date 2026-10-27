import { router } from "expo-router";
import { Button, Card, H1, Muted, Num, Screen } from "@/components/ui";
import { useSession } from "@/lib/session";

export default function Account() {
  const { tr, me, signOut, locale, setLocale } = useSession();
  return (
    <Screen>
      {me ? (
        <Card>
          <H1>{me.customer?.displayName ?? me.user.name}</H1>
          <Num>{me.user.phone}</Num>
          {me.customer ? <Muted>{me.customer.number} · {me.channel}</Muted> : null}
        </Card>
      ) : (
        <Button title={tr.t("login")} onPress={() => router.push("/login")} />
      )}
      <Button title={tr.t("language")} variant="secondary" onPress={() => void setLocale(locale === "ar" ? "en" : "ar")} />
      <Muted>{tr.t("restartHint")}</Muted>
      {me ? <Button title={tr.t("logout")} variant="secondary" onPress={() => void signOut().then(() => router.replace("/"))} /> : null}
    </Screen>
  );
}
