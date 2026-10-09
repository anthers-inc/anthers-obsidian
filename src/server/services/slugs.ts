// SPDX-License-Identifier: Apache-2.0
/**
 * The public URL shape — two-level slugs with the Johnny.Decimal numbers stripped,
 * settled 2026-09-03 in the Anthers vault's build plan and decided again for this server
 * on 2026-10-09 (the domain is the wiki, so there is no `/wiki` prefix and the paths are
 * short).
 *
 * The rules, each from the vault's actual shape:
 *
 * - `Anthers Overview.md` serves the site's home, at `/overview`.
 * - `Anthers Roadmap.md` → `/roadmap`.
 * - The task board: notes under `00-09 Metafiles/01 Tasks/{Active,Done,Future,Templates}/`
 *   → `/tasks/<folder-lowercase>/<kebab(title)>` — the folder structure IS the public
 *   structure, and the board base `Anthers Tasks.base` → `/tasks`.
 * - A band/category/page triple (`10-19 What Anthers Is/10 Introduction/10.01 What Anthers Is.md`)
 *   → `/{category}/{page}`, the Johnny.Decimal prefixes stripped.
 * - A page sitting directly in a band (the flat starting form) → `/{band}/{page}`.
 * - A category's `NN.00` index page is the category's landing → `/{category}` with no page
 *   half — matching Obsidian, where the index does the navigation work.
 * - Any other vault-root markdown → `/{kebab(title)}`.
 *
 * Kebab-casing strips the JD prefixes (`10-19 `, `10 `, `10.01 `), lowercases, turns
 * punctuation runs into single dashes — and the em-dash task titles carry becomes a dash,
 * not a fragment.
 *
 * Collision handling is deterministic: paths are processed in sorted order, the first
 * claimant keeps the clean slug, later ones take `slug-2`, `slug-3`… — same input, same
 * output, no matter when it runs.
 */

export interface SlugMap {
	/** Public slug → vault-relative path. */
	bySlug: Record<string, string>;
	/** Vault-relative path → public slug. */
	byPath: Record<string, string>;
}

/** The Johnny.Decimal prefixes a note title or folder may start with. */
const JD_PREFIX = /^\d{2}(?:-\d{2}|\.\d{2})?(?:\s-\s|\s+)/;
/** Top-level documents with fixed slugs. */
const FIXED_SLUGS: Record<string, string> = {
	"Anthers Overview.md": "overview",
	"Anthers Roadmap.md": "roadmap",
};

export function kebabSlug(name: string): string {
	const stripped = name.replace(JD_PREFIX, "");
	return stripped
		.replace(/[—–]/g, " ")
		.replace(/[^a-zA-Z0-9\s-]/g, " ")
		.trim()
		.replace(/\s+/g, "-")
		.toLowerCase()
		.replace(/-{2,}/g, "-")
		.replace(/^-+|-+$/g, "");
}

/**
 * The slug for one published vault path, before collision adjustment. Empty string means
 * "this path is a category root" (the NN.00 index) and the slug is its parent's.
 */
export function slugForPath(relativePath: string): string {
	const segments = relativePath.split("/");
	const fileName = segments[segments.length - 1];
	const title = fileName.replace(/\.(md|base|canvas)$/, "");

	// Structured files: the board base is the task board's landing; anything else follows
	// the same rule as markdown (its allowlist entry decided that it publishes at all).
	if (relativePath.endsWith(".base")) {
		return fileName === "Anthers Tasks.base" ? "tasks" : kebabSlug(title);
	}

	// Task notes: the Tasks folder's own structure is the public structure.
	if (segments[0] === "00-09 Metafiles" && segments[1] === "01 Tasks") {
		if (segments.length === 3) {
			return `tasks/${kebabSlug(title)}`; // a file directly inside 01 Tasks
		}
		return `tasks/${segments[2].toLowerCase()}/${kebabSlug(title)}`;
	}

	// Top-level fixed slugs, then other root-level notes.
	if (segments.length === 1) {
		return FIXED_SLUGS[fileName] ?? kebabSlug(title);
	}

	// Everything else: category (the deepest folder) + page.
	const category = kebabSlug(segments[segments.length - 2]);
	const pageSlug = kebabSlug(title);

	if (/^\d{2}\.00\s/.test(title)) {
		// The NN.00 index is the category's landing page — no page half of the URL.
		return category;
	}
	return `${category}/${pageSlug}`;
}

/**
 * Build the bidirectional slug map over the published paths, resolving collisions
 * deterministically: sorted order, first claimant keeps, later ones suffix.
 */
export function buildSlugMap(publishedPaths: string[]): SlugMap {
	const bySlug: Record<string, string> = {};
	const byPath: Record<string, string> = {};

	const counts: Record<string, number> = {};
	for (const path of [...publishedPaths].sort()) {
		const base = slugForPath(path);
		const slug = base === "" ? "" : base;
		// An empty base (never produced by slugForPath today) and duplicates both take a suffix.
		const slugTaken = Object.prototype.hasOwnProperty.call(bySlug, slug);
		const n = slugTaken ? (counts[slug] ?? 1) + 1 : 1;
		counts[slug] = n;
		const finalSlug = slugTaken ? `${slug}-${n}` : slug;
		bySlug[finalSlug] = path;
		byPath[path] = finalSlug;
	}
	return { bySlug, byPath };
}