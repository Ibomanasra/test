/**
 * Demo-Katalog: 30 Beispielprodukte in 6 Kategorien (alle isDemo = true, Name mit „(مثال)“).
 * Preise in Agorot: cost = Einkauf netto, b2c = Endkunde brutto, b2b = Händler netto (pro Stück).
 */

export interface DemoCategory {
  slug: string;
  nameAr: string;
  nameEn: string;
}

export interface DemoProduct {
  sku: string;
  category: string;
  nameAr: string;
  nameEn: string;
  brand?: string;
  cost: number;
  b2c: number;
  b2b: number;
  /** Stück pro Karton */
  carton: number;
  /** Packung (optional, Stück pro Packung) */
  pack?: number;
  /** Mindestmenge B2B in Kartons */
  minCartons?: number;
  minStock: number;
  stock: number;
  bin: string;
  variants?: { suffix: string; nameAr: string; nameEn: string; cost: number; b2c: number; b2b: number }[];
}

export const DEMO_CATEGORIES: DemoCategory[] = [
  { slug: "cleaning", nameAr: "مواد التنظيف", nameEn: "Cleaning products" },
  { slug: "kitchen", nameAr: "أدوات المطبخ", nameEn: "Kitchenware" },
  { slug: "plastic", nameAr: "أدوات بلاستيكية", nameEn: "Plastic goods" },
  { slug: "paper", nameAr: "منتجات ورقية", nameEn: "Paper products" },
  { slug: "bath", nameAr: "مستلزمات الحمام", nameEn: "Bathroom supplies" },
  { slug: "food", nameAr: "مواد غذائية", nameEn: "Groceries" },
];

export const DEMO_PRODUCTS: DemoProduct[] = [
  // Reinigung
  { sku: "CL-001", category: "cleaning", nameAr: "سائل جلي ليمون 1 لتر", nameEn: "Dish soap lemon 1 L", brand: "Fairy", cost: 650, b2c: 1290, b2b: 950, carton: 12, minStock: 48, stock: 240, bin: "A-01-1",
    variants: [{ suffix: "750", nameAr: "750 مل", nameEn: "750 ml", cost: 520, b2c: 990, b2b: 760 }] },
  { sku: "CL-002", category: "cleaning", nameAr: "مسحوق غسيل أوتوماتيك 3 كغ", nameEn: "Laundry powder automatic 3 kg", brand: "Ariel", cost: 2800, b2c: 4990, b2b: 3790, carton: 4, minStock: 20, stock: 80, bin: "A-01-2" },
  { sku: "CL-003", category: "cleaning", nameAr: "كلور مبيض 4 لتر", nameEn: "Bleach 4 L", brand: "Klorin", cost: 900, b2c: 1690, b2b: 1250, carton: 4, minStock: 24, stock: 120, bin: "A-01-3" },
  { sku: "CL-004", category: "cleaning", nameAr: "منظف أرضيات لافندر 2 لتر", nameEn: "Floor cleaner lavender 2 L", cost: 780, b2c: 1490, b2b: 1090, carton: 6, minStock: 30, stock: 18, bin: "A-02-1" },
  { sku: "CL-005", category: "cleaning", nameAr: "منظف زجاج 750 مل", nameEn: "Glass cleaner 750 ml", cost: 450, b2c: 890, b2b: 640, carton: 12, minStock: 24, stock: 96, bin: "A-02-2" },
  { sku: "CL-006", category: "cleaning", nameAr: "ليفة جلي (عبوة 10)", nameEn: "Scouring pads (pack of 10)", cost: 300, b2c: 690, b2b: 450, carton: 24, pack: 10, minStock: 48, stock: 300, bin: "A-02-3" },
  // Küche
  { sku: "KI-001", category: "kitchen", nameAr: "طنجرة ستانلس 24 سم", nameEn: "Stainless pot 24 cm", cost: 4500, b2c: 8990, b2b: 6490, carton: 6, minStock: 6, stock: 30, bin: "B-01-1",
    variants: [{ suffix: "28", nameAr: "28 سم", nameEn: "28 cm", cost: 5600, b2c: 10990, b2b: 7990 }] },
  { sku: "KI-002", category: "kitchen", nameAr: "مقلاة تيفال 28 سم", nameEn: "Non-stick frying pan 28 cm", cost: 3800, b2c: 7490, b2b: 5390, carton: 6, minStock: 6, stock: 24, bin: "B-01-2" },
  { sku: "KI-003", category: "kitchen", nameAr: "طقم سكاكين 6 قطع", nameEn: "Knife set 6 pcs", cost: 2900, b2c: 5990, b2b: 4190, carton: 10, minStock: 10, stock: 40, bin: "B-01-3" },
  { sku: "KI-004", category: "kitchen", nameAr: "لوح تقطيع خشب", nameEn: "Wooden cutting board", cost: 900, b2c: 1990, b2b: 1350, carton: 20, minStock: 20, stock: 60, bin: "B-02-1" },
  { sku: "KI-005", category: "kitchen", nameAr: "كاسات زجاج (6 قطع)", nameEn: "Drinking glasses (6 pcs)", cost: 1200, b2c: 2490, b2b: 1790, carton: 8, pack: 6, minStock: 16, stock: 64, bin: "B-02-2" },
  { sku: "KI-006", category: "kitchen", nameAr: "ترمس قهوة 1 لتر", nameEn: "Coffee thermos 1 L", cost: 2200, b2c: 4490, b2b: 3190, carton: 12, minStock: 12, stock: 8, bin: "B-02-3" },
  // Plastik
  { sku: "PL-001", category: "plastic", nameAr: "سطل بلاستيك 10 لتر", nameEn: "Plastic bucket 10 L", cost: 450, b2c: 990, b2b: 690, carton: 20, minStock: 40, stock: 200, bin: "C-01-1" },
  { sku: "PL-002", category: "plastic", nameAr: "سلة غسيل كبيرة", nameEn: "Large laundry basket", cost: 1100, b2c: 2290, b2b: 1590, carton: 10, minStock: 20, stock: 50, bin: "C-01-2" },
  { sku: "PL-003", category: "plastic", nameAr: "علب حفظ طعام (طقم 5)", nameEn: "Food containers (set of 5)", cost: 1400, b2c: 2990, b2b: 2090, carton: 12, minStock: 24, stock: 72, bin: "C-01-3" },
  { sku: "PL-004", category: "plastic", nameAr: "سلة مهملات بدواسة 20 لتر", nameEn: "Pedal bin 20 L", cost: 1900, b2c: 3990, b2b: 2790, carton: 6, minStock: 12, stock: 36, bin: "C-02-1" },
  { sku: "PL-005", category: "plastic", nameAr: "كراسي بلاستيك", nameEn: "Plastic chair", cost: 2300, b2c: 4490, b2b: 3290, carton: 4, minStock: 16, stock: 12, bin: "C-02-2" },
  // Papier
  { sku: "PA-001", category: "paper", nameAr: "محارم وجه 10 علب", nameEn: "Facial tissues 10 boxes", brand: "Fine", cost: 1500, b2c: 2690, b2b: 1990, carton: 5, pack: 10, minStock: 25, stock: 150, bin: "D-01-1" },
  { sku: "PA-002", category: "paper", nameAr: "ورق تواليت 32 رول", nameEn: "Toilet paper 32 rolls", brand: "Fine", cost: 2600, b2c: 4490, b2b: 3390, carton: 2, minStock: 20, stock: 100, bin: "D-01-2" },
  { sku: "PA-003", category: "paper", nameAr: "محارم مطبخ 6 رول", nameEn: "Kitchen towels 6 rolls", cost: 1100, b2c: 1990, b2b: 1490, carton: 4, minStock: 20, stock: 80, bin: "D-01-3" },
  { sku: "PA-004", category: "paper", nameAr: "صحون ورق (50 قطعة)", nameEn: "Paper plates (50 pcs)", cost: 500, b2c: 990, b2b: 720, carton: 20, minStock: 40, stock: 160, bin: "D-02-1" },
  { sku: "PA-005", category: "paper", nameAr: "أكياس قمامة كبيرة (20)", nameEn: "Large garbage bags (20)", cost: 400, b2c: 890, b2b: 590, carton: 30, minStock: 60, stock: 45, bin: "D-02-2" },
  // Bad
  { sku: "BA-001", category: "bath", nameAr: "شامبو 700 مل", nameEn: "Shampoo 700 ml", brand: "Head & Shoulders", cost: 1300, b2c: 2490, b2b: 1850, carton: 12, minStock: 24, stock: 120, bin: "E-01-1" },
  { sku: "BA-002", category: "bath", nameAr: "صابون سائل لليدين 500 مل", nameEn: "Liquid hand soap 500 ml", cost: 450, b2c: 990, b2b: 680, carton: 12, minStock: 36, stock: 180, bin: "E-01-2" },
  { sku: "BA-003", category: "bath", nameAr: "معجون أسنان 100 مل", nameEn: "Toothpaste 100 ml", brand: "Colgate", cost: 500, b2c: 990, b2b: 720, carton: 24, minStock: 48, stock: 240, bin: "E-01-3" },
  { sku: "BA-004", category: "bath", nameAr: "منشفة حمام قطن", nameEn: "Cotton bath towel", cost: 1800, b2c: 3490, b2b: 2490, carton: 10, minStock: 10, stock: 40, bin: "E-02-1" },
  // Lebensmittel
  { sku: "FO-001", category: "food", nameAr: "زيت زيتون 1 لتر", nameEn: "Olive oil 1 L", cost: 3200, b2c: 4990, b2b: 3990, carton: 12, minStock: 24, stock: 96, bin: "F-01-1" },
  { sku: "FO-002", category: "food", nameAr: "أرز مصري 5 كغ", nameEn: "Egyptian rice 5 kg", cost: 1900, b2c: 2990, b2b: 2390, carton: 4, minStock: 20, stock: 60, bin: "F-01-2" },
  { sku: "FO-003", category: "food", nameAr: "سكر 2 كغ", nameEn: "Sugar 2 kg", cost: 650, b2c: 1090, b2b: 820, carton: 10, minStock: 50, stock: 30, bin: "F-01-3" },
  { sku: "FO-004", category: "food", nameAr: "شاي (100 كيس)", nameEn: "Tea (100 bags)", brand: "Lipton", cost: 900, b2c: 1690, b2b: 1190, carton: 24, minStock: 48, stock: 144, bin: "F-02-1" },
];

/** EAN-13 aus dem firmeninternen Bereich 200–299 mit gültiger Prüfziffer. */
export function demoEan(index: number): string {
  const body = `200${String(index).padStart(9, "0")}`;
  const sum = body.split("").reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return body + String((10 - (sum % 10)) % 10);
}
