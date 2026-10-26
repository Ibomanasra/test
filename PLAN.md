# Sholat Aljanoub – Plan

Stand: 2026-10-26 · Status: **freigegeben; Phase 1 umgesetzt** (siehe CHANGELOG.md)

---

## 1. Ordnerstruktur

```
sholat-aljanoub/
├─ apps/
│  ├─ web/                      Next.js 15 (App Router, TS) – Shop + Admin + REST-API
│  │  ├─ src/app/[locale]/(shop)/…        Shop (B2C/B2B), Konto, Checkout
│  │  ├─ src/app/[locale]/admin/…         Admin (eigenes Layout, Rechte-Guard)
│  │  ├─ src/app/[locale]/driver/…        Fahreransicht (mobil-optimiert)
│  │  ├─ src/app/api/v1/…                 REST-API (auch für die Mobile-App)
│  │  ├─ src/server/                      Serverseitige Logik (nie im Client-Bundle)
│  │  │  ├─ auth/        Sessions, OTP, Passwort, Guards (requirePermission)
│  │  │  ├─ services/    Use-Cases (orders, pricing, customers …)
│  │  │  ├─ dto/         Ausgabe-Mapper je Kanal (B2B-Preis-Schutz!)
│  │  │  ├─ adapters/    SMS, WhatsApp, Payment-Gateway, Storage (MinIO)
│  │  │  └─ audit.ts
│  │  ├─ messages/ar.json, en.json        next-intl
│  │  └─ public/fonts/                    IBM Plex Sans Arabic (lokal, woff2)
│  └─ mobile/                   Expo (Phase 6)
├─ packages/
│  ├─ core/                     Reine TS-Logik, keine Framework-Abhängigkeit
│  │  ├─ money.ts               Agorot-Arithmetik, Rundung, Formatierung
│  │  ├─ tax.ts                 Netto/Brutto, Rückrechnung, Summen
│  │  ├─ pricing.ts             resolvePrice() (Phase 2)
│  │  ├─ numbering.ts           Format/Parse von Belegnummern
│  │  ├─ permissions.ts         Permission-Keys + Standardrollen
│  │  └─ order-status.ts        Erlaubte Statusübergänge
│  ├─ contracts/                Zod-Schemas für API Ein-/Ausgaben (Web + Mobile)  ← Zusatz
│  ├─ db/                       Prisma-Schema, Migrationen, Seed, Client-Export
│  ├─ pdf/                      HTML/CSS-Vorlagen + Playwright-Renderer (Phase 4)
│  └─ config/                   gemeinsame tsconfig, eslint, tailwind-preset   ← Zusatz
├─ docker/                      Dockerfiles (web, pdf-worker), init-Skripte
├─ scripts/                     backup.sh, restore.sh, remove-demo-data.ts
├─ e2e/                         Playwright-Tests
├─ docker-compose.yml           app, postgres, mailpit, minio (+ minio-init)
├─ .env.example
├─ README.md · DECISIONS.md · CHANGELOG.md · ROADMAP.md
└─ pnpm-workspace.yaml · turbo.json
```

## 2. Datenmodell

Vollständiger Entwurf: [`packages/db/prisma/schema.prisma`](packages/db/prisma/schema.prisma) — mit `prisma validate` geprüft, alle Phasen abgedeckt, damit spätere Phasen keine größeren Umbauten brauchen.

| Bereich | Modelle |
|---|---|
| Einstellungen | `CompanySettings` (Singleton), `BankAccount`, `TaxRate` (mit Gültigkeit), `RoundingRule`, `DeliveryZone` + `DeliveryZoneRate` (pro Kanal: Gebühr, Mindestwert, Gratis ab), `PaymentMethodConfig`, `NumberSequence`, `DocumentTemplateText`, `AutoPrintRule`, `Setting` |
| Auth & Rechte | `User` (STAFF/CUSTOMER), `Session`, `OtpChallenge`, `RateLimitBucket`, `Role` (Permissions als String-Array, konfigurierbar), `UserRole`, `AuditLog` |
| Kunden | `Customer` (Konto, B2C/B2B, Status, Gruppe, Zahlungsziel, Kreditlimit), `CustomerMember` (mehrere Benutzer pro Firma), `Address`, `CustomerNote`, `CustomerFile`, `CustomerGroup` |
| Katalog | `Category` (Baum), `Brand`, `Product`, `ProductImage`, `ProductVariant` (**Preise, SKU, EAN**), `UnitOfMeasure`, `VariantUnit` (Umrechnung), `VariantChannelRule` (Einheit/Mindestmenge/Schritt pro Kanal) |
| Preise | `PriceList` + `PriceListItem`, `TierPrice`, `CustomerPrice`, `CategoryDiscount`, `Promotion` + `PromotionTarget`, `Quote` + `QuoteItem`, `ScheduledPriceChange`, `PriceChangeBatch`, `PriceHistory` |
| Lager | `Warehouse`, `Bin`, `StockLevel` (onHand/reserved), `StockMovement` (Journal), `StockReservation`, `Stocktake` + `StocktakeLine` |
| Einkauf | `Supplier`, `PurchaseOrder` + Items, `GoodsReceipt` + Items |
| Shop | `Cart` + `CartItem` (**ohne Preise**), `SavedOrderList` + Items |
| Bestellungen | `Order` (Snapshots, Rückstand via `parentOrderId`), `OrderItem` (Preis + `priceRule` + `priceTrace`), `OrderStatusEvent` |
| Lieferung | `Shipment` (= Lieferschein, Teillieferung) + Items, `Tour`, `TourStop`, `CashCollection`, `CashClosing` |
| Finanzen | `Invoice` + Lines (unveränderlich), `CreditNote` + Lines, `Return` + Items, `Payment` + `PaymentAllocation`, `CustomerLedgerEntry` (Journal für Kontoauszug), `DunningNotice`, `PaymentIntent` (Gateway) |
| Dokumente | `ArchivedDocument` (PDF-Archiv, `frozen`), `PrintJob` (Sammel-/Auto-Druck), `NotificationLog` |

**Kernprinzipien**
- Geld = `Int` Agorot, Prozent = `Int` Basispunkte, Menge = `Int` Basiseinheit (Stück).
- Preise hängen an der **Variante** (jedes Produkt hat ≥ 1 Variante) und beziehen sich auf die Basiseinheit; Karton-Preis = Stückpreis × Faktor.
- Belege speichern **Snapshots** (Name, Preis, Steuersatz, Adresse, Firmendaten).
- Warenkorb speichert **nie** Preise → Client kann keine Preise einschleusen.
- Bestand: `StockMovement` ist das Journal, `StockLevel` die per Zeilen-Lock gepflegte Summe.
- Rechnungs-/Gutschriftnummern: `NumberSequence` mit `SELECT … FOR UPDATE` in der Beleg-Transaktion → lückenlos; DB-Trigger verhindert `UPDATE`/`DELETE` auf `Invoice`/`InvoiceLine`/`CreditNote` (außer Zahlungsstatus-Feldern).

## 3. Phase 1 – Grundgerüst (Arbeitspakete)

| # | Paket | Ergebnis |
|---|---|---|
| 1.1 | **Monorepo** | pnpm workspaces + Turborepo, TS strict, ESLint, Prettier, Vitest-Setup, gemeinsame Configs |
| 1.2 | **Docker** | `docker compose up` startet postgres 16, minio (+ Bucket-Init), mailpit, web (führt Migration + Seed aus). Dev-Variante mit Hot-Reload. `.env.example` vollständig |
| 1.3 | **DB** | Schema oben als erste Migration, zusätzliche SQL: CHECK-Constraints (Beträge ≥ 0, genau-eins-Ziel bei Rabatt/Aktion), Unveränderlichkeits-Trigger für Rechnungen |
| 1.4 | **core-Basis** | `money.ts`, `tax.ts` (inkl. Rückrechnung brutto→netto, Summen-Ausgleich), `numbering.ts`, `permissions.ts`, `order-status.ts` – **mit vollständigen Unit-Tests** |
| 1.5 | **Auth** | Telefon-OTP (6 Ziffern, 5 Min., max. 5 Versuche, gehasht), Rate-Limit pro Telefon und IP, Session-Cookie (httpOnly, SameSite=Lax, DB-Session) + Bearer-Token für Mobile. Admin: Passwort (argon2id) **und** OTP. SMS-Adapter loggt in Dev in `NotificationLog` + Konsole |
| 1.6 | **Rollen & Rechte** | 6 Systemrollen (Inhaber, Vertrieb, Preisverwaltung, Lager, Fahrer, Buchhaltung) mit ~60 Permission-Keys; `requirePermission()` für Route-Handler, Server Actions und Seiten; Admin-UI zum Bearbeiten von Rollen/Benutzern |
| 1.7 | **Audit-Log** | `withAudit()`-Wrapper für Mutationen (vorher/nachher), Admin-Liste mit Filter |
| 1.8 | **i18n + RTL** | next-intl, `/ar` (Standard) und `/en`, `dir` am `<html>`, nur logische CSS-Properties (ESLint-Regel gegen `ml-/mr-/pl-/pr-/left/right`), lateinische Ziffern (`ar-u-nu-latn`), Sprachumschalter, Fonts lokal |
| 1.9 | **Layouts** | Shop: Header (Suche, Konto, Warenkorb, Sprache), Footer, responsive Navigation. Admin: Sidebar mit allen Modulen aus 5.2 (nur nach Rechten sichtbar, leere Module als „in Vorbereitung" + ROADMAP), Fahrer-Layout |
| 1.10 | **Registrierung** | B2C (OTP, Name, Gebiet, Adresse → aktiv) und B2B (Firmendaten, Händlernummer, Lizenz-Upload nach MinIO → `PENDING_APPROVAL`); Admin-Freigabe mit Gruppe/Zahlungsziel/Kreditlimit |
| 1.11 | **Einstellungen (Basis)** | Firmendaten, Logo, MwSt.-Sätze mit Gültigkeit, Liefergebiete + Raten, Zahlungsarten |
| 1.12 | **Seed (Basis)** | Rollen, Inhaber-Admin, je 1 Demo-Benutzer pro Rolle, 8 Liefergebiete, MwSt. 16 %, Nummernkreise, Einheiten, 3 B2B-Gruppen. (Produkte/Bestellungen folgen in Phase 2/3) |
| 1.13 | **Qualität** | `scripts/backup.sh` (pg_dump + MinIO-Mirror), Health-Endpoint, Playwright-Smoke-Test (Login Admin, Sprache umschalten, RTL-Check), CI-Workflow (lint, typecheck, test) |
| 1.14 | **Doku** | README (Start, Admin-Login), DECISIONS, CHANGELOG, ROADMAP |

**Abnahmekriterien Phase 1**
- `cp .env.example .env && docker compose up` → Shop unter `http://localhost:3000/ar` in RTL, Admin unter `/ar/admin`.
- Login per OTP (Code steht in Konsole / Mailpit), Admin-Login mit Passwort + OTP.
- Fahrer-Benutzer bekommt 403 auf `/api/v1/admin/*` – geprüft per Test.
- `pnpm test` grün, inkl. `tax.ts`-Grenzfälle.

## 4. Gesamtphasen (Kurzfassung)

1. Grundgerüst (oben)
2. Preis-Engine `resolvePrice()` + Tests → Admin-Modul Preise (Listen, Gruppen, Sonderpreise, Aktionen, Historie, Vorschau, CSV, Massenänderung, Vorplanung)
3. Katalog, Shop B2C/B2B, Warenkorb, Checkout, Bestellungen, Reservierung, Seed 30 Produkte / 5 Kunden / Bestellungen in allen Status
4. `packages/pdf`: Vorlage-Engine, alle 15 Dokumente, Nummernkreise, Archiv, Sammeldruck, Auto-Druck
5. Lager, Einkauf, Touren/Fahrer, Kassenabschluss, Finanzen, Berichte
6. Expo-App (Kunde + Fahrer), Payment-Gateway-Adapter

## 5. Offene Fragen (mit meiner Standardannahme)

Alle Fragen wurden mit den Vorschlägen beantwortet – siehe `DECISIONS.md` (D14, D22, D23, D27, D28).
