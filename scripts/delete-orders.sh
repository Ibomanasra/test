#!/usr/bin/env bash
# Testbestellungen löschen (auf dem Server im Projektordner):
#   bash scripts/delete-orders.sh
# Macht zuerst ein Backup, zeigt alle Bestellungen und fragt, welche gelöscht werden sollen.
# Gelöscht werden auch die zugehörigen Rechnungen, Zahlungen, Lieferscheine und Abrechnungen;
# der Bestand wird zurückgebucht. Produkte, Kunden und Einstellungen bleiben.
set -euo pipefail
cd "$(dirname "$0")/.."
run() { docker compose exec -T "$@" web sh -c 'cd /db && ./node_modules/.bin/tsx prisma/delete-orders.ts'; }

echo "==> Backup (zur Sicherheit)"
./scripts/backup.sh

echo
echo "==> Alle Bestellungen:"
run -e ORDERS_MODE=list
echo
echo "Welche Bestellungen löschen?"
echo "  - ALL                       = alle"
echo "  - oder Nummern, z. B.:  SO-2026-000001 SO-2026-000002"
read -rp "> " ORDERS
[ -z "$ORDERS" ] && { echo "Abgebrochen."; exit 0; }

RESET_NUMBERS=no
if [ "$(echo "$ORDERS" | tr '[:lower:]' '[:upper:]')" = "ALL" ]; then
  read -rp "Nummern danach wieder ab 1 beginnen (SO-…-000001, INV-…-000001)? [ja/nein] " R
  [ "$R" = "ja" ] && RESET_NUMBERS=yes
fi

echo
read -rp "Wirklich löschen? Das kann man nur mit dem Backup rückgängig machen. Zum Bestätigen 'ja' eingeben: " OK
[ "$OK" = "ja" ] || { echo "Abgebrochen – nichts gelöscht."; exit 0; }

run -e ORDERS_MODE=delete -e ORDERS="$ORDERS" -e RESET_NUMBERS="$RESET_NUMBERS"
echo "==> Fertig."
