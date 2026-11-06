import { addressCreateSchema } from "@sa/contracts";
import { prisma } from "@sa/db";
import { audit } from "@/server/audit";
import { requireCustomer } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { resolveZoneId } from "@/server/services/zones";

export const POST = apiRoute(async (req) => {
  const ctx = await requireCustomer();
  const input = await parseJson(req, addressCreateSchema);
  const zoneId = await resolveZoneId(input.city, input.zoneId);
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) await tx.address.updateMany({ where: { customerId: ctx.customer.id }, data: { isDefault: false } });
    const a = await tx.address.create({ data: { ...input, zoneId, customerId: ctx.customer.id } });
    await audit(ctx, { action: "address.create", entityType: "Address", entityId: a.id, after: a }, tx);
    return a;
  });
});
