# Roadmap

Stand: Phase 2 abgeschlossen. Alles, was noch nicht umgesetzt ist, steht hier als `TODO:`. Im Code markieren `TODO(Phase N)`-Kommentare und die Admin-Menüpunkte mit „P2/P3/P5“ dieselben Stellen.

## Phase 2 – erledigt (siehe CHANGELOG 0.2.0)

## Phase 3 – Katalog & Shop
- TODO: Produktverwaltung (Varianten, EAN, Einheiten, Bilder, AR/EN, Sichtbarkeit pro Kanal), Import/Export
- TODO: Katalog, Suche (AR/EN, SKU, Barcode – Trigramm-Indizes sind angelegt), Filter, Verfügbarkeit
- TODO: Kanalbezogene DTOs + E2E-Test „B2B-Preis nie im HTML/JSON für Gast/B2C“
- TODO: Warenkorb, Checkout (Liefergebiet/Gebühr, Mindestbestellwert, Zahlungsart, Kreditlimit, Liefertag), Bestellungen, Lagerreservierung in Transaktion
- TODO: B2B-Extras: Schnellbestellung (SKU/CSV), „Letzte Bestellung wiederholen“, Bestelllisten
- TODO: Dashboard: Umsatz/Marge B2B vs. B2C, Mindestbestand
- TODO: Seed: Beispielbestellungen in allen Status (30 Produkte sind seit Phase 2 vorhanden)
- TODO: Kundenkonto: Bestellübersicht mit Statusverlauf, SMS/WhatsApp-Bestätigung (Log-Adapter)

## Phase 4 – A4-Dokumente (`packages/pdf`)
- TODO: Vorlage-Engine (HTML/CSS → Playwright/Chromium-PDF), Kopf/Fuß, „Seite X von Y“, Tabellenkopf-Wiederholung, Übertrag, QR-Code
- TODO: Alle 15 Dokumente aus Abschnitt 6.1, Sprachen AR / EN / zweisprachig
- TODO: Test „Arabisch korrekt verbunden“ (PDF erzeugen, Text extrahieren und prüfen)
- TODO: Archiv (Rechnung/Gutschrift beim Erstellen einfrieren – DB-Schutz existiert bereits), Sammeldruck, „Lieferschein + Rechnung“, Auto-Druck (`AutoPrintRule` ist geseedet)
- TODO: Einstellungen: Logo-Upload, Bankdaten, Dokumenttexte AR/EN, Nummernkreise (Präfix/Stellen)
- TODO: **Pflichtangaben der palästinensischen Steuerrechnung mit Steuerberater prüfen** (`CompanySettings.taxInvoiceFields`)

## Phase 5 – Verwaltung
- TODO: Lager (Journal, Lagerplätze, Inventur mit Zählliste, Mindestbestand), Einkauf (Lieferanten, Bestellungen, Wareneingang → `costPrice`)
- TODO: Touren, Fahreransicht (Unterschrift/Foto, Bargeld), Kassenabschluss pro Fahrer und Tag
- TODO: Finanzen (Zahlungen/Zuordnung, Altersstruktur offener Posten, Mahnstufen, Gutschriften/Retouren, CSV/Excel-Export)
- TODO: Berichte (Kanal, Kategorie, Produkt, Kunde, Gebiet, Zeitraum; Top/Flop; Lagerwert) als PDF und Excel
- TODO: Admin-Kundendetail: Umsatz, Kontoauszug, offene Posten, Dokumente

## Phase 6 – Mobile & Zahlungen
- TODO: Expo-App (Kunde + Fahrer) mit derselben `/api/v1` (Bearer-Token ist bereits implementiert)
- TODO: Zahlungs-Gateway-Adapter (Arab Bank / PayTabs / MEPS), `PaymentIntent` existiert
- TODO: Echte SMS-/WhatsApp-Anbieter als Adapter (Schnittstelle `MessageAdapter` existiert)

## Technische Schulden / Querschnitt
- TODO: Upgrade Prisma 6 → 7 (`prisma.config.ts`, Driver-Adapter `@prisma/adapter-pg`)
- TODO: Passwort-Reset für Mitarbeiter per E-Mail (Mailpit ist vorbereitet, Mail-Adapter fehlt noch)
- TODO: Docker-Image-Build in einer Umgebung mit Zugriff auf `deb.debian.org` vollständig verifizieren (in der Entwicklungs-Sandbox gesperrt; alle übrigen Schritte und der Standalone-Server sind getestet)
- TODO: Rate-Limit-Tabelle periodisch aufräumen (Cron/Job), abgelaufene OTP-Challenges und Sessions löschen
