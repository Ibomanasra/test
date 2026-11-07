import "server-only";
import { prisma } from "@sa/db";
import { cache } from "react";

/** Laufende Produktaktionen (einmal je Anfrage geladen) für Schilder im Shop */
export const activePromotionInfo = cache(async () => {
  const now = new Date();
  const rows = await prisma.promotion.findMany({
    where: { active: true, startsAt: { lte: now }, endsAt: { gt: now } },
    select: { id: true, type: true, percentBps: true, buyQty: true, getQty: true, endsAt: true },
  });
  return new Map(rows.map((r) => [r.id, { ...r, daysLeft: Math.ceil((r.endsAt.getTime() - now.getTime()) / 86_400_000) }]));
});
