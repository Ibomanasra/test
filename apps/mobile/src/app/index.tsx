import { Redirect } from "expo-router";
import { Loading, Muted, Screen } from "@/components/ui";
import { useSession } from "@/lib/session";

/** Einstieg: Fahrer → Tour, Kunden/Gäste → Katalog */
export default function Index() {
  const { ready, me, isDriver } = useSession();
  if (!ready) return <Loading />;
  if (isDriver) return <Redirect href="/driver" />;
  if (me?.isStaff)
    return (
      <Screen>
        <Muted>Admin: https://… /admin</Muted>
      </Screen>
    );
  return <Redirect href="/catalog" />;
}
