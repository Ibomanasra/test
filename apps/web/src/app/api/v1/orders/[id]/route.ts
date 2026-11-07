import { requireCustomer } from "@/server/auth/context";
import { apiRoute } from "@/server/http";
import { getOrder } from "@/server/services/orders";

/** Kundenansicht: ohne Einkaufspreise, Preisherleitung und interne Notizen */
export const GET = apiRoute<{ id: string }>(async (_req, { params }) => {
  const ctx = await requireCustomer();
  const o = await getOrder((await params).id, ctx.customer.id);
  const { costTotal: _c, internalNote: _n, placedBy: _p, events, items, ...rest } = o;
  return {
    ...rest,
    events: events.map((e) => ({ toStatus: e.toStatus, createdAt: e.createdAt })),
    // Lagerplatz ist intern – Foto und Beschreibung bleiben
    items: items.map(({ unitCost: _u, priceTrace: _t, priceRuleRef: _r, belowMargin: _b, overriddenById: _o, variant, ...i }) => ({
      ...i,
      imageId: variant.product.images[0]?.fileId ?? null,
    })),
  };
});
