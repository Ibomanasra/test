# Changelog

## [0.3.0] – 2026-10-27 – Phase 3: Katalog, Shop, Warenkorb, Checkout, Bestellungen

### Hinzugefügt
- **Produktverwaltung**: Produkte mit Varianten, SKU/EAN, Einheiten (Stück/Packung/Karton/Palette mit Faktor und eigenem Barcode), Bildern (MinIO), Texten AR/EN, Sichtbarkeit und Mengenregeln pro Kanal; Kategorien; CSV-/Excel-Import mit Vorschau und Export.
- **Katalog & Suche** (AR/EN, SKU, Barcode), Kategorie- und Aktionsfilter, Verfügbarkeitsanzeige; Kanal-DTOs an genau einer Stelle (`server/services/catalog.ts`) – Einkaufs- und B2B-Basispreis werden nie selektiert, Staffeln nur für freigegebene Händler.
- **Warenkorb** ohne gespeicherte Preise (Preise immer serverseitig für den Kanal des Betrachters), Gast-Warenkorb per Cookie, Übernahme beim Login; Angebot in den Warenkorb übernehmen (B2B).
- **Checkout**: Lieferadresse/-gebiet mit Gebühr und Gratis-Grenze, Mindestbestellwert, Liefertage nach Gebiet (Freitag frei, Annahmeschluss 14 Uhr), Zahlungsarten je Kanal, Kreditlimit-Prüfung in der Transaktion (Kundenzeile gesperrt), Lagerreservierung mit `SELECT … FOR UPDATE` – keine Überverkäufe.
- **Bestellungen**: Statusfluss Neu → Bestätigt → Kommissionierung → Bereit → Unterwegs (Lieferschein-Nummer, Warenausgang, Teillieferung mit Rückstand oder Storno) → Zugestellt; fehlgeschlagene Zustellung bucht zurück; Stornierung gibt Reservierungen frei; Bearbeitung nur im Status „Neu“ (manueller Preis mit eigenem Recht und Margenschutz); Statusverlauf; SMS-/WhatsApp-Benachrichtigung über den Log-Adapter.
- **B2B-Extras**: Schnellbestellung (SKU + Menge, auch CSV), „Bestellung wiederholen“, Bestelllisten, Kontoauszug, Dokumente, Angebote im Kundenkonto.
- **Dashboard**: Umsatz und Marge B2B vs. B2C, Artikel unter Mindestbestand, offene Forderungen, Bargeld bei Fahrern.
- **Demo-Bestellungen** in allen Status (`pnpm db:demo-orders`), erzeugt über die echten Services.
- **E2E**: „B2B-Preis nie im HTML/JSON für Gast und B2C“ (inkl. Gegenprobe Händler), B2C-Bestellung mit Nachnahme, B2B-Schnellbestellung auf Rechnung.

### Geändert
- Fehler `OrderStatusError` → HTTP 409 statt 500; Positionswerte werden nach Teillieferung auf die tatsächliche Menge neu berechnet.

## [0.2.0] – 2026-10-26 – Phase 2: Preis-Engine & Preisverwaltung

### Hinzugefügt
- `resolvePrice(product, customer, qty, date, channel)` in `packages/core/src/pricing.ts`: B2B-Kette (Preisliste/Gruppenrabatt → Staffel → Kategorie-Rabatt) im Wettbewerb mit Sonderpreis, Aktion und Angebot; fixe Angebote/Sonderpreise gewinnen; B2C mit Aktion und Rundungsregeln; „Kaufe X, bekomme Y“; vollständige Begründung (Trace) – 50 neue Unit-Tests.
- Mengenregeln (`checkQuantity`), Margenschutz (`minimumPriceNet`, `isBelowMargin`), Massenpreisänderung (`bulkAdjust`).
- Admin-Menü **Preise**: Übersicht mit Marge und Warnung, Gruppen, Preislisten, Staffeln, Sonderpreise, Kategorie-Rabatte, Aktionen, Rundung, geplante Preise, Massenänderung mit Vorschau (sofort oder geplant), CSV-/Excel-Import mit Vorschau und Export, Preis-Historie, Preisvorschau mit Regel-Erklärung.
- Margenschutz: Preise unter Einkauf + Mindestmarge nur mit bewusster Bestätigung (eigenes Recht), protokolliert.
- **Angebote**: Admin erstellt/bearbeitet/versendet, Händler fordert an, nimmt an oder lehnt ab; Ablauf-Job.
- Hintergrundjobs (`instrumentation.ts`): geplante Preise, abgelaufene Angebote.
- Demo-Katalog: 30 Produkte in 6 Kategorien mit Einheiten, Lagerplätzen, Anfangsbestand und Preisregeln.

## [0.1.0] – 2026-10-26 – Phase 1: Grundgerüst

### Hinzugefügt
- **Monorepo** (pnpm + Turborepo): `apps/web`, `packages/core`, `packages/contracts`, `packages/db`, `packages/config`.
- **Docker Compose**: Postgres 16, MinIO, Mailpit, Web (Migration + idempotenter Seed beim Start, Healthcheck).
- **Datenmodell** für alle Phasen (85 Modelle) + Integritäts-Migration: CHECK-Constraints, unveränderliche Rechnungen/Gutschriften, nur-anhängen-Journale, Trigramm-Suchindizes.
- **packages/core**: Agorot-Arithmetik, MwSt. (B2B netto / B2C brutto, Rundung pro Position), Belegnummern (Jahr in Asia/Hebron), Rechte/Rollen, Bestellstatus, Telefonnummern (+970/+972), Preiskanal – 124 Unit-Tests.
- **Lückenlose Nummernvergabe** (`allocateDocumentNumber`) mit Integrationstests (Parallelität, Rollback, Jahreswechsel).
- **Auth**: Telefon-OTP (gehasht, Ablauf, Versuchslimit, Rate-Limit), Mitarbeiter mit Passwort (argon2id) + OTP, DB-Sessions (Cookie für Web, Bearer für Mobile), CSRF-Schutz.
- **Rollen & Rechte**: 6 Systemrollen, 50 Rechte, im Admin frei konfigurierbar; Prüfung in jedem API-Endpunkt und jeder Seite; Schutz vor Entzug des letzten Inhabers.
- **Audit-Log** (wer, was, wann, vorher/nachher; Geheimnisse geschwärzt) in derselben Transaktion wie die Änderung.
- **i18n**: Arabisch (Standard, RTL) und Englisch (LTR), lateinische Ziffern, alle Texte übersetzt (Test auf identische Schlüssel/Platzhalter), Prüfskript gegen physische CSS-Richtungen.
- **Shop**: Startseite, OTP-Login, Registrierung B2C (sofort aktiv) und B2B (Händlernummer, Lizenz-Upload nach MinIO, „wartet auf Freigabe“), Kundenkonto.
- **Admin**: Dashboard (Basiszahlen), Kunden (Liste, Detail, Freigabe mit Gruppe/Zahlungsziel/Kreditlimit, Ablehnung, Sperre, Notizen), Benutzer, Rollen, Einstellungen (Firma, MwSt.-Sätze mit Gültigkeit, Liefergebiete mit Gebühren je Kanal, Zahlungsarten), Audit-Log, gekennzeichnete Platzhalter für spätere Module, Fahrer-Einstieg.
- **Seed**: Firmen-Platzhalter, MwSt. 16 %, Einheiten, 8 Liefergebiete, Zahlungsarten, Auto-Druckregeln, Rollen, Inhaber, Lager, 3 B2B-Gruppen; Demo: 5 Mitarbeiter (je Rolle), 5 Kunden (2 B2C, 3 B2B) – alle als Beispiel markiert; Skript zum Entfernen der Demo-Daten.
- **Betrieb**: Backup-/Restore-Skripte (pg_dump + MinIO-Daten, Prüfsummen, Aufbewahrung), Health-Endpoint, CI-Workflow (Lint, Typecheck, Tests, Build, E2E).
- **E2E (Playwright)**: RTL/LTR, Admin-Login 2-Faktor, falsches Passwort, Fahrer ohne Admin-Rechte, B2C-Registrierung, B2B-Registrierung → Freigabe → B2B-Kanal, OTP-Rate-Limit.
