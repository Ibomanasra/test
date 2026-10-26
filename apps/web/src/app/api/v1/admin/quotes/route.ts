import { quoteCreateSchema } from "@sa/contracts";
import { z } from "zod";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson, parseQuery } from "@/server/http";
import { createQuote, listQuotes } from "@/server/services/quotes";

const listSchema = z.object({
  status: z.enum(["REQUESTED", "DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CONVERTED"]).optional(),
  customerId: z.string().max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const GET = apiRoute(async (req) => {
  await requireStaff("quote.view");
  return listQuotes(parseQuery(req, listSchema));
});

export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("quote.edit");
  return createQuote(ctx, await parseJson(req, quoteCreateSchema.extend({ confirmBelowMargin: z.boolean().default(false) })));
});
