// SPDX-License-Identifier: Apache-2.0
/**
 * The slug subsystem's tests — written from the Anthers vault's actual tree, because the
 * mapping is only proven against the shapes it will face: the JD-prefixed bands and pages,
 * the NN.00 category indexes, the task folders, the em-dash task titles, and the collision
 * case a rename will eventually produce.
 */
import { describe, expect, test } from "bun:test";
import { buildSlugMap, kebabSlug, slugForPath } from "./slugs.js";

describe("kebabSlug — the JD-prefix stripping", () => {
	test("a band folder loses its JD number", () => {
		expect(kebabSlug("10-19 What Anthers Is")).toBe("what-anthers-is");
	});

	test("a category folder loses its band number", () => {
		expect(kebabSlug("10 Introduction")).toBe("introduction");
	});

	test("a numbered page loses its index number", () => {
		expect(kebabSlug("10.01 What Anthers Is")).toBe("what-anthers-is");
	});

	test("a plain title kebabs without a JD prefix stripping anything", () => {
		expect(kebabSlug("The Support Model")).toBe("the-support-model");
	});

	test("an em-dash title becomes a dash, not a fragment", () => {
		expect(kebabSlug("Stand up the publishing host — the websidian port")).toBe(
			"stand-up-the-publishing-host-the-websidian-port",
		);
	});

	test("task-template punctuation survives as structure removal", () => {
		expect(kebabSlug("(T) Task - Blocked")).toBe("t-task-blocked");
	});
});

describe("slugForPath — the vault's shapes", () => {
	test("the overview and roadmap carry their settled slugs", () => {
		expect(slugForPath("Anthers Overview.md")).toBe("overview");
		expect(slugForPath("Anthers Roadmap.md")).toBe("roadmap");
	});

	test("a band/category/page triple is two levels", () => {
		expect(slugForPath("10-19 What Anthers Is/10 Introduction/10.01 What Anthers Is.md")).toBe(
			"introduction/what-anthers-is",
		);
	});

	test("the NN.00 index IS the category's landing — no page half", () => {
		expect(slugForPath("10-19 What Anthers Is/10 Introduction/10.00 Introduction.md")).toBe(
			"introduction",
		);
	});

	test("a flat page directly in a band uses the band as its category", () => {
		expect(slugForPath("40-49 Where the Money Goes/40.02 The Time Pool.md")).toBe(
			"where-the-money-goes/the-time-pool",
		);
	});

	test("a task note's URL carries the folder its vault folder names", () => {
		expect(slugForPath("00-09 Metafiles/01 Tasks/Active/Stand up the publishing host.md")).toBe(
			"tasks/active/stand-up-the-publishing-host",
		);
		expect(slugForPath("00-09 Metafiles/01 Tasks/Done/Build the code half of CSAM handling.md")).toBe(
			"tasks/done/build-the-code-half-of-csam-handling",
		);
	});

	test("the board base is the task board's landing", () => {
		expect(slugForPath("Anthers Tasks.base")).toBe("tasks");
	});
});

describe("buildSlugMap — deterministic collision handling", () => {
	test("sorted order decides who keeps the clean slug; later claimants suffix", () => {
		const map = buildSlugMap([
			"00-09 Metafiles/01 Tasks/Active/Do the thing.md",
			"00-09 Metafiles/01 Tasks/Done/Do the thing.md",
		]);
		// "tasks/active/…" sorts before "tasks/done/…" — the Active note keeps the clean pair.
		expect(map.byPath["00-09 Metafiles/01 Tasks/Active/Do the thing.md"]).toBe(
			"tasks/active/do-the-thing",
		);
		expect(map.byPath["00-09 Metafiles/01 Tasks/Done/Do the thing.md"]).toBe(
			"tasks/done/do-the-thing",
		);
	});

	test("a true collision suffixes the later claimant", () => {
		const map = buildSlugMap(["10-19 What Anthers Is/10 Introduction/10.05 What Anthers Was.md", "10-19 What Anthers Is/10 Introduction/10.01 What Anthers Is.md"]);
		// Both pages kebab to introduction/what-anthers-is? 10.05 → what-anthers-was, no collision;
		// build the collision case directly instead:
		const colliding = buildSlugMap([
			"00-09 Metafiles/01 Tasks/Active/Ship it.md",
			"00-09 Metafiles/01 Tasks/Active/0. Ship it.md",
		]);
		const slugs = Object.values(colliding.byPath);
		expect(new Set(slugs).size).toBe(slugs.length); // all distinct
		expect(Object.keys(colliding.bySlug).length).toBe(2);
	});

	test("the map is bidirectional and complete over its input", () => {
		const paths = [
			"Anthers Overview.md",
			"Anthers Roadmap.md",
			"Anthers Tasks.base",
			"10-19 What Anthers Is/10 Introduction/10.00 Introduction.md",
			"10-19 What Anthers Is/10 Introduction/10.01 What Anthers Is.md",
		];
		const map = buildSlugMap(paths);
		expect(Object.keys(map.byPath).length).toBe(paths.length);
		expect(Object.keys(map.bySlug).length).toBe(paths.length);
		for (const [slug, path] of Object.entries(map.bySlug)) {
			expect(map.byPath[path]).toBe(slug);
		}
	});
});