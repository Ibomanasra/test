import { customerPasswordSchema } from "@sa/contracts";
import { z } from "zod";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { setCustomerPassword } from "@/server/services/customers";

const schema = z.object({ password: customerPasswordSchema });

export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("customer.edit");
  return setCustomerPassword(ctx, (await params).id, (await parseJson(req, schema)).password);
});
