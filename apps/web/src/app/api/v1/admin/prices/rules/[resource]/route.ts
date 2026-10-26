import { requireStaff } from "@/server/auth/context";
import { notFound } from "@/server/errors";
import { apiRoute, parseJson } from "@/server/http";
import { RULE_RESOURCES, createRule } from "@/server/services/prices-admin";
import { RULE_SCHEMAS } from "../schemas";

export const POST = apiRoute<{ resource: string }>(async (req, { params }) => {
  const { resource } = await params;
  const r = RULE_RESOURCES[resource];
  const schema = RULE_SCHEMAS[resource];
  if (!r || !schema) throw notFound();
  const ctx = await requireStaff(r.permission);
  return createRule(ctx, resource, await parseJson(req, schema));
});
