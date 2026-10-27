import { z } from "zod";
import { FakeGateway, paymentGateway } from "@/server/adapters/payment";
import { getAuth } from "@/server/auth/context";
import { notFound } from "@/server/errors";
import { apiRoute, parseJson } from "@/server/http";
import { handleCallback, intentForViewer } from "@/server/services/card-payments";

/** Nur Entwicklung/Tests: simulierte Bezahlseite bestätigt oder lehnt ab (signierter Callback) */
export const POST = apiRoute<{ id: string }>(async (req, { params }) => {
  const gw = paymentGateway();
  if (!(gw instanceof FakeGateway)) throw notFound();
  const { id } = await params;
  const intent = await intentForViewer(await getAuth(), id);
  const { approved } = await parseJson(req, z.object({ approved: z.boolean() }));
  const body = JSON.stringify({ intentId: id, approved, amount: intent.amount });
  const status = await handleCallback("fake", body, new Headers({ "x-fake-signature": gw.sign(body) }));
  return { status };
});
