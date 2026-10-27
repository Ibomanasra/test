import { productCreateSchema } from "@sa/contracts";
import { z } from "zod";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson, parseQuery } from "@/server/http";
import { createProduct, listProducts } from "@/server/services/products-admin";

const q = z.object({ q: z.string().max(100).optional(), categoryId: z.string().max(64).optional(), page: z.coerce.number().int().min(1).default(1) });

export const GET = apiRoute(async (req) => {
  await requireStaff("product.view");
  return listProducts(parseQuery(req, q));
});

export const POST = apiRoute(async (req) => {
  const ctx = await requireStaff("product.edit");
  const { product, variant } = await parseJson(req, productCreateSchema);
  return createProduct(ctx, product, variant);
});
