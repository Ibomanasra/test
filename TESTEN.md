# Sholat Aljanoub am eigenen Rechner testen – Schritt für Schritt

Dauer: beim ersten Mal ca. 20–30 Minuten (vor allem Downloads). Danach reichen Schritt 6 und 7.

---

## Schritt 1 – Programme installieren (einmalig)

| Programm | Woher | Hinweis |
|---|---|---|
| **Git** | https://git-scm.com/downloads | Bei der Installation alles auf Standard lassen |
| **Node.js 22 LTS** | https://nodejs.org | Die Version **22** wählen |
| **Docker Desktop** | https://www.docker.com/products/docker-desktop | Nach der Installation **einmal starten** und warten, bis unten „Engine running“ steht. Windows fragt evtl. nach WSL – zustimmen und neu starten |

Danach den Rechner einmal neu starten.

## Schritt 2 – Terminal öffnen

- **Windows:** Startmenü → „PowerShell“ eingeben → öffnen
- **Mac:** Programme → Dienstprogramme → „Terminal“

Prüfen, ob alles da ist (jede Zeile einzeln eingeben, Enter):

```
git --version
node --version
docker --version
```

Es sollten drei Versionsnummern erscheinen (Node: `v22.…`).

## Schritt 3 – pnpm aktivieren (einmalig)

```
npm install -g pnpm@10.28.0
```

## Schritt 4 – Projekt herunterladen (einmalig)

```
cd ~
git clone https://github.com/Ibomanasra/test.git sholat
cd sholat
git checkout sholat-aljanoub
```

## Schritt 5 – Einrichten (einmalig, ca. 5–10 Minuten)

Docker Desktop muss laufen. Dann:

```
pnpm install
pnpm setup:dev
```

`pnpm setup:dev` erledigt alles automatisch: Konfiguration anlegen, Datenbank starten,
PDF-Programm installieren, Demo-Produkte, Demo-Kunden und Beispielbestellungen einspielen.
Am Ende steht **„✓ Fertig.“**

## Schritt 6 – Server starten (jedes Mal)

```
pnpm dev
```

Warten, bis `Ready` erscheint. **Dieses Fenster offen lassen** – solange es läuft, läuft der Server.
(Beenden: `Strg + C`)

## Schritt 7 – Im Browser testen

| Was | Adresse |
|---|---|
| Shop (Arabisch) | http://localhost:3000/ar |
| Shop (Englisch) | http://localhost:3000/en |
| Verwaltung (Admin) | http://localhost:3000/ar/admin |
| Fahreransicht | http://localhost:3000/ar/driver |
| E-Mails (Passwort vergessen) | http://localhost:8025 |

Der erste Seitenaufruf dauert ca. 10–20 Sekunden (die Seite wird vorbereitet), danach geht es schnell.

### Zugänge – der SMS-Code ist beim Test immer **123456**

| Rolle | Telefon | Passwort |
|---|---|---|
| Inhaber / Admin | 0599000001 | ChangeMe!2026 |
| Verkauf | 0599000002 | Demo-2026-pass |
| Preisverwaltung | 0599000003 | Demo-2026-pass |
| Lager | 0599000004 | Demo-2026-pass |
| Fahrer | 0599000005 | Demo-2026-pass |
| Buchhaltung | 0599000006 | Demo-2026-pass |
| Privatkunde | 0599100001 | – (nur SMS-Code) |
| Händler „Gold“ | 0599100003 | – (nur SMS-Code) |
| Händler „Silber“ | 0599100004 | – (nur SMS-Code) |

Mitarbeiter melden sich unter **/ar/admin** an, Kunden über **„دخول“** im Shop.

## Schritt 8 – Testablauf (Vorschlag)

1. **Als Gast** den Shop ansehen → Preise sind Endkundenpreise inkl. MwSt.
2. **Als Händler (0599100003)** anmelden → andere Preise und Mengenstaffeln. Etwas in den Warenkorb legen und bestellen („على الحساب“ = auf Rechnung).
3. **Als Admin (0599000001)** → *الطلبات* (Bestellungen) → die neue Bestellung öffnen →
   Bestätigen → Kommissionierung → Bereit → **Versenden**. Danach gibt es Lieferschein und Rechnung als PDF (Knopf „طباعة / PDF“).
4. *التوصيل والسائقون* (Lieferung) → neue Tour → Fahrer wählen → Lieferschein ankreuzen → Tour anlegen.
5. **Als Fahrer (0599000005)** anmelden → Stopp „Zugestellt“, unterschreiben, Bargeld eintragen → abends „Kassenabschluss“.
6. Als Admin: *المالية* (Finanzen), *التقارير* (Berichte), *المستودع* (Lager), *الإعدادات → المستندات* (Logo, Bankdaten) ausprobieren.
7. **Kartenzahlung (Testmodus):** Admin → Einstellungen → Zahlungsarten → „بطاقة“ aktivieren. Als Privatkunde bestellen → es öffnet sich eine Testseite mit „Zahlung bestätigen / ablehnen“.

## Schritt 9 – Handy-App (optional)

1. Auf dem Handy die App **Expo Go** installieren (App Store / Google Play).
2. Handy und Rechner im **selben WLAN**.
3. Der Server (`pnpm dev`) läuft weiter. **Ein zweites Terminal** öffnen:
   ```
   cd ~/sholat
   pnpm app
   ```
4. QR-Code scannen: Android in Expo Go, iPhone mit der Kamera-App.
5. Oben steht „App verbindet sich mit: http://192.168.…:3000“. Diese Adresse muss auch im Handy-Browser funktionieren – sonst siehe „Probleme“.

Push-Benachrichtigungen funktionieren in Expo Go nicht (dafür braucht es später einen eigenen App-Build).

---

## Probleme?

| Meldung | Lösung |
|---|---|
| `docker: command not found` / „Docker läuft nicht“ | Docker Desktop starten, warten bis „Engine running“, dann `pnpm setup:dev` erneut |
| `pnpm` wird nicht gefunden | Terminal schließen und neu öffnen; sonst Schritt 3 wiederholen |
| `port is already allocated` / Port 5432 belegt | Es läuft schon eine andere Datenbank (z. B. ein installiertes PostgreSQL). Diese beenden oder in `.env` `POSTGRES_PORT=5433` setzen und in `DATABASE_URL` ebenfalls `5433` |
| Handy erreicht den Server nicht | Windows: beim ersten `pnpm dev` die Firewall-Frage mit **„Zulassen“ (privates Netzwerk)** beantworten. Prüfen: auf dem Handy im Browser `http://<Adresse aus pnpm app>:3000/api/health` öffnen – es muss `ok` erscheinen. Stimmt die Adresse nicht (WLAN gewechselt), in `.env` die Zeile `APP_URL=` anpassen und `pnpm setup:dev` erneut ausführen |
| Expo Go meldet „incompatible SDK“ | Expo Go im Store aktualisieren |
| Alles zurück auf Anfang | `docker compose down -v` (löscht die Testdatenbank), dann `pnpm setup:dev` |

Beim nächsten Mal genügt: Docker Desktop starten → Terminal → `cd ~/sholat` → `pnpm dev`.
