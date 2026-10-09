// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "bun:test";
import { hrefForPath } from "./links";
import type { SlugMap } from "../hooks/useSlugMap";

const map: SlugMap = {
	bySlug: {
		"tasks/active/serialize-heavy-verification-runs": "00-09 Metafiles/01 Tasks/Active/Serialize heavy verification runs.md",
		overview: "Anthers Overview.md",
	},
	byPath: {
		"00-09 Metafiles/01 Tasks/Active/Serialize heavy verification runs.md":
			"tasks/active/serialize-heavy-verification-runs",
		"Anthers Overview.md": "overview",
	},
};

describe("hrefForPath — every navigator's one path-in, URL-out", () => {
	it("maps a full vault path with extension to its slug URL", () => {
		expect(hrefForPath(map, "00-09 Metafiles/01 Tasks/Active/Serialize heavy verification runs.md")).toBe(
			"/tasks/active/serialize-heavy-verification-runs",
		);
	});

	it("maps a bare path without extension too — canvas JSON's shape", () => {
		expect(hrefForPath(map, "00-09 Metafiles/01 Tasks/Active/Serialize heavy verification runs")).toBe(
			"/tasks/active/serialize-heavy-verification-runs",
		);
	});

	it("returns null for a path the map does not know — it never published", () => {
		expect(hrefForPath(map, "00-09 Metafiles/01 Tasks/Active/Never published.md")).toBeNull();
	});

	it("returns null when the map has not loaded yet", () => {
		expect(hrefForPath(undefined, "Anthers Overview.md")).toBeNull();
		expect(hrefForPath(map, undefined)).toBeNull();
	});
});