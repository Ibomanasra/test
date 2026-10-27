/** Formularwerte einer Produktvariante (Server und Client) */
export interface VariantValues {
  sku: string;
  barcode: string;
  nameAr: string;
  nameEn: string;
  minStock: string;
  defaultBinCode: string;
  active: boolean;
  units: Record<string, { factor: string; barcode: string }>;
  rules: Record<"B2C" | "B2B", { defaultUnitCode: string; allowed: string[]; minQtyBase: string; qtyStepBase: string }>;
  costPrice?: string;
  b2cPrice?: string;
  b2bBasePrice?: string;
}

export const emptyVariant = (): VariantValues => ({
  sku: "",
  barcode: "",
  nameAr: "",
  nameEn: "",
  minStock: "0",
  defaultBinCode: "",
  active: true,
  units: { PIECE: { factor: "1", barcode: "" }, CARTON: { factor: "12", barcode: "" } },
  rules: {
    B2C: { defaultUnitCode: "PIECE", allowed: ["PIECE"], minQtyBase: "1", qtyStepBase: "1" },
    B2B: { defaultUnitCode: "CARTON", allowed: ["CARTON", "PIECE"], minQtyBase: "12", qtyStepBase: "12" },
  },
  costPrice: "",
  b2cPrice: "",
  b2bBasePrice: "",
});

