import { getAuth } from "@/server/auth/context";
import { apiRoute } from "@/server/http";
import { intentForViewer, refreshIntent } from "@/server/services/card-payments";

/** Zahlungsstatus (App fragt nach der Rückkehr von der Bezahlseite ab) */
export const GET = apiRoute<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  await intentForViewer(await getAuth(), id);
  const status = await refreshIntent(id);
  const intent = await intentForViewer(await getAuth(), id);
  return { status, orderId: intent.order.id, orderNumber: intent.order.number, amount: intent.amount, paymentStatus: intent.order.paymentStatus };
});
