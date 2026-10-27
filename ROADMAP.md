# Roadmap

Stand: Phase 4 abgeschlossen. Alles, was noch nicht umgesetzt ist, steht hier als `TODO:`. Im Code markieren `TODO(Phase N)`-Kommentare und die Admin-Menüpunkte mit „P2/P3/P5“ dieselben Stellen.

## Phase 2 – erledigt (siehe CHANGELOG 0.2.0)
## Phase 3 – erledigt (siehe CHANGELOG 0.3.0)

## Phase 4 – erledigt (siehe CHANGELOG 0.4.0)
- TODO: **Pflichtangaben der palästinensischen Steuerrechnung mit Steuerberater prüfen** (konfigurierbar unter Einstellungen → Dokumente → Steuerrechnung, `CompanySettings.taxInvoiceFields`)
- TODO (optional): „Übertrag“ (Zwischensumme je Seite) bei mehrseitigen Rechnungen

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
