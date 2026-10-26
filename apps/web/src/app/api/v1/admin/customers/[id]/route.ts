import { requireStaff } from "@/server/auth/context";
import { apiRoute } from "@/server/http";
import { getCustomerDetail } from "@/server/services/customers";

export const GET = apiRoute<{ id: string }>(async (_req, { params }) => {
  await requireStaff("customer.view");
  return getCustomerDetail((await params).id);
});
