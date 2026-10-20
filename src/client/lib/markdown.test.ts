// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from "bun:test";
import { createMarkdownRenderer } from "./markdown";

const render = (source: string) => createMarkdownRenderer({}).render(source);

describe("headings carry the id a fragment lands on", () => {
  it("gives a plain heading its slug", () => {
    expect(render("## Notifications")).toContain('<h2 id="notifications">');
  });

  it("matches the scheme on punctuation", () => {
    expect(render("## Observability, Alerting & Rate Limiting")).toContain(
      'id="observability-alerting--rate-limiting"',
    );
  });

  it("slugs the words a reader sees rather than the markdown", () => {
    expect(render("## **Bold** title")).toContain('id="bold-title"');
  });

  it("suffixes a repeated heading so each section keeps its own anchor", () => {
    const html = render("## Same\n\n## Same");
    expect(html).toContain('id="same"');
    expect(html).toContain('id="same-1"');
  });

  it("gives no id to a heading with nothing sluggable in it", () => {
    expect(render("## ✨")).not.toContain("<h2 id=");
  });
});

describe("a wikilink's section becomes the heading's anchor", () => {
  const md = createMarkdownRenderer({ page: ["Page.md"] }, { "Page.md": "page" });

  it("links to the slug plus the slugified section, not an encoded hash in the path", () => {
    expect(md.render("[[Page#Some Section]]")).toContain('href="/page#some-section"');
  });

  it("still renders a whole-page link with no fragment", () => {
    expect(md.render("[[Page]]")).toContain('href="/page"');
  });
});
