// SPDX-License-Identifier: Apache-2.0
/**
 * The server-side publish boundary — the code-side enforcement point for "what this vault
 * publishes" against a vault copy that may still carry unpublished material.
 *
 * 🚨 **This module exists because the sync layer is not the boundary.** The deployment syncs a
 * vault copy with `Internal Wiki/` excluded at the transport (Syncthing ignore patterns), which
 * makes leakage physically impossible for a correctly configured server. But the Anthers board
 * base (`Anthers Tasks.base`) union-matches BOTH task roots in every view, and a copy that ever
 * carries the internal root — a mis-set ignore pattern, a transport swap, a mis-restored backup —
 * would render internal task names to the public. So the server checks paths itself, failing
 * closed: an unpublished path answers 404 exactly like a missing one and never confirms it exists.
 *
 * The rule (Anthers' publish boundary by location, settled 2026-10-02 in the Anthers vault's
 * agents docs): everything outside the excluded roots publishes — including the public task
 * board under `00-09 Metafiles/01 Tasks/` — with three deliberate narrowings:
 *
 * 1. **Excluded roots** (`PUBLISH_EXCLUDE`): `Internal Wiki` (never publishes), `90-99 Agents`
 *    (agent machinery), and `00-09 Metafiles` (vault machinery — but see (2)).
 * 2. **Includes override excludes by specificity** (`PUBLISH_INCLUDE`): `00-09 Metafiles/01 Tasks`
 *    is longer than the `00-09 Metafiles` exclude that contains it, so the public task notes
 *    publish while attachments and templates beside them do not. A longer include prefix always
 *    wins; an equal or shorter one never does.
 * 3. **Bases are allowlisted** (`PUBLISH_BASE_FILES`): a base view *enumerates* — it can surface
 *    rows the folder layout would have hidden — so an unlisted `.base` never publishes. The one
 *    Anthers allows is `Anthers Tasks.base`, the public board, and only because the synced copy
 *    excludes the internal root so its internal-root globs match nothing. Canvas follows the
 *    folder rules: it is fixed drawing content and enumerates nothing.
 *
 * Defaults are Anthers' shape, env-overridable so another vault operator publishing from this
 * server states their own boundary rather than inheriting ours.
 */

/** Comma-separated vault-relative directory prefixes that never publish. */
const EXCLUDE = parsePrefixList(process.env.PUBLISH_EXCLUDE ?? "Internal Wiki,90-99 Agents,00-09 Metafiles");

/** Comma-separated vault-relative directory prefixes that publish despite an excluded ancestor — only when longer than the exclude they override. */
const INCLUDE = parsePrefixList(process.env.PUBLISH_INCLUDE ?? "00-09 Metafiles/01 Tasks");

/** Comma-separated vault-relative file paths — the only `.base` files this server will serve. */
const BASE_ALLOWLIST = parsePrefixList(process.env.PUBLISH_BASE_FILES ?? "Anthers Tasks.base");

function parsePrefixList(value: string): string[] {
	return value
		.split(",")
		.map((s) => normalizePath(s.trim()))
		.filter((s) => s !== "");
}

/** Normalize a vault-relative path for comparison: posix slashes, no leading/trailing slashes. */
export function normalizePath(p: string): string {
	return p.replaceAll("\\", "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

/**
 * Whether a vault-relative path — file OR directory — is inside the published set.
 * Directories use the same rule as their contents: a directory is published when any
 * published path could live under it (see `canContainPublished` for the pruning form).
 */
export function isPublishedPath(relativePath: string): boolean {
	const p = normalizePath(relativePath);

	// 🚨 Dotfiles and dot-folders never publish: `.stignore`, `.agents/`, `.obsidian/`,
	// `.trash/` are machinery or working state, and the boundary must not depend on the
	// exclusion list remembering each one — ANY dot-prefixed segment fails the check.
	if (p.split("/").some((seg) => seg.startsWith("."))) {
		return false;
	}

	const matchingExcludes = EXCLUDE.filter((ex) => p === ex || p.startsWith(`${ex}/`));

	if (matchingExcludes.length === 0) {
		// Not under any exclusion. Bases still need their allowlist.
		return !p.endsWith(".base") || BASE_ALLOWLIST.includes(p);
	}

	// Under exclusion — an include overrides it only when strictly longer than the exclude it
	// sits inside. (`00-09 Metafiles/01 Tasks` beats `00-09 Metafiles`; the same prefix as the
	// exclude would re-include the excluded root wholesale, which is never the intent.)
	const longestExclude = matchingExcludes.reduce((a, b) => (b.length > a.length ? b : a));
	const overridingInclude = INCLUDE.find((inc) => (p === inc || p.startsWith(`${inc}/`)) && inc.length > longestExclude.length);

	if (overridingInclude) {
		return !p.endsWith(".base") || BASE_ALLOWLIST.includes(p);
	}

	return false;
}

/**
 * Whether a directory can be pruned from a walk: true when it, or anything under it,
 * could contain a published path. Used to cut excluded subtrees early, including the
 * partially-published one (`00-09 Metafiles` stays walkable only because `01 Tasks`
 * publishes inside it; `00-09 Metafiles/00 Attachments` prunes whole).
 */
export function canContainPublished(dirPath: string): boolean {
	const d = normalizePath(dirPath);
	if (isPublishedPath(d)) return true;
	return INCLUDE.some((inc) => inc === d || inc.startsWith(`${d}/`));
}