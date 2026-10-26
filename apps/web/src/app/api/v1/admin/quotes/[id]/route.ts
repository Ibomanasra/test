import { quoteCreateSchema } from "@sa/contracts";
import { z } from "zod";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { getQuote, updateQuote } from "@/server/services/quotes";

export const GET = apiRoute<{ id: string }>(async (_req, { params }) => {
  await requireStaff("quote.view");
  return getQuote((await params).id);
});

export const PUT = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("quote.edit");
  const schema = quoteCreateSchema.omit({ customerId: true }).extend({ confirmBelowMargin: z.boolean().default(false) });
  return updateQuote(ctx, (await params).id, await parseJson(req, schema));
});
