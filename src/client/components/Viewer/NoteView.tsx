// SPDX-License-Identifier: Apache-2.0
import { useLocation } from "react-router-dom";
import { useNoteContent } from "../../hooks/useNoteContent";
import { useResolveMap } from "../../hooks/useResolveMap";
import { useSlugMap, slugFromPathname } from "../../hooks/useSlugMap";
import MarkdownRenderer from "./MarkdownRenderer";
import CanvasView from "./CanvasView";
import BaseView from "./BaseView";
import Breadcrumb from "./Breadcrumb";
import Backlinks from "./Backlinks";

function getFileType(path: string): "markdown" | "canvas" | "base" | "other" {
	if (path.endsWith(".canvas")) return "canvas";
	if (path.endsWith(".base")) return "base";
	if (path.endsWith(".md")) return "markdown";
	return "other";
}

/** Display title: the vault filename minus its extension and Johnny.Decimal prefix. */
function displayTitle(path: string): string {
	const name = path.split("/").pop() ?? "";
	return name
		.replace(/\.(md|base|canvas)$/, "")
		.replace(/^\d{2}(?:-\d{2}|\.\d{2})?(?:\s-\s|\s+)/, "");
}

/** The frontmatter properties a published task note shows the reader. */
const SHOWN_PROPERTIES: Record<string, string> = {
	"task-status": "Status",
	"task-priority": "Priority",
	"task-assignee": "Assignee",
	"task-lane": "Lane",
};

export default function NoteView() {
	const location = useLocation();
	const { data: slugMap, isSuccess: slugMapLoaded } = useSlugMap();

	// The address is a slug (the site root is the overview); the slug map turns it into
	// the vault path everything else — fetch, breadcrumb, backlinks, tree highlight — speaks.
	const slug = slugFromPathname(location.pathname);
	const notePath = slugMap?.bySlug[slug];

	const { data: note, isLoading, error } = useNoteContent(notePath);
	const { data: resolveMap } = useResolveMap();

	if (!slugMapLoaded || (notePath && isLoading)) {
		return (
			<div className="note-loading">
				<div className="loading-skeleton" />
				<div className="loading-skeleton loading-skeleton-short" />
				<div className="loading-skeleton" />
			</div>
		);
	}

	if (slugMapLoaded && !notePath) {
		return (
			<div className="note-error">
				<h2>Not published</h2>
				<p>This address is not part of the published wiki.</p>
			</div>
		);
	}

	if (error || !note || !notePath) {
		return (
			<div className="note-error">
				<h2>Failed to load note</h2>
				<p>{notePath}</p>
			</div>
		);
	}

	const fileType = getFileType(notePath);
	const title = displayTitle(notePath);

	const properties = note.path.endsWith(".md")
		? Object.entries((note as any).frontmatter ?? {}).filter(([key]) => SHOWN_PROPERTIES[key])
		: [];

	const propsRow = properties.length > 0 && (
		<section className="note-properties">
			{properties.map(([key, value]) => (
				<div key={key} className="note-property">
					<span className="note-property-name">{SHOWN_PROPERTIES[key]}</span>
					<span className="note-property-value">
						{Array.isArray(value) ? value.join(", ") : String(value)}
					</span>
				</div>
			))}
		</section>
	);

	if (fileType === "canvas") {
		return (
			<article className="note-view note-view-canvas">
				<Breadcrumb path={notePath} />
				<h1 className="note-title">{title}</h1>
				<CanvasView
					data={(note as any).data ?? {}}
					resolveMap={resolveMap ?? {}}
				/>
			</article>
		);
	}

	if (fileType === "base") {
		return (
			<article className="note-view note-view-base">
				<Breadcrumb path={notePath} />
				<h1 className="note-title">{title}</h1>
				<BaseView data={(note as any).data ?? { views: [] }} />
			</article>
		);
	}

	// Default: markdown
	return (
		<article className="note-view">
			<Breadcrumb path={notePath} />
			<h1 className="note-title">{title}</h1>
			{propsRow}
			<div className="note-content">
				<MarkdownRenderer
					content={(note as any).content ?? ""}
					resolveMap={resolveMap ?? {}}
					slugByPath={slugMap?.byPath ?? {}}
				/>
			</div>
			<footer className="license-line">
				This page is part of the Anthers wiki, licensed <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a> — quoted material and images belonging to somebody else are not covered, and the Anthers name and logo are not licensed at all.
			</footer>
			<Backlinks path={notePath} />
		</article>
	);
}