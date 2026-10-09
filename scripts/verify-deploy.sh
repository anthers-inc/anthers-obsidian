#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
#
# Post-deploy verification, meant to be run ON the droplet right after `make up`.
#
# ⭐ Follows the "after a deploy meant to change externally-visible behavior, read the
# external surface" rule: a green `make up` proves the containers started, not that the
# wiki is being served correctly — this checks the thing itself, through the public door,
# including the boundary answers that must never change.

set -euo pipefail

die() { echo "  -> FAIL: $*" >&2; exit 1; }

hostname="${1:-}"

# Without a hostname argument, read it from the env file the setup script wrote.
if [[ -z "${hostname}" ]]; then
	envfile="${OBSIDIAN_DIR:-/srv/anthers-obsidian}/obsidian.env"
	[[ -e "${envfile}" ]] || die "no hostname argument and no env file at ${envfile}"
	hostname=$(grep '^WIKI_HOSTNAME=' "${envfile}" | cut -d= -f2)
fi
[[ -n "${hostname}" ]] || die "could not determine the hostname"

echo "  -> local health"
curl -fsS http://127.0.0.1:3000/health | grep -q '"ok"' || die "local /health did not answer ok"

echo "  -> TLS through Caddy"
curl -fsS "https://${hostname}/health" | grep -q '"ok"' || die "https://${hostname}/health did not answer ok"

echo "  -> the vault root serves HTML"
curl -fsS "https://${hostname}/" | head -c 200 | grep -qi "html" || die "the site root served no HTML"

echo "  -> an index ships for search"
code=$(curl -s -o /dev/null -w "%{http_code}" "https://${hostname}/api/search?q=anthers")
[[ "${code}" == "200" ]] || die "search answered ${code}, not 200"

echo "  -> the boundary holds through the public door"
# A path under an excluded root must answer exactly like a missing one: 404, never 403,
# because a 403 would confirm existence. The path is an internal document's shape.
code=$(curl -s -o /dev/null -w "%{http_code}" "https://${hostname}/api/files/Internal%20Wiki/does-not-matter.md")
[[ "${code}" == "404" ]] || die "an Internal Wiki path answered ${code} — the boundary leaked information"

echo "  all checks green"