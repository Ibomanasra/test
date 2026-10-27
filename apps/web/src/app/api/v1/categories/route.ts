import { apiRoute } from "@/server/http";
import { listCategories } from "@/server/services/catalog";

export const GET = apiRoute(async () => ({ items: await listCategories() }));
