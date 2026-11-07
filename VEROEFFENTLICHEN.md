# Veröffentlichen – Schritt für Schritt

So kommt شعلة الجنوب ins Internet. Du brauchst: einen **Server** (Ubuntu), eine **Domain** und ein **Twilio-Konto** für die SMS-Login-Codes. Kosten grob: Server 5–15 €/Monat, Domain 10–30 €/Jahr, SMS nach Verbrauch.

> Immer nur **eine** Zeile kopieren, einfügen, Enter, warten.

---

## Teil A – Server mieten (Beispiel Hetzner)

1. Konto anlegen auf **https://www.hetzner.com/cloud** (Ausweis/Kreditkarte nötig, Freischaltung kann einige Stunden dauern).
2. In der Cloud-Konsole: **„+ Server erstellen“**
   - Standort: **Nürnberg** oder **Falkenstein** (Deutschland)
   - Image: **Ubuntu 24.04**
   - Typ: **Shared vCPU · x86 · mit 4 GB RAM** (z. B. CX22) – kleiner nicht
   - Netzwerk: **IPv4 + IPv6** angehakt
   - SSH-Key: weglassen → du bekommst das **root-Passwort per E-Mail**
   - Name: `sholat`
3. Nach 1 Minute siehst du die **IPv4-Adresse** (z. B. `116.203.10.20`) – notieren.

Andere Anbieter (Netcup, Contabo, IONOS, lokal in Palästina) funktionieren genauso: **Ubuntu 24.04, 4 GB RAM, root-Zugang**.

## Teil B – Domain auf den Server zeigen lassen

Beim Domain-Anbieter (DNS-Einstellungen):

| Typ | Name | Wert |
|---|---|---|
| A | `@` | deine Server-IP |
| A | `www` | deine Server-IP |

Es dauert 5 Minuten bis einige Stunden, bis das überall bekannt ist.

## Teil C – Twilio für SMS-Codes

1. Konto anlegen: **https://www.twilio.com/try-twilio** (E-Mail + Handynummer bestätigen).
2. Konto **aufladen** (Upgrade → Guthaben, z. B. 20 $). Im Testmodus gehen SMS nur an bestätigte Nummern.
3. **Länder freischalten:** Console → *Messaging* → *Settings* → **Geo permissions** → **Palestinian Territory (+970)** und **Israel (+972)** anhaken → Speichern.
4. **Absender:** Console → *Phone Numbers* → *Buy a number* (mit SMS-Fähigkeit), oder – wo erlaubt – ein Absendername wie `SholaJanoub`.
   Ob und wie SMS an Jawwal-/Ooredoo-Nummern zugestellt werden, zeigt Twilio unter *Messaging → Pricing / Country guidelines* für Palästina – bitte dort prüfen und mit deiner eigenen Nummer testen.
5. Auf der Startseite der Console notieren: **Account SID** (`AC…`) und **Auth Token**.

## Teil D – Installation auf dem Server

Unter Windows: **PowerShell** öffnen.

```
ssh root@DEINE-SERVER-IP
```
(„yes“ eingeben, dann das root-Passwort aus der E-Mail – beim Tippen sieht man nichts, das ist normal.)

Auf dem Server:
```
git clone -b sholat-aljanoub https://github.com/Ibomanasra/test.git /opt/sholat
```
(Ist das Repository privat, fragt Git nach Benutzername und **Token** statt Passwort: GitHub → Settings → Developer settings → Personal access tokens → *Fine-grained*, nur Lesezugriff auf das Repository.)

```
cd /opt/sholat
```
```
bash scripts/server-install.sh
```
Das Skript fragt nach **Domain**, **deiner Handynummer** (Admin-Login), **deinem Passwort** und **Namen**, erzeugt alle geheimen Schlüssel selbst, richtet Firewall und tägliches Backup ein und startet alles (erstes Mal 5–10 Minuten).

## Teil E – Twilio eintragen

```
nano .env
```
Diese Zeilen ändern (Pfeiltasten, dann **Strg+O**, Enter, **Strg+X**):
```
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=AC…
TWILIO_AUTH_TOKEN=…
TWILIO_FROM=+1…      (oder dein Absendername)
```
Optional E-Mail für „Passwort vergessen“:
```
SMTP_HOST=smtp.dein-anbieter.de
SMTP_PORT=587
SMTP_USER=info@deine-domain
SMTP_PASSWORD=…
```
Übernehmen:
```
docker compose up -d
```

## Teil F – Testen

1. **https://deine-domain/ar/admin** → mit deiner Handynummer + Passwort anmelden (Code kommt per SMS).
2. Einstellungen → **Firmendaten**, **Bankkonto**, **Lieferzonen**, **Zahlungsarten** (Kartenzahlung aus, solange kein Gateway eingerichtet ist).
3. Produkte anlegen oder importieren, Preise setzen.
4. Im Shop mit deiner Nummer als Kunde registrieren und eine Testbestellung machen.

## Alltag

| Was | Befehl (auf dem Server in `/opt/sholat`) |
|---|---|
| Neue Version einspielen | `bash scripts/server-update.sh` |
| Läuft alles? | `docker compose ps` |
| Fehler ansehen | `docker compose logs --tail 100 web` |
| Backup jetzt | `./scripts/backup.sh` (liegt in `/opt/sholat-backups`) |
| Einstellungen prüfen | `docker run --rm -v "$PWD":/w -w /w node:22-alpine node scripts/check-prod-env.mjs` |

Backups zusätzlich regelmäßig **außer Haus** speichern (z. B. Hetzner Storage Box oder herunterladen).
