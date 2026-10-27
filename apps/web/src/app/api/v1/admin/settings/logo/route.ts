import { requireStaff } from "@/server/auth/context";
import { apiRoute } from "@/server/http";
import { setCompanyLogo } from "@/server/services/document-settings";

/** multipart: file=<png|jpg|webp> · DELETE entfernt das Logo */
export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("settings.edit");
  const form = await req.formData();
  const file = form.get("file");
  return setCompanyLogo(ctx, file instanceof File ? file : null);
});

export const DELETE = apiRoute(async () => {
  const ctx = await requireStaff("settings.edit");
  return setCompanyLogo(ctx, null);
});
