import { customerLoginSchema } from "@sa/contracts";
import { issueSession } from "@/server/auth/issue";
import { apiRoute, parseJson } from "@/server/http";
import { getRequestMeta } from "@/server/request-meta";
import { customerPasswordLogin } from "@/server/services/auth";
import { mergeGuestCart } from "@/server/services/cart";
import { prisma } from "@sa/db";

/** Kunden: Telefon + Passwort → angemeldet (Gast-Warenkorb wird übernommen) */
export const POST = apiRoute(async (req) => {
  const { phone, password, client } = await parseJson(req, customerLoginSchema);
  const meta = await getRequestMeta();
  const s = await customerPasswordLogin(phone, password, { ip: meta.ip, userAgent: meta.userAgent, client });
  const member = await prisma.customerMember.findFirst({ where: { user: { phone } }, select: { customerId: true } });
  if (member) await mergeGuestCart(member.customerId);
  return issueSession(s, client);
});
