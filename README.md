# Sholat Aljanoub – Großhandels-System (B2C + B2B)

Web-Shop und Verwaltung für einen Großhändler für Haushaltswaren in Palästina.
Arabisch (Standard, RTL) und Englisch, Beträge in ₪ (intern Agorot), MwSt. 16 %.

> **Stand: Phase 1 (Grundgerüst).** Login, Registrierung, Händler-Freigabe, Rollen/Rechte, Audit-Log, Einstellungen.
> Preise, Katalog, Bestellungen, A4-Druck usw. folgen in den nächsten Phasen – siehe [ROADMAP.md](ROADMAP.md).

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
  src/app/[locale]/       Seiten (ar/en); (shop), admin/(auth|panel), driver
  src/app/api/            API-Routen – jede prüft Rechte serverseitig
  src/server/             Serverlogik: auth/, services/, adapters/ (SMS, Speicher), audit.ts
  src/messages/           Übersetzungen ar.json / en.json
packages/core/            Reine TS-Logik: Geld, Steuer, Nummern, Rechte, Status, Telefon (+ Tests)
packages/contracts/       Zod-Schemas der API
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

**Preise pflegen:** folgt in Phase 2, mit eigenem Menüpunkt „Preise“ (Preislisten, Gruppen, Staffeln, Sonderpreise, Aktionen, Historie, Vorschau, CSV-Import).
**Drucken (A4/PDF):** folgt in Phase 4. Jedes Dokument und jede Liste bekommt dann „Drucken / PDF (A4)“.

---

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
