import { z } from "zod";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseQuery } from "@/server/http";
import { listPriceHistory } from "@/server/services/prices-admin";

const q = z.object({ sku: z.string().max(64).optional(), page: z.coerce.number().int().min(1).default(1) });

export const GET = apiRoute(async (req) => {
  await requireStaff("price.view");
  return listPriceHistory(parseQuery(req, q));
});
