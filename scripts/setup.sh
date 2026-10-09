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
command -v openssl >/dev/null || die "openssl is required and is not on PATH."

hostname="${1:-}"
[[ -n "${hostname}" ]] || die "usage: $0 <hostname>   e.g. $0 wiki.anthers.wiki"

if [[ -e "${OBSIDIAN_DIR}/obsidian.env" ]]; then
	die "${OBSIDIAN_DIR}/obsidian.env exists. Refusing to clobber a working installation."
fi

echo "  -> creating ${OBSIDIAN_DIR}"
# The app inside the container runs as uid 1000 (the image's `bun` user) and the sync
# engine is pinned to the same uid; the vault and the sync state are each owned by it so
# neither service needs root and neither sees the other's files unlocked.
mkdir -p "${OBSIDIAN_DIR}"/{vault,syncthing/config}
chown -R 1000:1000 "${OBSIDIAN_DIR}/vault" "${OBSIDIAN_DIR}/syncthing"

echo "  -> writing ${OBSIDIAN_DIR}/obsidian.env"
gui_password=$(openssl rand --hex 16)
sed \
	-e "s|^WIKI_HOSTNAME=.*|WIKI_HOSTNAME=${hostname}|" \
	-e "s|^SYNCTHING_GUI_PASSWORD=.*|SYNCTHING_GUI_PASSWORD=${gui_password}|" \
	"${HERE}/obsidian.env.example" > "${OBSIDIAN_DIR}/obsidian.env"
chmod 0600 "${OBSIDIAN_DIR}/obsidian.env"

echo "  -> installing the Caddyfile and the sync ignore list"
mkdir -p "${OBSIDIAN_DIR}/caddy/etc/caddy"
install -m 0644 "${HERE}/caddy/Caddyfile" "${OBSIDIAN_DIR}/caddy/etc/caddy/Caddyfile"

cat <<EOF

  Done. Three things before the first \`make up\`:

  1. Point DNS for ${hostname} at this machine.
  2. Copy ${HERE}/vault-sync-ignore.example to
     ${OBSIDIAN_DIR}/vault/.stignore-fragment (or paste it into the sync GUI's ignore
     field) — it is what keeps the internal wiki off this machine, and it matters.
  3. The sync GUI's password is in ${OBSIDIAN_DIR}/obsidian.env. Reach the GUI with
     \`make tunnel\` after the stack is up, pair your authoring machine, and share the
     vault into /vault with the "Send Only" type on your side.

  Then: make up
EOF