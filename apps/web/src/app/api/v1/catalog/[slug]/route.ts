import { notFound } from "@/server/errors";
import { apiRoute } from "@/server/http";
import { getCatalogProduct } from "@/server/services/catalog";
import { currentViewer } from "@/server/viewer";

export const GET = apiRoute<{ slug: string }>(async (_req, { params }) => {
  const p = await getCatalogProduct(await currentViewer(), (await params).slug);
  if (!p) throw notFound();
  return p;
});
