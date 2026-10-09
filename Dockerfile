# SPDX-License-Identifier: Apache-2.0
#
# The publishing server's image: build the frontend once, ship the runtime the lean way.
#
# ⚠️ The base is pinned to a minor line rather than floated on `1`, following the same rule
# the node bundle states: an unattended restart should pick up patches, never a major whose
# behavior nobody has read. Bump the pin deliberately.
FROM oven/bun:1.3-slim AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM oven/bun:1.3-slim
WORKDIR /app

# ⚠️ `bun` (the runtime) is the only thing that runs here — no package manager, so the
# production install is the builder's node_modules copied forward. The lockfile guarantees
# the copy carries exactly what the build used.
COPY --from=builder /app/build ./build
COPY --from=builder /app/src ./src
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# ⭐ The server never writes (the vault copy is mounted read-only and nothing else is
# writable), so it runs as its own unprivileged user rather than root.
USER bun

ENV VAULT_PATH=/vault \
    PORT=3000
EXPOSE 3000

# /health answers 200 the moment the server is up — the startup parse runs before the
# listener binds, so a green healthcheck means indexes are actually built, not merely booted.
# The image carries no wget or curl; bun's own fetch is the probe instead.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=5 \
	CMD bun -e "await fetch('http://127.0.0.1:' + (process.env.PORT ?? 3000) + '/health').then((r) => { if (!r.ok) process.exit(1); })" || exit 1

CMD ["bun", "run", "src/server/index.ts"]