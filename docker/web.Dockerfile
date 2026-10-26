# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Sholat Aljanoub – Web (Next.js standalone) + Migration/Seed beim Start
#
# Optional hinter TLS-abfangenden Firmen-Proxys: zusätzliches CA-Zertifikat als Secret
#   docker build --secret id=extra_ca,src=/pfad/ca.crt …
# ---------------------------------------------------------------------------
ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
# Prisma braucht libssl; Slim-Images bringen es nicht mit.
# Mit extra_ca werden die Paketquellen per HTTPS über den Proxy geladen.
RUN --mount=type=secret,id=extra_ca,required=false \
  command -v openssl >/dev/null 2>&1 || ( \
    if [ -f /run/secrets/extra_ca ]; then \
      sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources; \
      echo 'Acquire::https::CAInfo "/run/secrets/extra_ca";' > /etc/apt/apt.conf.d/99extra-ca; \
    fi \
    && apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* /etc/apt/apt.conf.d/99extra-ca)
RUN --mount=type=secret,id=extra_ca,required=false \
  if [ -f /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
  corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY scripts/link-env.mjs scripts/
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/contracts/package.json packages/contracts/
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/db/prisma packages/db/prisma
RUN --mount=type=cache,id=pnpm,target=/pnpm/store --mount=type=secret,id=extra_ca,required=false \
  if [ -f /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
  pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN --mount=type=secret,id=extra_ca,required=false \
  if [ -f /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
  pnpm --filter @sa/db generate && pnpm --filter @sa/web build
# Eigenständiges Paket für Migration + Seed (inkl. @sa/core)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store --mount=type=secret,id=extra_ca,required=false \
  if [ -f /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
  pnpm --filter @sa/db deploy --legacy --prod /out/db && cd /out/db \
  && ./node_modules/.bin/prisma generate \
  # lädt die CLI-Engines für das (identische) Laufzeit-OS schon beim Build – Postinstall läuft bei pnpm deploy nicht
  && ./node_modules/.bin/prisma version

FROM base AS runtime
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 TZ=Asia/Hebron
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
COPY --from=build --chown=node:node /out/db /db
COPY --chmod=755 docker/entrypoint.sh /entrypoint.sh
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/entrypoint.sh"]
