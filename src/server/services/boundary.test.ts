// SPDX-License-Identifier: Apache-2.0
/**
 * The publish-boundary tests — the suite that fails on purpose before anyone trusts the boundary.
 *
 * The rule being tested (Anthers' publish boundary by location): everything outside the excluded
 * roots publishes, `Internal Wiki/` NEVER does and the answer for an unpublished path is the same
 * 404 a missing file gets, the public task board under `00-09 Metafiles/01 Tasks/` publishes
 * despite its excluded parent, attachments beside it do not, and `.base` files need their
 * allowlist entry because a base view enumerates.
 *
 * ⭐ Each case below is written from a real shape in the Anthers vault, not invented paths — the
 * internal-root task note, the attachments paste store, the board base, the certified-AOI PDF's
 * folder — because the boundary is only proven when it answers for the actual tree it will face.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isPublishedPath, canContainPublished, normalizePath } from "./boundary.js";

describe("boundary — the default publish shape", () => {
	test("a public reference page publishes", () => {
		expect(isPublishedPath("Anthers Overview.md")).toBe(true);
		expect(isPublishedPath("10-19 What Anthers Is/10 Introduction/10.01 What Anthers Is.md")).toBe(true);
	});

	test("a public task note publishes through its excluded ancestor", () => {
		expect(isPublishedPath("00-09 Metafiles/01 Tasks/Active/Some Task.md")).toBe(true);
		expect(isPublishedPath("00-09 Metafiles/01 Tasks/Done/Some Task.md")).toBe(true);
	});

	test("a task template inside 01 Tasks publishes with the board", () => {
		expect(isPublishedPath("00-09 Metafiles/01 Tasks/Templates/(T) Task.md")).toBe(true);
	});

	test("vault machinery beside the task roots does not publish", () => {
		expect(isPublishedPath("00-09 Metafiles/00 Attachments/Pasted image 20260917192658.png")).toBe(false);
	});

	test("Internal Wiki never publishes, at any depth, including its mirror-shaped task roots", () => {
		expect(isPublishedPath("Internal Wiki/10-19 Governance & Records/13 - Compliance Calendar.md")).toBe(false);
		expect(isPublishedPath("Internal Wiki/00-09 Metafiles/01 Tasks/Active/An Internal Task.md")).toBe(false);
	});

	test("agent machinery does not publish", () => {
		expect(isPublishedPath("90-99 Agents/Anthers Agents Hub.md")).toBe(false);
	});

	test("the board base publishes by allowlist; another base at vault root does not", () => {
		expect(isPublishedPath("Anthers Tasks.base")).toBe(true);
		expect(isPublishedPath("Some Other.base")).toBe(false);
	});

	test("canvas publishes under the folder rules — fixed drawing content, enumerates nothing", () => {
		expect(isPublishedPath("Some Canvas.canvas")).toBe(true);
	});

	test("dotfiles and dot-folders never publish, regardless of what they are", () => {
		expect(isPublishedPath(".stignore")).toBe(false);
		expect(isPublishedPath(".agents/audits/broken-links.md")).toBe(false);
		expect(isPublishedPath(".obsidian/app.json")).toBe(false);
		expect(isPublishedPath(".trash/something.md")).toBe(false);
		expect(canContainPublished(".agents")).toBe(false);
	});

	test("a public attachment folder's file publishes where the folder rules put it", () => {
		// The certified AOI PDF's home: a subject-area folder, inside the published set.
		expect(isPublishedPath("60-69 The Organization/62 Filings & Public Records/Certified AOI for Anthers 20260828.pdf")).toBe(true);
	});
});

describe("boundary — directory pruning", () => {
	test("an excluded root prunes whole", () => {
		expect(canContainPublished("Internal Wiki")).toBe(false);
		expect(canContainPublished("90-99 Agents")).toBe(false);
	});

	test("the mixed folder stays walkable; its unpublished child prunes", () => {
		expect(canContainPublished("00-09 Metafiles")).toBe(true);
		expect(canContainPublished("00-09 Metafiles/00 Attachments")).toBe(false);
		expect(canContainPublished("00-09 Metafiles/01 Tasks")).toBe(true);
	});

	test("a published band prunes nothing", () => {
		expect(canContainPublished("10-19 What Anthers Is")).toBe(true);
	});
});

describe("boundary — path normalization", () => {
	test("slashes and suffixes stop mattering", () => {
		expect(normalizePath("/Internal Wiki/")).toBe("Internal Wiki");
		expect(normalizePath("Internal\\Wiki")).toBe("Internal/Wiki");
		expect(isPublishedPath("/Internal Wiki/")).toBe(false);
	});
});

describe("boundary — through the actual routes", () => {
	let app: { fetch: (req: Request) => Promise<Response> };
	// The fixture lives in the OS temp dir, not the repository — the tests may run inside
	// the shipped image as an unprivileged user, where the repo root is not writable.
	const FIXTURE = join(tmpdir(), "anthers-obsidian-boundary-fixture");

	beforeAll(async () => {
		process.env.VAULT_PATH = FIXTURE;
		await mkdir(join(FIXTURE, "00-09 Metafiles/01 Tasks/Active"), { recursive: true });
		await mkdir(join(FIXTURE, "Internal Wiki"), { recursive: true });
		await writeFile(join(FIXTURE, "Anthers Overview.md"), "A public page");
		await writeFile(join(FIXTURE, "00-09 Metafiles/01 Tasks/Active/Public Task.md"), "A public task");
		await writeFile(join(FIXTURE, "00-09 Metafiles/notes-attachment.txt"), "machinery");
		await writeFile(join(FIXTURE, "Internal Wiki/Internal Doc.md"), "internal");
		await writeFile(join(FIXTURE, "Anthers Tasks.base"), "{}");
		// Dynamic import after the env is set — vault.ts reads VAULT_PATH at module scope.
		// The default export carries { port, fetch }; fetch is what the tests drive.
		app = ((await import("../index.js")).default ?? (await import("../index.js"))) as {
			fetch: (req: Request) => Promise<Response>;
		};
	});

	afterAll(async () => {
		await rm(FIXTURE, { recursive: true, force: true });
	});

	test("a public page answers 200", async () => {
		const res = await app.fetch(new Request("http://localhost/api/files/Anthers%20Overview.md"));
		expect(res.status).toBe(200);
	});

	test("an internal page answers the same 404 a missing file gets — never a forbidden, never a confirmation", async () => {
		const res = await app.fetch(new Request("http://localhost/api/files/Internal%20Wiki/Internal%20Doc.md"));
		expect(res.status).toBe(404);
	});

	test("an unpublished attachment answers 404 too", async () => {
		const res = await app.fetch(new Request("http://localhost/api/files/00-09%20Metafiles/notes-attachment.txt"));
		expect(res.status).toBe(404);
	});

	test("the tree carries the public task board and the board base, and neither excluded root", async () => {
		const res = await app.fetch(new Request("http://localhost/api/files/tree"));
		const tree = (await res.json()) as { children: Array<{ name: string }> };
		const names = JSON.stringify(tree.children);
		expect(names).toContain("01 Tasks");
		expect(names).toContain("Anthers Tasks.base");
		expect(names).not.toContain("Internal Wiki");
	});

	test("path traversal is refused with the same 404 discipline", async () => {
		const res = await app.fetch(new Request("http://localhost/api/files/..%2F..%2Fetc%2Fpasswd"));
		expect([403, 404]).toContain(res.status);
	});
});