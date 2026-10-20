// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "bun:test";
import { slugifyHeading } from "./heading-slug";

describe("slugifyHeading — the anchor a heading answers to", () => {
  it("lowercases and hyphenates a plain heading", () => {
    expect(slugifyHeading("Production Deployment")).toBe("production-deployment");
  });

  it("drops punctuation before mapping spaces, so an ampersand leaves a double hyphen", () => {
    expect(slugifyHeading("Creator Badges & the Badge Maker")).toBe(
      "creator-badges--the-badge-maker",
    );
    expect(slugifyHeading("Observability, Alerting & Rate Limiting")).toBe(
      "observability-alerting--rate-limiting",
    );
  });

  it("keeps diacritics, the underscore and the hyphen it is allowed", () => {
    expect(slugifyHeading("Café & Crème")).toBe("café--crème");
    expect(slugifyHeading("snake_case and-kebab")).toBe("snake_case-and-kebab");
  });

  it("trims what would leave a hanging hyphen", () => {
    expect(slugifyHeading("  The Library, Lenses & the Queue  ")).toBe(
      "the-library-lenses--the-queue",
    );
  });
});
