export const CUSTOMER_STATUS_TONE = { ACTIVE: "green", PENDING_APPROVAL: "amber", REJECTED: "red", BLOCKED: "red" } as const;
export const ORDER_STATUS_TONE = {
  NEW: "amber",
  CONFIRMED: "blue",
  PICKING: "blue",
  READY: "brand",
  OUT_FOR_DELIVERY: "brand",
  DELIVERED: "green",
  CANCELLED: "neutral",
} as const satisfies Record<string, "neutral" | "green" | "amber" | "red" | "blue" | "brand">;
