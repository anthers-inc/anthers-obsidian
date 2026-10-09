// SPDX-License-Identifier: Apache-2.0
/**
 * Rebuild — the single place that re-indexes the vault after its files change.
 *
 * The deployment reads a synced copy: files arrive, change and are deleted underneath the
 * running server, and every index it serves (tree cache, parsed notes, resolve map, search
 * index, graph) must follow. Rather than each service learning about file events, they expose
 * their builders and this module sequenced them — exactly the invalidation shape the original
 * architecture planned for, kept out of the routes so a change event costs one rebuild path,
 * not one per feature.
 *
 * The debounce exists because sync delivers a change as a burst (a note edit is a write plus
 * metadata jitter; a move is delete-then-create), and rebuilding per event would parse the
 * vault a dozen times for one user action. Events inside the window collapse into one rebuild.
 */
import { watch, type FSWatcher } from "node:fs";
import { invalidateTreeCache } from "./services/vault.js";
import { parseAllNotes, buildFullResolveMap } from "./services/parser.js";
import { buildSearchIndex } from "./services/search.js";
import { buildGraph } from "./services/graph.js";
import { setResolveMap, setParsedNotes, setSlugMapFromVault } from "./routes/files.js";

const DEBOUNCE_MS = 500;

let rebuilding = false;
let queued = false;
let watcher: FSWatcher | null = null;

export async function rebuildAll(): Promise<void> {
	if (rebuilding) {
		queued = true;
		return;
	}
	rebuilding = true;
	try {
		const notes = await parseAllNotes();
		const resolveMap = await buildFullResolveMap(notes);
		setResolveMap(resolveMap);
		setParsedNotes(notes);
		buildSearchIndex(notes);
		buildGraph(notes, resolveMap);
		await setSlugMapFromVault();
	} finally {
		rebuilding = false;
	}
	// A change landing mid-rebuild queued exactly one more pass — run it rather than dropping it.
	if (queued) {
		queued = false;
		await rebuildAll();
	}
}

/** The startup build — what index.ts runs before serving, with the timing logs it has always printed. */
export async function initialBuild(): Promise<void> {
	console.time("Startup");
	invalidateTreeCache();
	await rebuildAll();
	console.timeEnd("Startup");
}

/**
 * Watch the vault for changes and rebuild on settle.
 * The watcher is recursive (Bun's fs.watch supports recursion on all platforms it runs on).
 * Start and stop are idempotent so tests can drive them.
 */
export function startWatching(): void {
	if (watcher) return;
	const vaultPath = process.env.VAULT_PATH ?? "./vault";
	let timer: ReturnType<typeof setTimeout> | null = null;
	watcher = watch(vaultPath, { recursive: true }, (eventType, filename) => {
		if (filename === null) {
			schedule();
			return;
		}
		schedule();
	});

	function schedule() {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = null;
			void rebuildAll().catch((err) => console.error("Rebuild failed:", err));
		}, DEBOUNCE_MS);
	}
}

export function stopWatching(): void {
	if (watcher) {
		watcher.close();
		watcher = null;
	}
}