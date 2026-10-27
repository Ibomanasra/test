import { dunningRunSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { runDunning } from "@/server/services/finance";

/** Mahnlauf: nächste Stufe je überfälligem Kunden */
export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("finance.dunning");
  return runDunning(ctx, await parseJson(req, dunningRunSchema));
});
