// SPDX-License-Identifier: Apache-2.0
import type { SlugMap } from "../hooks/useSlugMap";

/**
 * The public URL for a vault path, through the slug map — or null when the path is not
 * published (or the map has not loaded yet). Every component that navigates to a note
 * goes through this, so no component ever puts a vault path in a public URL.
 *
 * Callers hold the path in either extension shape — base rows and search results carry
 * the full `.md` path, canvas JSON sometimes the bare name — so both are tried.
 */
export function hrefForPath(slugMap: SlugMap | undefined, path: string | undefined | null): string | null {
	if (!slugMap || !path) return null;
	const slug = slugMap.byPath[path] ?? (/\.md$/i.test(path) ? undefined : slugMap.byPath[`${path}.md`]);
	return slug ? `/${slug}` : null;
}