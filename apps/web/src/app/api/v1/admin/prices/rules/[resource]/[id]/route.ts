import { requireStaff } from "@/server/auth/context";
import { notFound } from "@/server/errors";
import { apiRoute, parseJson } from "@/server/http";
import { RULE_RESOURCES, deleteRule, updateRule } from "@/server/services/prices-admin";
import { RULE_SCHEMAS } from "../../schemas";

export const PUT = apiRoute<{ resource: string; id: string }>(async (req, { params }) => {
  const { resource, id } = await params;
  const r = RULE_RESOURCES[resource];
  const schema = RULE_SCHEMAS[resource];
  if (!r || !schema) throw notFound();
  const ctx = await requireStaff(r.permission);
  return updateRule(ctx, resource, id, await parseJson(req, schema));
});

export const DELETE = apiRoute<{ resource: string; id: string }>(async (_req, { params }) => {
  const { resource, id } = await params;
  const r = RULE_RESOURCES[resource];
  if (!r) throw notFound();
  const ctx = await requireStaff(r.permission);
  await deleteRule(ctx, resource, id);
  return { ok: true };
});
