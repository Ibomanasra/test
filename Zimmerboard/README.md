# Zimmerboard mit Team-Chat (ohne Konten)

Zimmerstatus, Mängel, Änderungsverlauf und Team-Chat für das Hotel – **ohne Benutzerkonten**.
Alle melden sich nur mit ihrem **Namen** und einer gemeinsamen **Team-PIN** an.
Änderungen und Chat-Nachrichten erscheinen sofort bei allen.

## Was du brauchst

- Einen PC, der läuft, solange gearbeitet wird (z. B. der Rezeptions-PC)
- **Node.js** (kostenlos): https://nodejs.org → „LTS“ herunterladen und installieren

Sonst nichts – keine Pakete, keine Datenbank, kein Konto.

## Starten

**Windows:** Doppelklick auf `start-windows.bat`
**Mac / Linux:** `./start.sh` (oder `node server.js`)

Im Fenster erscheint z. B.:

```
  Zimmerboard läuft.
  Auf diesem PC:      http://localhost:8080
  Im Hotel-WLAN:      http://192.168.1.20:8080
  Team-PIN:           483920
```

- Auf dem PC selbst: `http://localhost:8080` öffnen.
- Auf Handys/Tablets im **Hotel-WLAN**: die Adresse hinter „Im Hotel-WLAN“ öffnen.
  Tipp: Als Lesezeichen oder „Zum Startbildschirm hinzufügen“ speichern.
- Beim ersten Öffnen: Name eingeben, Team-PIN eingeben – fertig. Die Anmeldung bleibt 180 Tage gespeichert.

Das Fenster muss offen bleiben, solange das Board benutzt wird.
Fragt Windows nach der Firewall: **„Private Netzwerke“ erlauben**, sonst kommen die Handys nicht drauf.

## Team-PIN ändern

Die PIN steht in `data/pin.txt`. Datei bearbeiten, Server neu starten.
Danach müssen sich alle mit der neuen PIN anmelden (gut, wenn jemand das Team verlässt).

## Daten & Sicherung

Alles liegt in `data/board.json`. Zum Sichern diese Datei kopieren.
Gespeichert werden die letzten 2000 Chat-Nachrichten.

## Auch von unterwegs erreichbar machen (optional)

Standardmäßig geht das Board nur im Hotel-WLAN – das ist am sichersten.
Soll es auch über mobile Daten gehen, gibt es zwei Wege:

1. **Tunnel vom Rezeptions-PC**, z. B. Cloudflare Tunnel (`cloudflared tunnel --url http://localhost:8080`).
   Gibt eine https-Adresse aus, die überall funktioniert, solange der PC läuft.
2. **Hosting** bei einem Anbieter mit Node.js und dauerhaftem Speicher (z. B. Railway oder Fly.io mit Volume).
   Dort `TEAM_PIN` und `DATA_DIR` (auf das Volume) als Umgebungsvariablen setzen.

Wichtig: Von außen nur über **https** erreichbar machen und eine **lange PIN** verwenden.

## Einstellungen

| Variable   | Bedeutung                                | Standard |
|------------|------------------------------------------|----------|
| `PORT`     | Port des Servers                          | `8080`   |
| `TEAM_PIN` | Team-PIN (statt `data/pin.txt`)           | –        |
| `DATA_DIR` | Ordner für Daten                          | `./data` |

## Sicherheit – kurz und ehrlich

- Wer die PIN kennt, kann alles sehen und ändern. Namen werden nicht geprüft.
- Nach 8 falschen PIN-Versuchen wird die Adresse 10 Minuten gesperrt.
- Im Hotel-WLAN läuft die Verbindung ohne Verschlüsselung (http). Für sensible Gästedaten daher keine Namen von Gästen eintragen.
