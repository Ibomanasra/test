import { productSchema } from "@sa/contracts";
import { hasPermission } from "@sa/core";
import { requireStaff } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { z } from "zod";
import { deleteProduct, getProductAdmin, setProductActive, updateProduct } from "@/server/services/products-admin";

export const GET = apiRoute<{ id: string }>(async (_req, { params }) => {
  const ctx = await requireStaff("product.view");
  const p = await getProductAdmin((await params).id);
  if (hasPermission(ctx.permissions, "price.view_cost")) return p;
  return { ...p, variants: p.variants.map(({ costPrice: _c, ...v }) => v) };
});

export const PUT = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("product.edit");
  return updateProduct(ctx, (await params).id, await parseJson(req, productSchema));
});

/** Im Shop anzeigen/ausblenden: { active: boolean } */
export const PATCH = apiRoute<{ id: string }>(async (req, { params }) => {
  const ctx = await requireStaff("product.edit");
  const { active } = await parseJson(req, z.object({ active: z.boolean() }));
  return setProductActive(ctx, (await params).id, active);
});

/** Löschen (nie verwendet) bzw. archivieren (in Belegen verwendet) */
export const DELETE = apiRoute<{ id: string }>(async (_req, { params }) => {
  const ctx = await requireStaff("product.edit");
  return deleteProduct(ctx, (await params).id);
});
