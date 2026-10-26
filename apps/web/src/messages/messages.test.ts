import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@sa/core";
import ar from "./ar.json";
import en from "./en.json";

function keys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

function leaves(obj: Record<string, unknown>): string[] {
  return Object.values(obj).flatMap((v) => (v && typeof v === "object" ? leaves(v as Record<string, unknown>) : [String(v)]));
}

describe("i18n messages", () => {
  it("ar and en have exactly the same keys", () => {
    expect(keys(ar).sort()).toEqual(keys(en).sort());
  });

  it("has no empty translations", () => {
    for (const v of [...leaves(ar), ...leaves(en)]) expect(v.trim().length).toBeGreaterThan(0);
  });

  it("uses the same ICU placeholders in both languages", () => {
    const get = (obj: unknown, key: string) =>
      String(key.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], obj));
    const flatAr = Object.fromEntries(keys(ar).map((k) => [k, get(ar, k)]));
    const flatEn = Object.fromEntries(keys(en).map((k) => [k, get(en, k)]));
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const k of Object.keys(flatAr)) expect(vars(flatAr[k] ?? ""), k).toEqual(vars(flatEn[k] ?? ""));
  });

  it("translates every permission", () => {
    for (const p of Object.keys(PERMISSIONS)) {
      const key = p.replace(".", "_");
      expect((ar.permissions as Record<string, string>)[key], p).toBeTruthy();
      expect((en.permissions as Record<string, string>)[key], p).toBeTruthy();
    }
  });

  it("does not use Arabic-Indic digits (latin digits required)", () => {
    for (const v of leaves(ar)) expect(v).not.toMatch(/[٠-٩]/);
  });
});
