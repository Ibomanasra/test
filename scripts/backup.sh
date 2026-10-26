#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Backup: PostgreSQL (pg_dump, custom format) + Dateien aus MinIO (tar).
#   ./scripts/backup.sh              → ./backups/<zeitstempel>/
# Per Cron, z. B. täglich 02:30:  30 2 * * *  cd /opt/sholat-aljanoub && ./scripts/backup.sh
# Alte Backups werden nach BACKUP_RETENTION_DAYS gelöscht.
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."
CLI_BACKUP_DIR="${BACKUP_DIR:-}"
[ -f .env ] && set -a && . ./.env && set +a
[ -n "$CLI_BACKUP_DIR" ] && BACKUP_DIR="$CLI_BACKUP_DIR"
# Hilfscontainer mit tar (das MinIO-Image enthält keins); nutzt das ohnehin vorhandene Postgres-Image
MINIO_CID="$(docker compose ps -q minio)"
TAR_IMAGE="postgres:16-alpine"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION="${BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="$BACKUP_DIR/$STAMP"
mkdir -p "$TARGET"

echo "[backup] database → $TARGET/db.dump"
docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-sa}" -d "${POSTGRES_DB:-sholat_aljanoub}" -Fc --no-owner > "$TARGET/db.dump"
# Integrität prüfen (liest das Inhaltsverzeichnis des Dumps)
docker compose exec -T postgres pg_restore --list < "$TARGET/db.dump" > /dev/null

echo "[backup] files → $TARGET/files.tar"
docker run --rm --volumes-from "$MINIO_CID" "$TAR_IMAGE" tar -C /data -cf - . > "$TARGET/files.tar"

( cd "$TARGET" && sha256sum db.dump files.tar > SHA256SUMS )
echo "[backup] done: $(du -sh "$TARGET" | cut -f1)"

find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION" -print -exec rm -rf {} + | sed 's/^/[backup] removed old /'
