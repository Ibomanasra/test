import { requireCustomer } from "@/server/auth/context";
import { apiRoute } from "@/server/http";
import { checkoutOptions } from "@/server/services/orders";

export const GET = apiRoute(async () => checkoutOptions(await requireCustomer()));
