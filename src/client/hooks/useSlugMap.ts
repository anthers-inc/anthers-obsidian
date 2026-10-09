// SPDX-License-Identifier: Apache-2.0
import { useQuery } from "@tanstack/react-query";
import { API_BASE } from "../lib/api";

/**
 * The public URL shape, served as two maps the whole client speaks:
 *
 * - `bySlug` — a URL slug → its vault path. NoteView resolves the address through it.
 * - `byPath` — the inverse. Every component that LINKS somewhere (the file tree, backlinks,
 *   the graph, rendered wikilinks) translates vault paths through it, so nothing in the
 *   client ever puts a vault path in a public URL.
 */
export interface SlugMap {
	bySlug: Record<string, string>;
	byPath: Record<string, string>;
}

export function useSlugMap() {
	return useQuery<SlugMap>({
		queryKey: ["slug-map"],
		queryFn: async () => {
			const res = await fetch(`${API_BASE}/api/files/slug-map`);
			if (!res.ok) throw new Error("Failed to fetch slug map");
			return res.json();
		},
		staleTime: Infinity,
	});
}

/** The slug at a location pathname — the site root is the overview's slug. */
export function slugFromPathname(pathname: string): string {
	const trimmed = decodeURIComponent(pathname).replace(/\/+$/, "");
	return trimmed === "" ? "overview" : trimmed.replace(/^\//, "");
}