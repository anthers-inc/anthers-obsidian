// SPDX-License-Identifier: Apache-2.0
import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";
import obsidianCallouts from "markdown-it-obsidian-callouts";
// @ts-ignore
import taskLists from "@hackmd/markdown-it-task-lists";
import footnote from "markdown-it-footnote";
// @ts-ignore
import mathjax3 from "markdown-it-mathjax3";
import { wikilinkPlugin, embedPlugin } from "./markdown-plugins";

export type ResolveMap = Record<string, string[]>;

/**
 * Create a configured markdown-it instance with all Obsidian plugins.
 * `slugByPath` translates every resolved link's vault path into its public URL slug;
 * without it (or without an entry), links render inert rather than dead.
 */
export function createMarkdownRenderer(resolveMap: ResolveMap, slugByPath?: Record<string, string>): MarkdownIt {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
  });

  // Custom wikilink and embed plugins (resolve [[links]] and ![[embeds]])
  wikilinkPlugin(md, resolveMap, slugByPath);
  embedPlugin(md, resolveMap);

  // Callouts: > [!note] → styled callout blocks
  md.use(obsidianCallouts);

  // Task lists: - [ ] and - [x]
  md.use(taskLists, { enabled: false, label: true });

  // Footnotes: [^1]
  md.use(footnote);

  // Math: $...$ and $$...$$
  md.use(mathjax3);

  return md;
}

/**
 * Render markdown to sanitized HTML.
 */
export function renderMarkdown(md: MarkdownIt, content: string): string {
  const raw = md.render(content);
  return DOMPurify.sanitize(raw, {
    ADD_TAGS: ["mjx-container", "mjx-assistive-mml"],
    // `style` is allowed so the vault's generated HTML blocks (the roadmap's state bars
    // and the econ figure tables) render as they were generated — the content is
    // publisher-authored, never visitor input, and DOMPurify still sanitizes the CSS.
    ADD_ATTR: ["class", "data-embed", "data-callout", "data-callout-fold", "style", "colspan"],
  });
}
