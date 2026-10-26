import { describe, expect, it } from "vitest";
import { canPlaceOrders, effectiveChannel } from "./channel";
import {
  ORDER_STATUSES,
  OrderStatusError,
  allowedTransitions,
  assertTransition,
  canTransition,
  holdsReservation,
  isOrderEditable,
  isOrderFinal,
  statusStep,
} from "./order-status";
import {
  ALL_PERMISSIONS,
  SYSTEM_ROLES,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  isPermission,
  mergeRolePermissions,
} from "./permissions";
import { PhoneError, formatPhone, isMobile, isValidPhone, maskPhone, normalizePhone } from "./phone";

describe("permissions", () => {
  it("checks single permissions and wildcard", () => {
    expect(hasPermission(["order.view"], "order.view")).toBe(true);
    expect(hasPermission(["order.view"], "order.edit")).toBe(false);
    expect(hasPermission(["*"], "settings.edit")).toBe(true);
    expect(hasPermission([], "order.view")).toBe(false);
  });

  it("checks all/any", () => {
    expect(hasAllPermissions(["a", "order.view", "order.edit"], ["order.view", "order.edit"])).toBe(true);
    expect(hasAllPermissions(["order.view"], ["order.view", "order.edit"])).toBe(false);
    expect(hasAnyPermission(["order.view"], ["order.view", "order.edit"])).toBe(true);
    expect(hasAnyPermission(["*"], ["settings.edit"])).toBe(true);
  });

  it("merges roles and drops unknown keys", () => {
    const merged = mergeRolePermissions([{ permissions: ["order.view", "bogus"] }, { permissions: ["price.edit"] }]);
    expect([...merged].sort()).toEqual(["order.view", "price.edit"]);
  });

  it("system roles only use known permissions", () => {
    for (const role of SYSTEM_ROLES) {
      for (const p of role.permissions) expect(p === "*" || isPermission(p)).toBe(true);
    }
    expect(SYSTEM_ROLES.map((r) => r.key)).toEqual(["owner", "sales", "pricing", "warehouse", "driver", "accounting"]);
  });

  it("price editing is a separate right not held by sales", () => {
    const sales = SYSTEM_ROLES.find((r) => r.key === "sales")!;
    expect(hasPermission(sales.permissions, "price.view")).toBe(true);
    expect(hasPermission(sales.permissions, "price.edit")).toBe(false);
    expect(hasPermission(sales.permissions, "price.view_cost")).toBe(false);
  });

  it("drivers can only drive", () => {
    const driver = SYSTEM_ROLES.find((r) => r.key === "driver")!;
    const granted = ALL_PERMISSIONS.filter((p) => hasPermission(driver.permissions, p));
    expect(granted).toEqual(["delivery.driver"]);
  });
});

describe("order status", () => {
  it("allows the happy path", () => {
    const path = ["NEW", "CONFIRMED", "PICKING", "READY", "OUT_FOR_DELIVERY", "DELIVERED"] as const;
    for (let i = 0; i < path.length - 1; i++) expect(canTransition(path[i]!, path[i + 1]!)).toBe(true);
  });

  it("forbids skipping and leaving final states", () => {
    expect(canTransition("NEW", "DELIVERED")).toBe(false);
    expect(canTransition("DELIVERED", "CANCELLED")).toBe(false);
    expect(canTransition("CANCELLED", "NEW")).toBe(false);
    expect(canTransition("OUT_FOR_DELIVERY", "CANCELLED")).toBe(false);
    expect(() => assertTransition("NEW", "READY")).toThrow(OrderStatusError);
    expect(allowedTransitions("DELIVERED")).toEqual([]);
  });

  it("allows cancellation before dispatch", () => {
    for (const s of ["NEW", "CONFIRMED", "PICKING", "READY"] as const) expect(canTransition(s, "CANCELLED")).toBe(true);
  });

  it("knows editable/final/reservation states", () => {
    expect(ORDER_STATUSES.filter(isOrderEditable)).toEqual(["NEW"]);
    expect(ORDER_STATUSES.filter(isOrderFinal)).toEqual(["DELIVERED", "CANCELLED"]);
    expect(ORDER_STATUSES.filter(holdsReservation)).toEqual(["NEW", "CONFIRMED", "PICKING", "READY"]);
    expect(statusStep("CANCELLED")).toBe(-1);
    expect(statusStep("DELIVERED")).toBe(5);
  });
});

describe("channel", () => {
  it("gives B2B prices only to approved business customers", () => {
    expect(effectiveChannel(null)).toBe("B2C");
    expect(effectiveChannel({ customerType: "B2C", customerStatus: "ACTIVE" })).toBe("B2C");
    expect(effectiveChannel({ customerType: "B2B", customerStatus: "PENDING_APPROVAL" })).toBe("B2C");
    expect(effectiveChannel({ customerType: "B2B", customerStatus: "REJECTED" })).toBe("B2C");
    expect(effectiveChannel({ customerType: "B2B", customerStatus: "BLOCKED" })).toBe("B2C");
    expect(effectiveChannel({ customerType: "B2B", customerStatus: "ACTIVE" })).toBe("B2B");
  });

  it("blocks ordering for blocked/rejected customers", () => {
    expect(canPlaceOrders(null)).toBe(false);
    expect(canPlaceOrders({ customerType: "B2B", customerStatus: "PENDING_APPROVAL" })).toBe(true);
    expect(canPlaceOrders({ customerType: "B2C", customerStatus: "BLOCKED" })).toBe(false);
    expect(canPlaceOrders({ customerType: "B2B", customerStatus: "REJECTED" })).toBe(false);
  });
});

describe("phone", () => {
  it.each([
    ["0599123456", "+970599123456"],
    ["059 912 3456", "+970599123456"],
    ["0569123456", "+970569123456"],
    ["+970599123456", "+970599123456"],
    ["+9700599123456", "+970599123456"],
    ["00970599123456", "+970599123456"],
    ["٠٥٩٩١٢٣٤٥٦", "+970599123456"],
    ["0522123456", "+972522123456"],
    ["+972 52-212-3456", "+972522123456"],
    ["022221234", "+97022221234"],
    ["+4915112345678", "+4915112345678"],
  ])("normalizes %s → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "123", "05991234", "+97059912345678", "abc", "+12"])("rejects %s", (input) => {
    expect(() => normalizePhone(input)).toThrow(PhoneError);
    expect(isValidPhone(input)).toBe(false);
  });

  it("formats, masks and detects mobiles", () => {
    expect(formatPhone("+970599123456")).toBe("+970 59 912 3456");
    expect(formatPhone("+97022221234")).toBe("+970 2 222 1234");
    expect(maskPhone("+970599123456")).toBe("+97059***3456");
    expect(isMobile("+970599123456")).toBe(true);
    expect(isMobile("+97022221234")).toBe(false);
  });
});
