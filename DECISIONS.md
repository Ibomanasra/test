# Entscheidungen & Annahmen

Alle Punkte sind mit dem Auftraggeber abgestimmt (Plan-Freigabe 2026-10-26: „nimm die Vorschläge“) oder sinnvolle Annahmen, die hier dokumentiert sind. Änderungen bitte hier nachtragen.

## Architektur & Stack

| # | Thema | Entscheidung | Begründung |
|---|---|---|---|
| D1 | Monorepo-Tooling | pnpm workspaces + **Turborepo** | Build-Cache und Task-Reihenfolge ohne Eigenbau |
| D2 | Zusatzpakete | `packages/contracts` (Zod-Schemas der API) und `packages/config` (tsconfig) | Web und Mobile nutzen dieselben Ein-/Ausgabe-Typen |
| D3 | Auth-Bibliothek | **Eigene DB-Sessions** statt Auth.js | Telefon-OTP + Passwort + Bearer-Token (Mobile) passen schlecht in Auth.js-Provider; Sessions sind klein und testbar. Token wird nur als SHA-256-Hash gespeichert |
| D4 | Admin-Login | Passwort (argon2id) **und** OTP; Session ohne 2. Faktor erhält keine Rechte | Admins sehen Einkaufspreise und Finanzen |
| D5 | Rate-Limit | Postgres-Tabelle (Fixed Window, atomares UPSERT): OTP 3 / 10 Min. pro Telefon, 20 / Std. pro IP, Verify 60 / Std. pro IP, Staff-Login 10 / 15 Min. pro Telefon | Kein zusätzlicher Redis-Container nötig; Werte per `.env` änderbar |
| D24 | Versionen | Next.js 16.4, React 19.3, next-intl 4.14, Tailwind 4.3, Zod 4, **Prisma 6.19** (nicht 7), TypeScript 5.9 (nicht 7) | Prisma 7 erzwingt Driver-Adapter + `prisma.config.ts` – Upgrade separat (ROADMAP). TypeScript 7 (Go-Port) wird von next-intl/Next noch nicht offiziell unterstützt |
| D25 | MinIO-Image | `pgsty/minio` (Community-Build), Version gepinnt | Offizielle `minio/minio`-Images werden nicht mehr auf Docker Hub veröffentlicht. Bucket wird von der App beim ersten Zugriff angelegt (kein `mc`-Init-Container) |
| D34 | `.env` im Monorepo | Eine `.env` im Repo-Root; `postinstall` verlinkt sie nach `apps/web/.env`; Prisma/Seed laden sie per `node --env-file-if-exists` | Next.js liest `.env` nur im App-Ordner; bereits gesetzte Variablen (Docker/CI) haben immer Vorrang |
| D38 | Docker-Build hinter Proxy | Optionales BuildKit-Secret `extra_ca` (zusätzliches CA-Zertifikat für npm, Prisma-Engines und apt über HTTPS); Basis-Image per `NODE_IMAGE` wählbar | Funktioniert ohne Optionen auf normalen Servern; hilft hinter TLS-abfangenden Firmen-Proxys |

## Datenmodell & Geld

| # | Thema | Entscheidung | Begründung |
|---|---|---|---|
| D6 | Varianten | Jedes Produkt hat ≥ 1 Variante; Preise/SKU/EAN/Bestand an der Variante | Ein Code-Pfad statt Sonderfall „Produkt ohne Variante“ |
| D7 | Preisbasis | Alle Preise pro **Basiseinheit (Stück)** in Agorot; Karton = Stück × Faktor; Mengen intern in Basiseinheiten | Staffeln, Sonderpreise und Einheiten bleiben konsistent |
| D8 | Prozentwerte | Basispunkte als `Int` (1600 = 16 %) | Keine Floats |
| D9 | Rundung Rabatte | Prozentrabatte pro Stück auf ganze Agorot, kaufmännisch (half away from zero) | Nachvollziehbar auf jeder Position |
| D10 | Steuer B2C | Positionsbrutto = Stückbrutto × Menge; Netto = round(Brutto × 10000 / (10000 + Satz)); MwSt. = Brutto − Netto | Brutto bleibt exakt der angezeigte Preis; Summe = Summe der Positionen (getestet für alle Preise 0–100 ₪) |
| D11 | Steuer B2B | Positionsnetto = Stücknetto × Menge; MwSt. = round(Netto × Satz / 10000) pro Position | Wie gefordert: pro Position runden, dann summieren |
| D17 | Kontoauszug | Eigenes Journal `CustomerLedgerEntry` (nur anhängen, DB-Trigger) | Saldo/Kreditlimit schnell und revisionssicher |
| D18 | Lager | Ein Lager („MAIN“) zum Start, Modell unterstützt mehrere | Annahme |
| D35 | Stammdaten-Nummern | Kunden `K-000001`, Lieferanten `L-000001` aus Postgres-Sequenzen (Lücken erlaubt) | Keine Belege → keine Lückenlosigkeit nötig |

## Preise & Kanäle

| # | Thema | Entscheidung | Begründung |
|---|---|---|---|
| D12 | B2B-Preisschutz | Produktdaten verlassen den Server nur über kanalbezogene DTO-Mapper; Prisma-Queries mit explizitem `select`; Seiten mit Preisen dynamisch (`no-store`); E2E-Test prüft HTML + API als Gast/B2C (Phase 3) | Absicherung serverseitig in mehreren Ebenen |
| D13 | Kanal-Ermittlung | B2B nur wenn `Customer.type = B2B` **und** `status = ACTIVE`; sonst B2C (`effectiveChannel()` in `packages/core`) | Wartende/abgelehnte/gesperrte Händler sehen B2C-Preise |
| D23 | B2B-Regelkombination (**bestätigt**) | Gruppenpreis (Preisliste oder Basispreis − Gruppenrabatt) → Staffel, falls günstiger → Kategorie-Rabatt bilden **eine Kette**. Ihr Ergebnis konkurriert mit Sonderpreis und Aktion; der **günstigste** gewinnt. Kategorie-Rabatt wird **nicht** zusätzlich auf Aktion/Sonderpreis gerechnet. Ein als „fix“ markiertes Angebot bzw. ein fixer Sonderpreis gewinnt immer (Angebot vor Sonderpreis) | Freigabe 2026-10-26 |

## Belege, Nummern, Steuer

| # | Thema | Entscheidung | Begründung |
|---|---|---|---|
| D14 | Nummernformat (**bestätigt**) | `{PREFIX}-{JAHR}-{6 Ziffern}`, Zähler **pro Kalenderjahr neu**, Jahr in Zeitzone Asia/Hebron | Wie `INV-2026-000123`; Präfix und Stellen je Belegart im Admin änderbar (Phase 4) |
| D15 | Lückenlosigkeit | Nur `INVOICE` und `CREDIT_NOTE` lückenlos (Zählerzeile wird per `INSERT … ON CONFLICT DO UPDATE` bis Transaktionsende gesperrt; Rollback gibt die Nummer zurück) | Lückenlos-Vergabe serialisiert – nur wo nötig. Getestet mit 25 parallelen Transaktionen inkl. Rollbacks |
| D16 | Unveränderlichkeit | DB-Trigger: Rechnung/Gutschrift nur Zahlungsstand und einmalig Archiv-Referenz änderbar; Positionen, Audit-Log, Lagerjournal, Preishistorie, Kundenjournal nur anhängen; eingefrorene PDFs unveränderlich. Wartungsmodus `SET LOCAL sa.allow_purge = 'on'` nur für das Demo-Lösch-Skript | Schutz auch gegen Bugs und direkte SQL-Zugriffe |
| D22 | Rechnungszeitpunkt (**bestätigt**) | Eine Rechnung pro **Lieferschein**, erzeugt beim Status „Unterwegs“ | Fahrer nimmt Lieferschein + Rechnung zusammen mit; Teillieferungen sauber fakturiert |
| D27 | B2C-Steuerrechnung (**bestätigt**) | Auch Privatkunden erhalten eine Steuerrechnung (ohne Händlernummer des Käufers). Pflichtfelder konfigurierbar in `CompanySettings.taxInvoiceFields` | Mit Steuerberater prüfen (ROADMAP) |
| D36 | Steuersatz-Wechsel | Neuer Satz gilt ab 00:00 Ortszeit des gewählten Tages, frühestens heute (nicht rückwirkend); der bisherige Satz endet automatisch. Geplante Sätze sind löschbar | Historische Belege speichern ihren Satz als Snapshot |

## Sprache, UI, Sicherheit

| # | Thema | Entscheidung | Begründung |
|---|---|---|---|
| D19 | Ziffern | Intl-Locale `ar-u-nu-latn`; Beträge per `formatMoney()` (`1,234.50 ₪`) in beiden Sprachen identisch; Test verbietet arabisch-indische Ziffern in Texten | Vorgabe: lateinische Ziffern |
| D20 | Schrift | IBM Plex Sans Arabic (arabisch + lateinisch, 400–700), lokal als woff2 (OFL-Lizenz in `apps/web/src/fonts`) | Gute Lesbarkeit, tabellarische Ziffern; dieselben Dateien später im PDF |
| D30 | Standardsprache | `/` leitet **immer** auf `/ar` (keine Browser-Spracherkennung); Wechsel per Umschalter, URL behält die Sprache | „Arabisch (Standard)“ |
| D29 | Firmenname arabisch | Platzhalter „شعلة الجنوب للتجارة العامة“ | Annahme für „Sholat Aljanoub“ – in Einstellungen → Firmendaten änderbar |
| D31 | CSRF | Cookie `SameSite=Lax` + Origin-Prüfung bei allen schreibenden API-Aufrufen mit Session-Cookie; Bearer-Token (Mobile) ausgenommen | Kein Token-Handling im Client nötig |
| D32 | Dateien | MinIO-Bucket privat; Auslieferung nur über `/api/v1/files/[id]` mit Rechteprüfung; Dateityp per Magic Bytes geprüft (PDF/JPG/PNG/WEBP) | Gewerbelizenzen sind personenbezogen |
| D33 | Formulare vor Hydration | Login-/Registrierungsfelder unkontrolliert (FormData), Absenden erst nach Hydration, `method="post"` | Eingaben auf langsamen Handys gehen nicht verloren; Passwörter landen nie in der URL |
| D37 | Session-Dauer | Kunden 60 Tage (gleitend), Mitarbeiter 1 Tag (fest); Passwort-/Rollenänderung oder Deaktivierung beendet alle Sessions | Per `.env` änderbar |
| D21 | Benachrichtigungen | SMS/WhatsApp-Adapter schreiben bis Phase 6 nur ins `NotificationLog` (+ Konsole) | Wie gefordert |
| D28 | OTP in Entwicklung | `OTP_DEV_FIXED_CODE` (z. B. `123456`) nur außerhalb von `NODE_ENV=production`; in Produktion verweigert die App den Start dieses Codes | Bequemes Testen ohne Risiko |
| D39 | PDF-Engine | `packages/pdf`: generisches Dokumentmodell → HTML/CSS → Chromium (`page.pdf`), IBM Plex Sans Arabic als data:-URL eingebettet; Kopf/Fuß mit Bankdaten und „Seite X von Y“ über Chromium-Vorlagen; Tabellenkopf wiederholt (`thead`), Zeilen nicht geteilt, Summen nach der Tabelle (nur letzte Seite); QR-Code (Nummer + Link), Code-128 ohne Fremdbibliothek; Zusammenführen mit pdf-lib | Ein Renderer für alle 15 Dokumente und alle Listen; HarfBuzz formt Arabisch korrekt |
| D40 | Rechnungszeitpunkt | Rechnung im **selben** Datenbank-Commit wie Lieferschein und Warenausgang (Status „Unterwegs“); Liefergebühr auf der ersten nicht stornierten Rechnung; Zustellung fehlgeschlagen → automatische Gutschrift über die volle Rechnung | Lückenlose Nummern, keine Rechnung ohne Warenausgang |
| D41 | Archiv | Rechnung/Gutschrift wird direkt nach dem Commit gerendert, in MinIO abgelegt und als `ArchivedDocument(frozen)` verknüpft; ein Job holt Fehlschläge alle 5 min nach. Abruf in Archivsprache liefert das eingefrorene Original, andere Sprachen werden als „نسخة / COPY“ neu gesetzt | Original bleibt bitgenau (SHA-256 sichtbar) |
| D42 | Listen drucken | Admin-Listen senden die angezeigten Spalten/Zeilen an `POST /api/v1/print/table` (nur Mitarbeiter) | Jede Liste druckbar ohne eigenen Endpunkt je Liste; Daten sind bereits rechtegeprüft geladen |
| D43 | Druckaufträge | Auto-Druck erzeugt `PrintJob`s, ein Worker im Web-Prozess rendert sie (`FOR UPDATE SKIP LOCKED`); Druckstation öffnet sie unter *Dokumente → Druckaufträge* | Kein Treiber-/Netzwerkdrucker-Zugriff aus dem Container nötig |
| D44 | Nummernkreise | Präfix/Stellen je Belegart einstellbar; bei Rechnung/Gutschrift gesperrt, sobald im Jahr eine Nummer vergeben wurde | Lückenlosigkeit und Einheitlichkeit pro Jahr |
| D45 | Einstandspreis | Wareneingang aktualisiert `costPrice` wahlweise per gleitendem Durchschnitt (Standard) oder letztem Einkaufspreis; Änderung in der Preis-Historie (Quelle GOODS_RECEIPT) | Marge und Margenschutz basieren auf realen Kosten |
| D46 | Zahlungszuordnung | Automatisch nach ältester Fälligkeit oder gezielt; Überzahlung bleibt Guthaben im Kundenjournal; Storno = Gegenbuchung (Journal bleibt nur-anhängen) | Übliche Praxis im Großhandel |
| D47 | Mahnwesen | Mahnstufe 1 ab 7 Tagen Verzug, jede weitere frühestens 14 Tage später, max. Stufe 3; Gebühr optional ab Stufe 2 (als Journal-Buchung) | Rechnungen bleiben unverändert |
| D48 | Nachnahme & Kasse | Bargeld bei Zustellung → Quittung + Zuordnung zur Lieferschein-Rechnung + `CashCollection`; Fahrer zählt abends nach Stückelung; Buchhaltung gibt frei. Fehlgeschlagene Zustellung storniert die Rechnung per Gutschrift | Soll/Ist pro Fahrer und Tag nachvollziehbar |
| D49 | Inventur | Soll-Mengen beim Start eingefroren, Zählung blind (Soll erst nach Abschluss sichtbar), Differenzen als STOCKTAKE-Bewegung; nie unter reservierte Menge | Verhindert „Abschreiben“ und Überverkauf |
| D50 | Berichte | Umsatz = Rechnungs- minus Gutschriftszeilen (netto, Belegdatum), Wareneinsatz aus dem Einstandspreis-Snapshot der Bestellposition | Deckt sich mit Steuerberater-Export |
| D51 | Kalendertage | `@db.Date`-Spalten (Liefertag, Tourdatum, Kassentag) speichern UTC-Mitternacht des Geschäftstags (Asia/Hebron) | Kein Datumsversatz um einen Tag |
