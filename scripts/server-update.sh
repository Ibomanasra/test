#!/usr/bin/env bash
# Neue Version einspielen (auf dem Server, im Projektordner):  bash scripts/server-update.sh
# Macht vorher ein Backup, holt den neuen Stand, baut neu und startet. Datenbank-Migrationen laufen beim Start.
set -euo pipefail
cd "$(dirname "$0")/.."
echo "==> Backup";        ./scripts/backup.sh
echo "==> Neuer Stand";   git pull --ff-only
echo "==> Prüfung";       docker run --rm -v "$PWD":/w -w /w node:22-alpine node scripts/check-prod-env.mjs
echo "==> Bauen/Starten"; docker compose up -d --build
docker image prune -f >/dev/null
echo "==> Fertig."; docker compose ps
