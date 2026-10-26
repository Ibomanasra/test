#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Wiederherstellung aus einem Backup-Ordner (ÜBERSCHREIBT Datenbank und Dateien!).
#   ./scripts/restore.sh ./backups/20261026-023000 --yes
# Die Web-App sollte währenddessen gestoppt sein:  docker compose stop web
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."
CLI_BACKUP_DIR="${BACKUP_DIR:-}"
[ -f .env ] && set -a && . ./.env && set +a
[ -n "$CLI_BACKUP_DIR" ] && BACKUP_DIR="$CLI_BACKUP_DIR"
# Hilfscontainer mit tar (das MinIO-Image enthält keins); nutzt das ohnehin vorhandene Postgres-Image
MINIO_CID="$(docker compose ps -q minio)"
TAR_IMAGE="postgres:16-alpine"

SRC="${1:-}"
if [ -z "$SRC" ] || [ "${2:-}" != "--yes" ]; then
  echo "Usage: $0 <backup-dir> --yes" >&2
  exit 1
fi
( cd "$SRC" && sha256sum -c SHA256SUMS )

echo "[restore] database"
docker compose exec -T postgres pg_restore -U "${POSTGRES_USER:-sa}" -d "${POSTGRES_DB:-sholat_aljanoub}" --clean --if-exists --no-owner < "$SRC/db.dump"

echo "[restore] files"
docker run --rm -i --volumes-from "$MINIO_CID" "$TAR_IMAGE" tar -C /data -xf - < "$SRC/files.tar"
echo "[restore] done – jetzt: docker compose start web"
