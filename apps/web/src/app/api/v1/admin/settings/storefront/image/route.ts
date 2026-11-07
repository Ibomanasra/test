import { requireStaff } from "@/server/auth/context";
import { apiRoute } from "@/server/http";
import { setHeroImage } from "@/server/services/storefront";

/** multipart: file=<jpg|png|webp> (Startseiten-Hintergrund) · DELETE entfernt es */
export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("settings.edit");
  const file = (await req.formData()).get("file");
  return setHeroImage(ctx, file instanceof File ? file : null);
});

export const DELETE = apiRoute(async () => {
  const ctx = await requireStaff("settings.edit");
  return setHeroImage(ctx, null);
});
