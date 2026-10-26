import { auditQuerySchema } from "@sa/contracts";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseQuery } from "@/server/http";
import { listAudit } from "@/server/services/audit-log";

export const GET = apiRoute(async (req) => {
  await requireStaff("audit.view");
  return listAudit(parseQuery(req, auditQuerySchema));
});
