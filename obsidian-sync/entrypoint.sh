#!/bin/sh
# Entrypoint for the publishing stack's Obsidian Sync (headless) container.
#
# The house pattern is Cumulus's obsidian-sync implementation; this variant carries
# the publisher's posture, where the synced folder is a read-only consumer and the
# publish boundary has a sync-layer half:
#
# - **mirror-remote**: the sync downloads and reverts local change, so this machine
#   can never become a vault editor even by accident (OBSIDIAN_SYNC_MODE sets it,
#   mirror-remote by default).
# - **no config syncing**: .obsidian/ never propagates to this machine — it is not
#   the app's to read (enforced every start, like everything below).
# - **the exclusion belt is a stated decision**: OBSIDIAN_EXCLUDED_FOLDERS must be
#   set — it names what never arrives on a machine whose only job is to be public,
#   and an unstated empty value would silently clear it.
#
# Otherwise the Cumulus contract: on startup it repairs ownership of the state
# volume and the vault directory (the container starts as root; Docker
# auto-creates missing bind sources as root:root, which would otherwise lock the
# sync user out of its own vault), logs in — reusing the auth token persisted in
# /state when present, otherwise OBSIDIAN_EMAIL/OBSIDIAN_PASSWORD — links the local
# vault to the remote vault (ob sync-setup; creating the remote first when
# OBSIDIAN_CREATE_REMOTE=true, which a publisher leaves at false because a typos
# remote name should error, not create), and keeps the folder in sync with
# `ob sync --continuous`. All ob invocations drop to the sync user (gosu) — root
# never writes vault or state files.
#
# If login fails and the account uses 2FA, do the login interactively once and
# retry the container — the token then persists in the state volume:
#   make obsidian-login

set -eu

RUN_UID="${OBSIDIAN_UID:-1000}"
RUN_GID="${OBSIDIAN_GID:-1000}"
VAULT_PATH="/vaults/${OBSIDIAN_VAULT_NAME}"
DEVICE_NAME="${OBSIDIAN_DEVICE_NAME:-anthers-obsidian}"
SYNC_MODE="${OBSIDIAN_SYNC_MODE:-mirror-remote}"

echo "[obsidian-sync] vault: ${OBSIDIAN_VAULT_NAME} (mode: ${SYNC_MODE})"

# The publisher's exclusion belt is a stated env decision, not a default: an unset
# value would clear the belt behind the operator's back.
[ -n "${OBSIDIAN_EXCLUDED_FOLDERS+x}" ] || {
	echo "[obsidian-sync] OBSIDIAN_EXCLUDED_FOLDERS is not set — the sync belt must be stated (it may be empty, by the operator's own decision)" >&2
	exit 1
}

run() {
	# gosu resets $HOME to the target user's home (/home/node in the base
	# image), which would hide the persisted auth token in /state
	gosu "$RUN_UID:$RUN_GID" env HOME=/state "$@"
}

# Repair ownership only when the top-level owner is wrong, so healthy vaults
# pay no recursive traversal on start.
fix_owner() {
	[ "$(stat -c '%u:%g' "$1")" = "$RUN_UID:$RUN_GID" ] || chown -R -- "$RUN_UID:$RUN_GID" "$1"
}

# ob writes its config to /state/.config/obsidian-headless; repair the config
# tree recursively on every start — the directories get created as root by the
# mkdir, and a top-level-only check leaves the inner directory locking the sync
# user out of its own token (found on the publishing droplet's first link,
# 2026-10-12). The tree is tiny — a token, one config per vault — so the cost is
# nothing; /state gets the cheap top-level repair like before.
fix_owner /state
mkdir -p /state/.config/obsidian-headless
chown -R -- "$RUN_UID:$RUN_GID" /state/.config

# The vault directory must be mounted
if [ ! -d "${VAULT_PATH}" ]; then
	echo "[obsidian-sync] vault directory ${VAULT_PATH} is not mounted, check the compose bind" >&2
	exit 1
fi
fix_owner "${VAULT_PATH}"

# --- login ----------------------------------------------------------------#

# The "already logged in" probe hits the network, so transient failures (e.g.
# the stack starting during a Sync-side hiccup) must not be mistaken for a
# missing session. Retry before concluding anything.
LOGGED_IN=no
for _ in 1 2 3; do
	probe_out=$(run ob sync-list-remote 2>&1) && { LOGGED_IN=yes; break; }
	case "$probe_out" in *"No account logged in"*) break ;; esac
	sleep 5
done

if [ "${LOGGED_IN}" != "yes" ]; then
	if [ -z "${OBSIDIAN_EMAIL:-}" ] || [ -z "${OBSIDIAN_PASSWORD:-}" ]; then
		echo "[obsidian-sync] not logged in and OBSIDIAN_EMAIL/OBSIDIAN_PASSWORD not set" >&2
		echo "[obsidian-sync] if the account uses 2FA, log in interactively once: make obsidian-login" >&2
		exit 1
	fi
	echo "[obsidian-sync] logging in..."
	if ! run ob login --email "${OBSIDIAN_EMAIL}" --password "${OBSIDIAN_PASSWORD}"; then
		echo "[obsidian-sync] login failed — if the account uses 2FA, log in interactively once: make obsidian-login" >&2
		exit 1
	fi
fi

# --- helpers: parse ob's --json output with node (POSIX sh has no jq) ------

REMOTE_EXISTS=$(run ob sync-list-remote --json | node -e '
	let d = "";
	process.stdin.on("data", (c) => (d += c)).on("end", () => {
		let j = JSON.parse(d);
		let all = [...(j.vaults || []), ...(j.shared || [])];
		console.log(all.some((v) => v.name === process.argv[1]) ? "yes" : "no");
	});
' "${OBSIDIAN_VAULT_NAME}") || {
	echo "[obsidian-sync] remote vault listing failed after login" >&2
	exit 1
}

LOCAL_CONFIGURED=$(run ob sync-list-local --json | node -e '
	let d = "";
	process.stdin.on("data", (c) => (d += c)).on("end", () => {
		let j = JSON.parse(d);
		console.log((j.vaults || []).some((v) => v.path === process.argv[1]) ? "yes" : "no");
	});
' "${VAULT_PATH}")

# --- remote vault ----------------------------------------------------------#

if [ "${REMOTE_EXISTS}" != "yes" ]; then
	if [ "${OBSIDIAN_CREATE_REMOTE:-false}" != "true" ]; then
		echo "[obsidian-sync] remote vault \"${OBSIDIAN_VAULT_NAME}\" does not exist and OBSIDIAN_CREATE_REMOTE=false" >&2
		echo "[obsidian-sync] check the vault name against the account (or set OBSIDIAN_CREATE_REMOTE=true to create it)" >&2
		exit 1
	fi
	if [ -z "${OBSIDIAN_E2EE_PASSWORD:-}" ]; then
		echo "[obsidian-sync] cannot create an end-to-end encrypted vault without OBSIDIAN_E2EE_PASSWORD" >&2
		exit 1
	fi
	echo "[obsidian-sync] creating remote vault..."
	run ob sync-create-remote --name "${OBSIDIAN_VAULT_NAME}" --encryption end-to-end --password "${OBSIDIAN_E2EE_PASSWORD}"
fi

# --- link the local vault ---------------------------------------------------#

if [ "${LOCAL_CONFIGURED}" != "yes" ]; then
	echo "[obsidian-sync] linking local vault to remote (device: ${DEVICE_NAME})..."
	set -- run ob sync-setup --vault "${OBSIDIAN_VAULT_NAME}" --path "${VAULT_PATH}" --device-name "${DEVICE_NAME}" --json
	if [ -n "${OBSIDIAN_E2EE_PASSWORD:-}" ]; then
		set -- "$@" --password "${OBSIDIAN_E2EE_PASSWORD}"
	fi
	"$@"
else
	echo "[obsidian-sync] already configured — syncing"
fi

# --- the publisher's posture (enforced on every start) ----------------------#

# ob sync-setup records the bidirectional default, no exclusions and an empty
# config list — the first two are wrong for a publisher, so mode and exclusions
# are enforced here on every start, the way Cumulus enforces config syncing. An
# operator's posture stated once in the env survives any re-link this way.
echo "[obsidian-sync] enforcing posture: mode ${SYNC_MODE}, belt ${OBSIDIAN_EXCLUDED_FOLDERS:-<empty>}"
run ob sync-config --path "${VAULT_PATH}" \
	--mode "${SYNC_MODE}" \
	--configs "" \
	--excluded-folders "${OBSIDIAN_EXCLUDED_FOLDERS}"

# --- continuous sync --------------------------------------------------------#

exec gosu "$RUN_UID:$RUN_GID" env HOME=/state ob sync --path "${VAULT_PATH}" --continuous