import "server-only";
import { forbidden } from "../errors";
import { requireCustomer } from "./context";

/** Nur freigegebene Händler (Kanal B2B) */
export async function requireB2BCustomer() {
  const ctx = await requireCustomer();
  if (ctx.channel !== "B2B") throw forbidden("b2b_only");
  return ctx;
}
