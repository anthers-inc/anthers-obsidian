// SPDX-License-Identifier: Apache-2.0
/**
 * The anchor a heading answers to.
 *
 * GitHub's scheme, because it is the one people already expect to type into a fragment:
 * lowercase; letters, numbers, `_` and `-` survive; every other punctuation mark is
 * dropped; each space becomes a hyphen. Dropping the punctuation before mapping the
 * spaces is what leaves an ampersand with a double hyphen — `Creator Badges & the Badge
 * Maker` answers to `creator-badges--the-badge-maker` — and that shape is deliberate
 * rather than untidy: a link and a heading have to agree, and one rule that is easy to
 * reproduce beats a prettier one nobody can guess.
 *
 * ⚠️ **`apps/web/src/lib/wiki.ts` in `~/Anthers/anthers` carries the same function as
 * `wikiAnchor`**, because the release notes link into the roadmap from the app. Change
 * the scheme here and change that function in the same breath.
 */
export function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}
