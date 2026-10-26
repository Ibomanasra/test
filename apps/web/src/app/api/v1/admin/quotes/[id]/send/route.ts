import { requireStaff } from "@/server/auth/context";
import { apiRoute } from "@/server/http";
import { sendQuote } from "@/server/services/quotes";

export const POST = apiRoute<{ id: string }>(async (_req, { params }) => {
  const ctx = await requireStaff("quote.edit");
  return sendQuote(ctx, (await params).id);
});
