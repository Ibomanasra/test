import { sendWebPush } from "@/server/adapters/web-push";
import { getAuth } from "@/server/auth/context";
import { unauthorized } from "@/server/errors";
import { apiRoute } from "@/server/http";

/** Probe-Benachrichtigung an die eigenen Geräte */
export const POST = apiRoute(async () => {
  const ctx = await getAuth();
  if (!ctx) throw unauthorized();
  const sent = await sendWebPush([ctx.user.id], { title: "✅ شعلة الجنوب", body: "الإشعارات تعمل على هذا الجهاز / Notifications work on this device" });
  return { sent };
});
