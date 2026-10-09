// SPDX-License-Identifier: Apache-2.0
import { Hono } from "hono";
import {
	getTree,
	getMarkdownContent,
	getBinaryFile,
	getStructuredContent,
	resolveVaultPath,
	listPublishedFiles,
	isMarkdown,
	isStructured,
} from "../services/vault.js";
import type { ResolveMap, ParsedNote } from "../services/parser.js";
import type { SlugMap } from "../services/slugs.js";
import { evaluateBase } from "../services/base-evaluator.js";

let resolveMap: ResolveMap = {};
let parsedNotes: ParsedNote[] = [];
let slugMap: SlugMap = { bySlug: {}, byPath: {} };

export function setResolveMap(map: ResolveMap) {
	resolveMap = map;
}

export function setParsedNotes(notes: ParsedNote[]) {
	parsedNotes = notes;
}

export async function setSlugMapFromVault() {
	// The slug map comes from the publishable file list (markdown + structured), not the
	// parsed notes — a .base or .canvas publishes a slug too.
	const paths = await listPublishedFiles();
	const { buildSlugMap } = await import("../services/slugs.js");
	slugMap = buildSlugMap(paths);
}

export function getSlugMap(): SlugMap {
	return slugMap;
}

export const filesRoute = new Hono()
	.get("/tree", async (c) => {
		const tree = await getTree();
		return c.json(tree);
	})
	.get("/resolve-map", (c) => {
		return c.json(resolveMap);
	})
	.get("/slug-map", (c) => {
		return c.json(slugMap);
	})
	.get("/*", async (c) => {
		const relativePath = c.req.path.replace(/^\/api\/files\//, "");
		const decoded = decodeURIComponent(relativePath);

		if (!decoded) {
			return c.json({ error: "No file path provided" }, 400);
		}

		try {
			// Validate the path doesn't escape the vault
			resolveVaultPath(decoded);

			if (isMarkdown(decoded)) {
				const content = await getMarkdownContent(decoded);
				return c.json(content);
			} else if (isStructured(decoded)) {
				const { path, raw, modified } = await getStructuredContent(decoded);

				if (decoded.endsWith(".canvas")) {
					const canvas = JSON.parse(raw);
					return c.json({ path, type: "canvas", data: canvas, modified });
				} else if (decoded.endsWith(".base")) {
					const baseData = evaluateBase(raw, path, parsedNotes);
					return c.json({ path, type: "base", data: baseData, modified });
				}

				return c.json({ path, type: "unknown", raw, modified });
			} else {
				const { data, mimeType } = await getBinaryFile(decoded);
				return new Response(data, {
					headers: { "Content-Type": mimeType },
				});
			}
		} catch (err: any) {
			if (err.message === "Path traversal detected") {
				return c.json({ error: "Invalid path" }, 403);
			}
			if (err.code === "ENOENT") {
				return c.json({ error: "File not found" }, 404);
			}
			throw err;
		}
	});
