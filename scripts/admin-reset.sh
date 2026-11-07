#!/usr/bin/env bash
# Notfall: Admin-(Inhaber-)Zugang neu setzen – auf dem Server im Projektordner:
#   bash scripts/admin-reset.sh
# Fragt Benutzername (Standard: admin) und neues Passwort (wird nicht angezeigt).
set -euo pipefail
cd "$(dirname "$0")/.."
read -rp "Benutzername für den Admin-Login [admin]: " RESET_USERNAME
RESET_USERNAME="${RESET_USERNAME:-admin}"
while true; do
  read -rsp "Neues Admin-Passwort (mind. 10 Zeichen): " RESET_PASSWORD; echo
  read -rsp "Noch einmal: " AGAIN; echo
  [ "$RESET_PASSWORD" = "$AGAIN" ] && [ "${#RESET_PASSWORD}" -ge 10 ] && break
  echo "Stimmt nicht überein oder zu kurz – bitte noch einmal."
done
export RESET_USERNAME RESET_PASSWORD
docker compose exec -T -e RESET_USERNAME -e RESET_PASSWORD web sh -c 'cd /db && ./node_modules/.bin/tsx prisma/reset-owner.ts'
