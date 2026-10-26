import "server-only";
import { WILDCARD } from "@sa/core";
import { prisma } from "@sa/db";
import type { z } from "zod";
import type { roleUpsertSchema, staffCreateSchema, staffUpdateSchema } from "@sa/contracts";
import { audit } from "../audit";
import type { AuthContext } from "../auth/context";
import { hashPassword } from "../auth/password";
import { revokeAllSessions } from "../auth/session";
import { AppError, badRequest, conflict, forbidden, notFound } from "../errors";

type StaffCreate = z.infer<typeof staffCreateSchema>;
type StaffUpdate = z.infer<typeof staffUpdateSchema>;
type RoleUpsert = z.infer<typeof roleUpsertSchema>;

const staffSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  locale: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  roles: { select: { role: { select: { id: true, key: true, nameAr: true, nameEn: true } } } },
} as const;

export function listStaff() {
  return prisma.user.findMany({ where: { kind: "STAFF" }, select: staffSelect, orderBy: { name: "asc" } });
}

export function listRoles() {
  return prisma.role.findMany({ orderBy: [{ isSystem: "desc" }, { key: "asc" }], include: { _count: { select: { users: true } } } });
}

async function assertRoles(roleIds: string[]) {
  const count = await prisma.role.count({ where: { id: { in: roleIds } } });
  if (count !== new Set(roleIds).size) throw badRequest("invalid_role");
}

/** Nur wer selbst alle Rechte hat ("*"), darf die Inhaber-Rolle vergeben. */
async function assertMayGrant(ctx: AuthContext, roleIds: string[]) {
  const roles = await prisma.role.findMany({ where: { id: { in: roleIds } }, select: { permissions: true } });
  const grantsWildcard = roles.some((r) => r.permissions.includes(WILDCARD));
  if (grantsWildcard && !ctx.permissions.has(WILDCARD)) throw forbidden("cannot_grant_owner");
}

export async function createStaff(ctx: AuthContext, input: StaffCreate) {
  if (await prisma.user.findUnique({ where: { phone: input.phone } })) throw conflict("phone_already_registered");
  await assertRoles(input.roleIds);
  await assertMayGrant(ctx, input.roleIds);
  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        kind: "STAFF",
        name: input.name,
        phone: input.phone,
        email: input.email,
        locale: input.locale,
        passwordHash,
        roles: { create: input.roleIds.map((roleId) => ({ roleId })) },
      },
      select: staffSelect,
    });
    await audit(ctx, { action: "user.create", entityType: "User", entityId: user.id, after: user }, tx);
    return user;
  });
}

async function ownerCount(excludingUserId?: string) {
  return prisma.user.count({
    where: {
      kind: "STAFF",
      isActive: true,
      id: excludingUserId ? { not: excludingUserId } : undefined,
      roles: { some: { role: { permissions: { has: WILDCARD } } } },
    },
  });
}

export async function updateStaff(ctx: AuthContext, id: string, input: StaffUpdate) {
  const before = await prisma.user.findFirst({ where: { id, kind: "STAFF" }, select: staffSelect });
  if (!before) throw notFound();
  if (input.roleIds) {
    await assertRoles(input.roleIds);
    await assertMayGrant(ctx, input.roleIds);
  }
  const loosesOwner =
    input.isActive === false ||
    (input.roleIds &&
      !(await prisma.role.count({ where: { id: { in: input.roleIds }, permissions: { has: WILDCARD } } })));
  if (loosesOwner) {
    const wasOwner = await prisma.user.count({ where: { id, roles: { some: { role: { permissions: { has: WILDCARD } } } } } });
    if (wasOwner && (await ownerCount(id)) === 0) throw new AppError(409, "last_owner");
  }
  const passwordHash = input.password ? await hashPassword(input.password) : undefined;

  const after = await prisma.$transaction(async (tx) => {
    if (input.roleIds) {
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({ data: input.roleIds.map((roleId) => ({ userId: id, roleId })) });
    }
    const updated = await tx.user.update({
      where: { id },
      data: { name: input.name, email: input.email, isActive: input.isActive, passwordHash },
      select: staffSelect,
    });
    await audit(ctx, { action: "user.update", entityType: "User", entityId: id, before, after: { ...updated, passwordChanged: !!passwordHash } }, tx);
    return updated;
  });
  // Rechte-/Passwortänderungen sofort wirksam machen
  if (input.isActive === false || passwordHash || input.roleIds) await revokeAllSessions(id);
  return after;
}

export async function upsertRole(ctx: AuthContext, id: string | null, input: RoleUpsert) {
  if (input.permissions.includes(WILDCARD) && !ctx.permissions.has(WILDCARD)) throw forbidden("cannot_grant_owner");
  const permissions = [...new Set(input.permissions)].sort();
  if (!id) {
    if (await prisma.role.findUnique({ where: { key: input.key } })) throw conflict("role_key_exists");
    return prisma.$transaction(async (tx) => {
      const role = await tx.role.create({ data: { ...input, permissions } });
      await audit(ctx, { action: "role.create", entityType: "Role", entityId: role.id, after: role }, tx);
      return role;
    });
  }
  const before = await prisma.role.findUnique({ where: { id } });
  if (!before) throw notFound();
  if (before.permissions.includes(WILDCARD) && !permissions.includes(WILDCARD)) throw new AppError(409, "owner_role_locked");
  return prisma.$transaction(async (tx) => {
    // Systemrollen behalten ihren Schlüssel
    const role = await tx.role.update({
      where: { id },
      data: { nameAr: input.nameAr, nameEn: input.nameEn, permissions, key: before.isSystem ? before.key : input.key },
    });
    await audit(ctx, { action: "role.update", entityType: "Role", entityId: id, before, after: role }, tx);
    return role;
  });
}

export async function deleteRole(ctx: AuthContext, id: string) {
  const role = await prisma.role.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
  if (!role) throw notFound();
  if (role.isSystem) throw new AppError(409, "system_role");
  if (role._count.users > 0) throw new AppError(409, "role_in_use");
  await prisma.$transaction(async (tx) => {
    await tx.role.delete({ where: { id } });
    await audit(ctx, { action: "role.delete", entityType: "Role", entityId: id, before: role }, tx);
  });
}
