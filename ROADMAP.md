# Roadmap

Stand: alle 6 Phasen abgeschlossen. Alles, was noch nicht umgesetzt ist, steht hier als `TODO:`. Im Code markieren `TODO(Phase N)`-Kommentare und die Admin-Menüpunkte mit „P2/P3/P5“ dieselben Stellen.

## Phase 2 – erledigt (siehe CHANGELOG 0.2.0)
## Phase 3 – erledigt (siehe CHANGELOG 0.3.0)

## Phase 4 – erledigt (siehe CHANGELOG 0.4.0)
- TODO: **Pflichtangaben der palästinensischen Steuerrechnung mit Steuerberater prüfen** (konfigurierbar unter Einstellungen → Dokumente → Steuerrechnung, `CompanySettings.taxInvoiceFields`)
- TODO (optional): „Übertrag“ (Zwischensumme je Seite) bei mehrseitigen Rechnungen

## Phase 5 – erledigt (siehe CHANGELOG 0.5.0)
- TODO (optional): Lager-Umbuchungen zwischen mehreren Lagern (Modell vorbereitet: TRANSFER_IN/OUT)
- TODO (optional): Mahnungen per SMS/E-Mail versenden (Adapter vorhanden)

## Phase 6 – erledigt (siehe CHANGELOG 0.6.0)
- TODO: Gateway-Zugang bei Arab Bank / PayTabs beantragen, im Sandbox-Modus des Anbieters abnehmen (Adapter sind nach den öffentlichen API-Beschreibungen umgesetzt und mit simulierten Antworten getestet)
- TODO: Erstattungen (Refund) über die Gateway-API statt manuell im Portal
- TODO: Store-Builds mit EAS (App-Icons, Splash, Signierschlüssel), Push-Benachrichtigungen (Expo Notifications) für Bestellstatus
- TODO: Unterschrift und Foto bei Zustellung in der App (im Web-Fahrermodus vorhanden)
- TODO: Echte SMS-/WhatsApp-Anbieter als Adapter (Schnittstelle `MessageAdapter` existiert)

## Technische Schulden / Querschnitt
- TODO: Upgrade Prisma 6 → 7 (`prisma.config.ts`, Driver-Adapter `@prisma/adapter-pg`)
- TODO: Passwort-Reset für Mitarbeiter per E-Mail (Mailpit ist vorbereitet, Mail-Adapter fehlt noch)
- TODO: Docker-Image-Build in einer Umgebung mit Zugriff auf `deb.debian.org` vollständig verifizieren (in der Entwicklungs-Sandbox gesperrt; alle übrigen Schritte und der Standalone-Server sind getestet)
- TODO: Rate-Limit-Tabelle periodisch aufräumen (Cron/Job), abgelaufene OTP-Challenges und Sessions löschen
