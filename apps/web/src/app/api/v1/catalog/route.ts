import { catalogQuerySchema } from "@sa/contracts";
import { apiRoute, parseQuery } from "@/server/http";
import { listCatalog } from "@/server/services/catalog";
import { currentViewer } from "@/server/viewer";

export const GET = apiRoute(async (req) => {
  const f = parseQuery(req, catalogQuerySchema);
  return listCatalog(await currentViewer(), { ...f, promo: f.promo === "1" });
});
