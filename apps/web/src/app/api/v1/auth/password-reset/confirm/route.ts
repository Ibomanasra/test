import { customerPasswordSchema } from "@sa/contracts";
import { z } from "zod";
import { apiRoute, parseJson } from "@/server/http";
import { confirmPasswordReset } from "@/server/services/password-reset";

const schema = z.object({ token: z.string().min(10).max(2000), password: customerPasswordSchema });

export const POST = apiRoute(async (req) => {
  const { token, password } = await parseJson(req, schema);
  return confirmPasswordReset(token, password);
});
