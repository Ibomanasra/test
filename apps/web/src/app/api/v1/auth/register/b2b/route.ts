import { registerB2BSchema } from "@sa/contracts";
import { issueSession } from "@/server/auth/issue";
import { createSession } from "@/server/auth/session";
import { badRequest } from "@/server/errors";
import { apiRoute } from "@/server/http";
import { getRequestMeta } from "@/server/request-meta";
import { readRegistrationTicket } from "@/server/services/auth";
import { registerB2B } from "@/server/services/customers";

/** multipart/form-data: "data" (JSON nach registerB2BSchema) + "license" (PDF/JPG/PNG/WEBP) */
export const POST = apiRoute(async (req) => {
  const form = await req.formData().catch(() => {
    throw badRequest("invalid_form");
  });
  const raw = form.get("data");
  const file = form.get("license");
  if (typeof raw !== "string") throw badRequest("invalid_form");
  if (!(file instanceof File)) throw badRequest("license_required");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw badRequest("invalid_json");
  }
  const input = registerB2BSchema.parse(json);
  const phone = readRegistrationTicket(input.registrationToken);
  const { user, customer } = await registerB2B(phone, input, {
    data: Buffer.from(await file.arrayBuffer()),
    originalName: file.name,
  });
  const meta = await getRequestMeta();
  const client = req.headers.get("x-client") === "mobile" ? "MOBILE" : "WEB";
  const s = await createSession({ userId: user.id, kind: "CUSTOMER", mfaPassed: true, client, ip: meta.ip, userAgent: meta.userAgent });
  return { customer: { id: customer.id, number: customer.number, status: customer.status }, ...(await issueSession(s, client)) };
});
