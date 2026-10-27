import { creditNoteCreateSchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { archiveFiscalDocument, createCreditNote } from "@/server/services/invoicing";

/** Gutschrift zu einer Rechnung (ohne Zeilen = vollständig) – wird sofort eingefroren archiviert */
export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("finance.credit_note");
  const { id } = await params;
  const cn = await createCreditNote(ctx, id, await parseJson(req, creditNoteCreateSchema));
  await archiveFiscalDocument("CREDIT_NOTE", cn.id, ctx.user.id).catch((err: unknown) => console.error("[archive]", err));
  return { id: cn.id, number: cn.number };
});
