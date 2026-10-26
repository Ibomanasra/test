# Changelog

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
