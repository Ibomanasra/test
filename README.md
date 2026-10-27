# Sholat Aljanoub – Großhandels-System (B2C + B2B)

Web-Shop und Verwaltung für einen Großhändler für Haushaltswaren in Palästina.
Arabisch (Standard, RTL) und Englisch, Beträge in ₪ (intern Agorot), MwSt. 16 %.

> **Stand: Phase 1 (Grundgerüst).** Login, Registrierung, Händler-Freigabe, Rollen/Rechte, Audit-Log, Einstellungen.
> Stand: alle 6 Phasen umgesetzt (Grundgerüst, Preise, Shop/Bestellungen, A4-Dokumente, Verwaltung, Mobile-App & Zahlungs-Gateway). Offene Punkte: [ROADMAP.md](ROADMAP.md).

---

## Schnellstart (Docker)

Voraussetzung: Docker mit Compose v2.

```bash
cp .env.example .env          # Werte prüfen – mindestens SESSION_SECRET und Passwörter ändern
docker compose up -d --build
```

| Dienst | URL |
|---|---|
| Shop | http://localhost:3000/ar (Englisch: `/en`) |
| Admin | http://localhost:3000/ar/admin |
| Fahreransicht | http://localhost:3000/ar/driver |
| Mailpit (E-Mails) | http://localhost:8025 |
| MinIO-Konsole (Dateien) | http://localhost:9001 |
| Health-Check | http://localhost:3000/api/health |

Beim Start des `web`-Containers laufen automatisch die Datenbank-Migrationen und der (idempotente) Seed.

### Anmelden

**SMS-Codes:** Bis ein echter SMS-Anbieter angebunden ist (Phase 6), werden Codes nicht verschickt, sondern protokolliert:

```bash
docker compose logs -f web | grep SMS
```

Sie stehen außerdem in der Tabelle `NotificationLog`.

| Wer | Telefon | Passwort |
|---|---|---|
| Inhaber | `SEED_OWNER_PHONE` (Standard `0599000001`) | `SEED_OWNER_PASSWORD` (Standard `ChangeMe!2026`) |
| Demo-Vertrieb | `0599000002` | `SEED_DEMO_PASSWORD` (Standard `Demo-2026-pass`) |
| Demo-Preisverwaltung | `0599000003` | 〃 |
| Demo-Lager | `0599000004` | 〃 |
| Demo-Fahrer | `0599000005` | 〃 (landet in `/driver`) |
| Demo-Buchhaltung | `0599000006` | 〃 |

**Mitarbeiter:** `/ar/admin/login` → Telefon + Passwort → SMS-Code (2-Faktor).
**Kunden:** `/ar/login` → Telefon → SMS-Code. Unbekannte Nummern werden zur Registrierung weitergeleitet.

Demo-Kunden (alle mit „(مثال)“ markiert): `0599100001`, `0569100002` (B2C), `0599100003` (B2B Gold), `0599100004` (B2B Silber), `0599100005` (B2B wartet auf Freigabe).

Beispielbestellungen in allen Status (nach dem Seed mit Demo-Daten, idempotent):

```bash
pnpm db:demo-orders
```

Demo-Daten entfernen:

```bash
pnpm --filter @sa/db remove-demo -- --yes
```

Seed ohne Demo: `SEED_DEMO_DATA=false`.

---

## Entwicklung

Voraussetzungen: Node.js ≥ 22, pnpm 10, Docker (für Postgres/MinIO/Mailpit).

```bash
cp .env.example .env
# Für die Entwicklung in .env setzen:  NODE_ENV=development  und  OTP_DEV_FIXED_CODE=123456
docker compose up -d postgres minio mailpit
pnpm install                 # verlinkt .env nach apps/web/.env
pnpm db:deploy && pnpm db:seed
pnpm dev                     # http://localhost:3000
```

`OTP_DEV_FIXED_CODE` macht jeden SMS-Code zu `123456`. Mit `NODE_ENV=production` verweigert die App diesen festen Code.

| Befehl | Zweck |
|---|---|
| `pnpm test` | Unit- und Integrationstests (core, contracts, db, web) – DB-Tests nutzen `TEST_DATABASE_URL` |
| `pnpm e2e` | Playwright gegen laufende App (`E2E_BASE_URL`, Standard `http://localhost:3000`). Liest SMS-Codes aus der DB |
| `pnpm lint` | ESLint + Prüfung auf physische CSS-Richtungen (`ml-`, `text-left` …) |
| `pnpm typecheck` | TypeScript in allen Paketen |
| `pnpm db:migrate` | neue Migration aus Schema-Änderung erzeugen (Entwicklung) |
| `pnpm --filter @sa/db studio` | Prisma Studio |

### Struktur

```
apps/web/                 Next.js 16 – Shop, Admin, Fahrer, REST-API /api/v1 (auch für die Mobile-App)
apps/mobile/              Expo-App für Kunden und Fahrer (dieselbe API, Bearer-Token)
  src/app/[locale]/       Seiten (ar/en); (shop), admin/(auth|panel), driver
  src/app/api/            API-Routen – jede prüft Rechte serverseitig
  src/server/             Serverlogik: auth/, services/, adapters/ (SMS, Speicher, Zahlungs-Gateway), audit.ts
  src/messages/           Übersetzungen ar.json / en.json
packages/core/            Reine TS-Logik: Geld, Steuer, Nummern, Rechte, Status, Telefon (+ Tests)
packages/contracts/       Zod-Schemas der API
packages/pdf/             A4-Dokumente: HTML/CSS → Chromium-PDF, Schriften, QR, Barcodes (+ Test „Arabisch verbunden“)
packages/db/              Prisma-Schema, Migrationen, Seed, lückenlose Nummernvergabe (+ Integrationstests)
packages/config/          gemeinsame tsconfig
docker/                   Dockerfile + Entrypoint
scripts/                  backup.sh, restore.sh, check-logical-css.mjs
e2e/                      Playwright-Tests
```

### Regeln für Code

- **Geld** ist immer eine Ganzzahl in Agorot. Prozent sind Basispunkte (1600 = 16 %). Alles über `@sa/core` (`formatMoney`, `parseShekel`, `lineFromNet`, `lineFromGross` …).
- **Keine hartcodierten Texte.** Neue Texte kommen in beide Dateien unter `apps/web/src/messages/`. Ein Test prüft, dass beide Sprachen dieselben Schlüssel haben.
- **RTL-Layout:** Nur logische CSS-Klassen (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`). `pnpm lint` schlägt sonst fehl.
- **Rechte** prüft jeder Endpunkt selbst mit `requireStaff("recht.key")`. Seiten nutzen `staffPagePermission()`. Neue Rechte kommen in `packages/core/src/permissions.ts` und als Übersetzung unter `permissions.*`.
- **Jede Änderung** schreibt einen Audit-Eintrag mit `audit(ctx, {...}, tx)`, in derselben Transaktion.

---

## Bedienung (Admin)

| Aufgabe | Wo |
|---|---|
| Händler freigeben | Dashboard → „Händler, die auf Freigabe warten“ oder Kunden → Filter *wartet auf Freigabe* → Kunde öffnen → Gruppe, Zahlungsziel, Kreditlimit → **Freigeben** |
| Kunden sperren / entsperren | Kunde öffnen → Sperren (mit Grund) |
| Mitarbeiter anlegen | Benutzer → Neuer Mitarbeiter (Rollen zuweisen) |
| Rechte einer Rolle ändern | Rollen & Rechte → Rolle wählen → Häkchen setzen |
| MwSt.-Satz ändern | Einstellungen → MwSt. → neuer Satz mit Startdatum (alter Satz endet automatisch; bestehende Rechnungen behalten ihren Satz) |
| Liefergebiete und Gebühren | Einstellungen → Liefergebiete (Gebühr, Mindestbestellwert, Gratis-Grenze **je Kanal**) |
| Wer hat was geändert? | Audit-Log (Filter nach Aktion, Objekt, ID) |
| Bestellung bearbeiten | Bestellungen → Bestellung → Bestätigen → Kommissionierung → Bereit → **Versenden** (Teillieferung möglich; Rechnung entsteht automatisch) |
| Ware einkaufen | Einkauf → Neuer Einkaufsauftrag → „An Lieferanten senden“ → **Wareneingang** (Bestand + Einstandspreis, wahlweise gleitender Durchschnitt) |
| Bestand korrigieren | Lager → Bestandskorrektur (SKU, ± Menge, Grund) – alles im Lagerjournal |
| Inventur | Lager → Inventur → Starten (optional nur Lagerplatz-Präfix) → Zählliste drucken → Mengen eintragen → **Abschließen** (Differenzen werden gebucht) |
| Lagerplätze / Laufweg | Lager → Lagerplätze (Reihenfolge = Laufweg der Kommissionierliste) |
| Tour planen | Lieferung → Neue Tour (Datum, Fahrer, Lieferscheine auswählen) → Tourenliste drucken |
| Fahrer | meldet sich unter `/admin/login` an und landet in `/driver`: Stopps, Anruf/Karte, **Zugestellt** (Empfänger, Unterschrift, Bargeld) oder **Nicht zugestellt**, abends **Kassenabschluss** (Stückelung) |
| Kassenabschluss prüfen | Lieferung → Kassenabschluss → Freigeben |
| Zahlung erfassen | Finanzen → Zahlungen (wird automatisch der ältesten offenen Rechnung zugeordnet; Quittung RC-…) |
| Offene Posten / Mahnungen | Finanzen → Offene Posten (Altersstruktur) → **Mahnlauf** (Stufe 1–3) → Mahnungen drucken |
| Retoure | Finanzen → Retouren → Bestellnummer → Mengen → Retoure + Gutschrift (optional zurück ins Lager) |
| Steuerberater-Export | Finanzen → Export (Rechnungen, Gutschriften, Zahlungen, Kundenjournal; Excel oder CSV) |
| Berichte | Berichte → Art (Kanal, Kategorie, Produkt, Kunde, Gebiet, Monat, Top/Flop, Lagerwert) → PDF / Excel / CSV |

**Preise pflegen:** Menü *Preise* – Übersicht mit Marge, Gruppen, Preislisten, Staffeln, Sonderpreise, Kategorie-Rabatte, Aktionen, Rundung, geplante Preise, Massenänderung, CSV-/Excel-Import, Historie und **Preisvorschau** („welcher Preis gilt für Kunde X bei Menge Y – und warum“).
**Drucken (A4/PDF):**
- Jeder Beleg hat den Knopf **„طباعة / PDF (A4)“**: öffnet die PDF-Vorschau im Browser (dort drucken oder speichern). Daneben: **EN** (Englisch), **ع+EN** (zweisprachig), **⬇** (Download).
- Bestellung: Auftragsbestätigung, Kommissionierliste (nach Lagerplatz, mit Barcode, ohne Preise), Lieferschein mit/ohne Preise, Rechnung und **„Lieferschein + Rechnung“** in einem PDF.
- **Sammeldruck**: in der Bestellliste Bestellungen anhaken → gewünschte Belegart wählen (ein PDF).
- **Jede Liste** (Bestellungen, Kunden, Produkte, Rechnungen …): „طباعة / PDF (A4)“ oben rechts druckt die angezeigte Liste.
- **Rechnungen** entstehen automatisch je Lieferschein beim Status „Unterwegs“ (fortlaufend, lückenlos) und werden sofort als PDF **eingefroren** (Menü *Dokumente*). Korrektur nur per **Gutschrift** (Rechnung öffnen → „إصدار إشعار دائن“).
- **Auto-Druck**: *Einstellungen → Dokumente → Automatischer Druck* (z. B. „Bestätigt“ → Kommissionierliste). Die fertigen PDFs liegen unter *Dokumente → Druckaufträge*.
- Logo, Bankdaten, Dokumenttexte AR/EN, Nummernkreise und Hinweise der Steuerrechnung: *Einstellungen → Dokumente*.
- Barcode-Etiketten (A4, 3 × 8): *Produkte → Etiketten*.
- Kunden finden ihre Belege unter *Mein Konto → Dokumente*, Händler zusätzlich Kontoauszug und **persönliche Preisliste**.

---

## Mobile-App (Kunden & Fahrer)

`apps/mobile` – Expo (React Native), nutzt dieselbe `/api/v1` mit Bearer-Token.

```bash
# API-Adresse für Handy/Emulator (Android-Emulator: http://10.0.2.2:3000)
EXPO_PUBLIC_API_URL=http://192.168.1.20:3000 pnpm --filter @sa/mobile start
```

- **Kunden**: Anmeldung per SMS-Code, Registrierung Privatkunde, Katalog mit Suche (Händler sehen ihre Preise und Staffeln), Warenkorb, Bestellung inkl. Kartenzahlung, Bestellungen mit Status, Belege als PDF (Teilen/Vorschau), „Erneut bestellen“.
- **Fahrer**: Anmeldung mit Passwort + SMS-Code, eigene Touren, Anruf/Karte/Lieferschein, Zustellung mit Empfänger und Bargeld, Nicht-Zustellung mit Grund, Kassenabschluss nach Stückelung.
- Arabisch (RTL) ist Standard; Sprachwechsel unter *Konto* (Richtung gilt nach Neustart).
- Store-Builds: mit EAS (`eas build`) – siehe ROADMAP.

## Zahlungen per Karte

`PAYMENT_GATEWAY` in `.env`: `fake` (Entwicklung: Testseite mit „Zahlung bestätigen/ablehnen“), `paytabs` (PayTabs Hosted Payment Page) oder `arabbank` (Mastercard Gateway Hosted Checkout). Zugangsdaten über `PAYMENT_GATEWAY_MERCHANT_ID` / `PAYMENT_GATEWAY_API_KEY`, Callback-URL beim Anbieter: `https://<domain>/api/v1/payments/callback/<gateway>`. Die Zahlart „Karte“ wird unter *Einstellungen → Zahlungsarten* je Kanal aktiviert. Kartendaten berühren den Server nie; der Betrag wird serverseitig gegen die Bestellung geprüft, unbezahlte Kartenbestellungen werden nach `PAYMENT_TIMEOUT_MINUTES` storniert.

## Betrieb

### Backups

```bash
./scripts/backup.sh                      # → ./backups/<zeitstempel>/ (db.dump, files.tar, SHA256SUMS)
./scripts/restore.sh ./backups/<ordner> --yes
```

- **Automatisch** täglich per Cron, z. B.: `30 2 * * * cd /opt/sholat-aljanoub && ./scripts/backup.sh`.
- **Aufbewahrung:** `BACKUP_RETENTION_DAYS` (Standard 14).
- **Kopie:** Backups zusätzlich außer Haus ablegen.

### Produktion – Checkliste

- **Geheimnisse:** `SESSION_SECRET` (mindestens 32 zufällige Zeichen) und alle Passwörter in `.env` ändern.
- **HTTPS:** Die App hinter einen Reverse-Proxy mit TLS stellen (z. B. Caddy oder nginx) und `COOKIE_SECURE=true` setzen.
- **Entwicklungs-Werte:** `OTP_DEV_FIXED_CODE` leer lassen. Für einen Start ohne Beispieldaten `SEED_DEMO_DATA=false` setzen.
- **Firmendaten:** Nach dem ersten Login unter Einstellungen → Firmendaten eintragen. Die Händlernummer `000000000` ist ein Platzhalter.
- **Ports:** Die Ports von Postgres und MinIO nicht öffentlich freigeben.

### Hinter einem TLS-abfangenden Proxy bauen

```bash
docker build -f docker/web.Dockerfile --secret id=extra_ca,src=/pfad/zum/ca.crt -t sholat-aljanoub-web .
```

---

## Weitere Dokumente

- [PLAN.md](PLAN.md): Plan und Datenmodell-Übersicht
- [DECISIONS.md](DECISIONS.md): getroffene Entscheidungen und Annahmen
- [ROADMAP.md](ROADMAP.md): offene Punkte (`TODO:`) je Phase
- [CHANGELOG.md](CHANGELOG.md): Änderungen je Version
