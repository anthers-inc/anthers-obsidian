#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
#
# Lay out the host directories and fill the env file, once.
#
# ⚠️ **It stops before any secret is written and tells you what is left to do by hand** —
# following the node bundle's setup.sh shape, which lays out, generates, and then wants
# three things from you. Everything this script creates can be recreated by running it
# again with a different hostname; nothing here is the irreplaceable kind of secret, so
# the script's refusals are about not clobbering a working installation rather than
# protecting unrecoverable state.

set -euo pipefail

OBSIDIAN_DIR="${OBSIDIAN_DIR:-/srv/anthers-obsidian}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

die() { echo "  -> ERROR: $*" >&2; exit 1; }

command -v docker >/dev/null || die "docker is required and is not on PATH."

hostname="${1:-}"
[[ -n "${hostname}" ]] || die "usage: $0 <hostname>   e.g. $0 wiki.anthers.wiki"

if [[ -e "${OBSIDIAN_DIR}/obsidian.env" ]]; then
	die "${OBSIDIAN_DIR}/obsidian.env exists. Refusing to clobber a working installation."
fi

echo "  -> creating ${OBSIDIAN_DIR}"
# The app inside the container runs as uid 1000 (the image's `bun` user) and the sync
# engine is pinned to the same uid; the vault and the sync state are each owned by it so
# neither service needs root and neither sees the other's files unlocked.
mkdir -p "${OBSIDIAN_DIR}"/{vault,sync-state,secrets}
chown -R 1000:1000 "${OBSIDIAN_DIR}/vault" "${OBSIDIAN_DIR}/sync-state"
# The two credentials the sync engine reads as files. Created empty and mode 600, on a
# 0700 directory, filled by hand before or after the first `make up` — the engine refuses
# to start without them, so the order is forgiving but the files are required.
chmod 0700 "${OBSIDIAN_DIR}/secrets"
: > "${OBSIDIAN_DIR}/secrets/obsidian_token"
: > "${OBSIDIAN_DIR}/secrets/vault_password"
chmod 0600 "${OBSIDIAN_DIR}/secrets/obsidian_token" "${OBSIDIAN_DIR}/secrets/vault_password"

echo "  -> writing ${OBSIDIAN_DIR}/obsidian.env"
sed \
	-e "s|^WIKI_HOSTNAME=.*|WIKI_HOSTNAME=${hostname}|" \
	"${HERE}/obsidian.env.example" > "${OBSIDIAN_DIR}/obsidian.env"
chmod 0600 "${OBSIDIAN_DIR}/obsidian.env"

echo "  -> installing the Caddyfile"
mkdir -p "${OBSIDIAN_DIR}/caddy/etc/caddy"
install -m 0644 "${HERE}/caddy/Caddyfile" "${OBSIDIAN_DIR}/caddy/etc/caddy/Caddyfile"

cat <<EOF

  Done. Things before the first \`make up\`:

  1. Point DNS for ${hostname} at this machine.
  2. Edit ${OBSIDIAN_DIR}/obsidian.env — VAULT_NAME must be your vault's exact remote
     name on Obsidian Sync, and check the exclusions read right for your boundary.
  3. Mint the sync credentials, in your own terminal:
        cd $(cd "${HERE}" && pwd) && make sync-token   # pastes a token once you log in
        printf %s '<token>'    > ${OBSIDIAN_DIR}/secrets/obsidian_token
        printf %s '<password>' > ${OBSIDIAN_DIR}/secrets/vault_password
     The password is the vault's end-to-end encryption password, the one Obsidian's own
     Sync settings page would show — not your Obsidian account password.

  Then: make up   (the first start runs the initial download; watch it with
                   docker compose logs -f sync, then run scripts/verify-deploy.sh)
EOF