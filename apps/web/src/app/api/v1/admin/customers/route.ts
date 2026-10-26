import { customerListQuerySchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseQuery } from "@/server/http";
import { listCustomers } from "@/server/services/customers";

export const GET = apiRoute(async (req) => {
  await requireStaff("customer.view");
  return listCustomers(parseQuery(req, customerListQuerySchema));
});
