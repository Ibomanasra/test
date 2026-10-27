import { checkoutPreviewSchema } from "@sa/contracts";
import { requireCustomer } from "@/server/auth/context";
import { apiRoute, parseJson } from "@/server/http";
import { previewCheckout } from "@/server/services/orders";

export const POST = apiRoute(async (req) => previewCheckout(await requireCustomer(), await parseJson(req, checkoutPreviewSchema)));
