import { requireStaff } from "@/server/auth/context";
import { apiRoute } from "@/server/http";
import { customerOpenInvoices } from "@/server/services/finance";

export const GET = apiRoute<{ id: string }>(async (_req, { params }) => {
  await requireStaff("finance.view");
  return { items: await customerOpenInvoices((await params).id) };
});
