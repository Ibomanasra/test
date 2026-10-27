/** Antwortformen der /api/v1 (Ausschnitt, nur was die App nutzt) */

export interface Unit {
  code: string;
  nameAr: string;
  nameEn: string;
  factor: number;
}

export interface Variant {
  id: string;
  sku: string;
  nameAr: string | null;
  nameEn: string | null;
  units: Unit[];
  defaultUnit: string;
  minQtyBase: number;
  qtyStepBase: number;
  availability: "in_stock" | "low" | "out";
  unitPrice: number;
  unitGross: number;
  listUnitPrice: number | null;
  promotion: boolean;
  tiers?: { minQtyBase: number; unitPrice: number }[];
}

export interface Product {
  id: string;
  slug: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  imageIds: string[];
  channel: "B2B" | "B2C";
  variants: Variant[];
}

export interface CartLine {
  id: string;
  variantId: string;
  sku: string;
  nameAr: string;
  nameEn: string;
  unitCode: string;
  unitNameAr: string;
  unitNameEn: string;
  qty: number;
  lineTotal: number;
  problem: string | null;
}

export interface Cart {
  channel: "B2B" | "B2C";
  lines: CartLine[];
  goodsValue: number;
  gross: number;
  hasProblems: boolean;
}

export interface CheckoutOptions {
  channel: "B2B" | "B2C";
  addresses: { id: string; recipient: string; city: string; street: string | null; zone: { nameAr: string; nameEn: string }; deliveryDates: string[] }[];
  paymentMethods: { method: string; labelAr: string; labelEn: string }[];
  credit: { available: number } | null;
}

export interface OrderSummary {
  id: string;
  number: string;
  status: string;
  placedAt: string;
  totalGross: number;
  paymentMethod: string;
  paymentStatus: string;
}

export interface OrderDetail extends OrderSummary {
  items: { id: string; skuSnapshot: string; nameArSnapshot: string; nameEnSnapshot: string; qty: number; unitCode: string; lineGross: number; lineNet: number }[];
  invoices: { id: string; number: string; totalGross: number }[];
  shipments: { id: string; number: string }[];
  channel: "B2B" | "B2C";
  subtotalNet: number;
  vatTotal: number;
  deliveryFeeGross: number;
}

export interface DriverStop {
  id: string;
  sequence: number;
  status: "PENDING" | "DELIVERED" | "FAILED" | "SKIPPED";
  codExpected: number;
  failReason: string | null;
  shipmentId: string;
  shipment: { number: string; order: { number: string; paymentMethod: string; addressSnapshot: { recipient?: string; phone?: string; city?: string; street?: string; details?: string } | null; customer: { displayName: string; phone: string | null } } };
}

export interface DriverTour {
  id: string;
  number: string;
  date: string;
  status: string;
  stops: DriverStop[];
}
