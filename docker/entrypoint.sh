#!/bin/sh
set -e
cd /db
echo "[entrypoint] prisma migrate deploy"
./node_modules/.bin/prisma migrate deploy
if [ "${SEED_ON_START:-true}" = "true" ]; then
  echo "[entrypoint] seed (idempotent)"
  ./node_modules/.bin/tsx prisma/seed.ts
fi
cd /app
echo "[entrypoint] starting web on :${PORT:-3000}"
exec node apps/web/server.js
