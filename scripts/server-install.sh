#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Einrichtung auf einem frischen Ubuntu-Server (22.04/24.04), als root im Projektordner:
#   bash scripts/server-install.sh
# Installiert Docker + Firewall, legt .env mit sicheren Zufallswerten an (fragt nur
# Domain, deine Handynummer und dein Passwort), prüft alles und startet den Shop.
# Erneut ausführen ist unschädlich (bestehende .env bleibt erhalten).
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."
say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

if [ "$(id -u)" -ne 0 ]; then echo "Bitte als root ausführen (sudo -i)."; exit 1; fi

say "1/6 Systempakete und Docker"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl git ufw openssl cron >/dev/null
if ! command -v docker >/dev/null; then curl -fsSL https://get.docker.com | sh >/dev/null; fi
systemctl enable --now docker >/dev/null

say "2/6 Firewall (nur SSH, HTTP, HTTPS offen)"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow 443/udp >/dev/null
ufw --force enable >/dev/null

say "3/6 Einstellungen (.env)"
if [ ! -f .env ]; then
  rnd() { openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c "$1"; }
  read -rp "Domain ohne https:// (z. B. sholataljanoub.ps): " DOMAIN
  read -rp "Deine Handynummer für den Admin-Login (z. B. 0599123456): " PHONE
  PHONE="$(echo "$PHONE" | tr -dc '0-9+')"
  case "$PHONE" in +*) ;; 0*) PHONE="+970${PHONE#0}" ;; *) PHONE="+$PHONE" ;; esac
  while true; do
    read -rsp "Dein Admin-Passwort (mind. 10 Zeichen): " PW; echo
    [ "${#PW}" -ge 10 ] && break
    echo "Zu kurz, bitte noch einmal."
  done
  read -rp "Dein Name (für das Admin-Konto): " OWNER
  cp .env.example .env
  set_kv() { # Schlüssel=Wert in .env setzen (vorhanden: ersetzen, sonst anhängen)
    if grep -q "^$1=" .env; then sed -i "s|^$1=.*|$1=$(printf '%s' "$2" | sed 's/[&|]/\\&/g')|" .env; else echo "$1=$2" >> .env; fi
  }
  DBPW="$(rnd 32)"
  set_kv NODE_ENV production
  set_kv DOMAIN "$DOMAIN"
  set_kv APP_URL "https://$DOMAIN"
  set_kv COMPOSE_FILE "docker-compose.yml:docker-compose.prod.yml"
  set_kv COOKIE_SECURE true
  set_kv SESSION_SECRET "$(rnd 64)"
  set_kv POSTGRES_PASSWORD "$DBPW"
  set_kv DATABASE_URL "postgresql://sa:$DBPW@postgres:5432/sholat_aljanoub?schema=public"
  set_kv S3_ACCESS_KEY "sa_$(rnd 12)"
  set_kv S3_SECRET_KEY "$(rnd 40)"
  set_kv OTP_DEV_FIXED_CODE ""
  set_kv SEED_OWNER_PHONE "$PHONE"
  set_kv SEED_OWNER_NAME "\"$OWNER\""
  set_kv SEED_OWNER_PASSWORD "$PW"
  set_kv SEED_DEMO_DATA false
  set_kv SEED_DEMO_PASSWORD "$(rnd 20)"
  set_kv SMTP_HOST ""
  set_kv SMTP_PORT 587
  set_kv SMTP_SECURE false
  set_kv SMTP_FROM "\"شعلة الجنوب <no-reply@$DOMAIN>\""
  set_kv BACKUP_DIR /opt/sholat-backups
  chmod 600 .env
  echo ".env angelegt. SMS- und E-Mail-Zugang später mit: nano .env"
else
  echo ".env vorhanden – bleibt unverändert."
fi

say "4/6 Prüfung der Einstellungen"
docker run --rm -v "$PWD":/w -w /w node:22-alpine node scripts/check-prod-env.mjs

say "5/6 Bauen und starten (beim ersten Mal 5–10 Minuten)"
docker compose up -d --build

say "6/6 Tägliches Backup (02:30) einrichten"
mkdir -p /opt/sholat-backups
CRON="30 2 * * * cd $PWD && ./scripts/backup.sh >> /var/log/sholat-backup.log 2>&1"
# (ohne bestehende Crontab liefern crontab -l/grep Fehlercodes – hier bewusst ignorieren)
{ crontab -l 2>/dev/null | grep -v 'scripts/backup.sh' || true; echo "$CRON"; } | crontab -
echo "Backup täglich 02:30 → /opt/sholat-backups"

DOMAIN_NOW="$(grep '^DOMAIN=' .env | cut -d= -f2)"
say "Fertig!"
echo "Shop:   https://$DOMAIN_NOW/ar"
echo "Admin:  https://$DOMAIN_NOW/ar/admin"
echo "Das HTTPS-Zertifikat kommt automatisch, sobald die Domain auf diesen Server zeigt (bis zu einigen Minuten)."
echo "Status ansehen:  docker compose ps     Protokoll:  docker compose logs -f web"
