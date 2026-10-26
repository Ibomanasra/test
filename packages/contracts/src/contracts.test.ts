import { describe, expect, it } from "vitest";
import {
  deliveryZoneSchema,
  otpVerifySchema,
  passwordSchema,
  registerB2BSchema,
  roleUpsertSchema,
} from "./index";

describe("contracts", () => {
  it("normalizes phone and OTP code", () => {
    const r = otpVerifySchema.parse({ phone: "059 912 3456", code: "١٢٣ ٤٥٦" });
    expect(r).toEqual({ phone: "+970599123456", code: "123456", client: "WEB" });
    expect(otpVerifySchema.safeParse({ phone: "123", code: "123456" }).success).toBe(false);
    expect(otpVerifySchema.safeParse({ phone: "0599123456", code: "12345" }).success).toBe(false);
  });

  it("validates B2B registration", () => {
    const base = {
      registrationToken: "x".repeat(20),
      name: "أحمد",
      companyName: "سوبرماركت النور",
      ownerName: "أحمد علي",
      dealerNumber: "562345678",
      address: { zoneId: "z1", city: "الخليل" },
    };
    expect(registerB2BSchema.safeParse(base).success).toBe(true);
    expect(registerB2BSchema.safeParse({ ...base, dealerNumber: "12AB" }).success).toBe(false);
    expect(registerB2BSchema.parse({ ...base, email: "" }).email).toBeUndefined();
  });

  it("rejects unknown permissions in roles", () => {
    const ok = roleUpsertSchema.safeParse({ key: "cashier", nameAr: "كاشير", nameEn: "Cashier", permissions: ["order.view"] });
    expect(ok.success).toBe(true);
    const bad = roleUpsertSchema.safeParse({ key: "cashier", nameAr: "كاشير", nameEn: "Cashier", permissions: ["root"] });
    expect(bad.success).toBe(false);
  });

  it("requires one rate per channel for delivery zones", () => {
    const rate = { feeGrossAgorot: 1500, minOrderAgorot: 5000, freeFromAgorot: null };
    const zone = { code: "HEBRON", nameAr: "الخليل", nameEn: "Hebron" };
    expect(deliveryZoneSchema.safeParse({ ...zone, rates: [{ ...rate, channel: "B2C" }, { ...rate, channel: "B2B" }] }).success).toBe(true);
    expect(deliveryZoneSchema.safeParse({ ...zone, rates: [{ ...rate, channel: "B2C" }, { ...rate, channel: "B2C" }] }).success).toBe(false);
    expect(deliveryZoneSchema.safeParse({ ...zone, rates: [{ ...rate, channel: "B2C", feeGrossAgorot: 1.5 }, { ...rate, channel: "B2B" }] }).success).toBe(false);
  });

  it("enforces password strength", () => {
    expect(passwordSchema.safeParse("short1").success).toBe(false);
    expect(passwordSchema.safeParse("onlyletterslong").success).toBe(false);
    expect(passwordSchema.safeParse("Sholat2026secure").success).toBe(true);
  });
});
