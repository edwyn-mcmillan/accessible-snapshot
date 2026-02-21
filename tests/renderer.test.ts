import { describe, it, expect } from "vitest";
import { renderSnapshot } from "../src/renderer.js";
import type { PageSnapshot } from "../src/types.js";

function makeSnapshot(overrides: Partial<PageSnapshot> = {}): PageSnapshot {
  return {
    url: "https://example.com",
    title: "Test Page",
    lang: "en",
    landmarks: [],
    headings: [],
    navLinks: [],
    contentGroups: [],
    forms: [],
    buttons: [],
    links: [],
    ...overrides,
  };
}

describe("renderSnapshot", () => {
  describe("nav links", () => {
    it("renders nav links inside a collapsible <details> wrapping <nav>", () => {
      const snapshot = makeSnapshot({
        navLinks: [
          { text: "Home", href: "/", isCurrent: true },
          { text: "About", href: "/about", isCurrent: false },
        ],
      });

      const { html } = renderSnapshot(snapshot);

      expect(html).toContain("<details>");
      expect(html).toContain('<nav role="navigation"');
      expect(html).toContain('<a href="/"');
      expect(html).toContain('aria-current="page"');
      expect(html).toContain("Home");
      expect(html).toContain('<a href="/about"');
      expect(html).toContain("About");
    });

    it("does not render nav section when navLinks is empty", () => {
      const { html } = renderSnapshot(makeSnapshot({ navLinks: [] }));

      expect(html).not.toContain('<nav role="navigation"');
    });
  });

  describe("content groups", () => {
    it("renders a non-collapsed group with heading as <section class=\"content-group\">", () => {
      const snapshot = makeSnapshot({
        contentGroups: [
          {
            heading: { text: "Introduction", level: 2 },
            blocks: [{ type: "paragraph", text: "Hello world." }],
            score: 10,
            collapsed: false,
          },
        ],
      });

      const { html } = renderSnapshot(snapshot);

      expect(html).toContain('<section class="content-group">');
      expect(html).toContain("Introduction");
      expect(html).toContain('<p tabindex="0">Hello world.</p>');
    });

    it("renders a collapsed group with heading as <details class=\"content-group collapsed\">", () => {
      const snapshot = makeSnapshot({
        contentGroups: [
          {
            heading: { text: "Side Content", level: 2 },
            blocks: [{ type: "paragraph", text: "Less important text." }],
            score: 2,
            collapsed: true,
          },
        ],
      });

      const { html } = renderSnapshot(snapshot);

      expect(html).toContain('<details class="content-group collapsed">');
      expect(html).toContain("<summary>Side Content</summary>");
      expect(html).toContain("Less important text.");
    });

    it("omits a collapsed group that has no heading", () => {
      const snapshot = makeSnapshot({
        contentGroups: [
          {
            heading: undefined,
            blocks: [{ type: "paragraph", text: "Hidden text." }],
            score: 1,
            collapsed: true,
          },
        ],
      });

      const { html } = renderSnapshot(snapshot);

      expect(html).not.toContain("Hidden text.");
    });
  });

  describe("HTML escaping", () => {
    it("escapes < and > in the page title", () => {
      const snapshot = makeSnapshot({ title: "<script>alert(1)</script>" });

      const { html } = renderSnapshot(snapshot);

      expect(html).not.toContain("<script>alert(1)</script>");
      expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    });

    it("escapes & in the page title", () => {
      const snapshot = makeSnapshot({ title: "Cats & Dogs" });

      const { html } = renderSnapshot(snapshot);

      expect(html).toContain("Cats &amp; Dogs");
      expect(html).not.toContain("Cats & Dogs");
    });
  });

  describe("search form", () => {
    it("renders a search form when search is present", () => {
      const snapshot = makeSnapshot({
        search: { action: "https://example.com/search", paramName: "q" },
      });

      const { html } = renderSnapshot(snapshot);

      expect(html).toContain('action="https://example.com/search"');
      expect(html).toContain('name="q"');
      expect(html).toContain('role="search"');
    });

    it("does not render a search form when search is absent", () => {
      const { html } = renderSnapshot(makeSnapshot());

      expect(html).not.toContain('role="search"');
    });
  });

  describe("footer links", () => {
    it("renders footer links in a separate Footer Links section", () => {
      const snapshot = makeSnapshot({
        links: [
          { text: "Main Link", href: "/main", isFooter: false },
          { text: "Privacy Policy", href: "/privacy", isFooter: true },
          { text: "Terms", href: "/terms", isFooter: true },
        ],
      });

      const { html } = renderSnapshot(snapshot);

      expect(html).toContain("Footer Links");
      expect(html).toContain('<a href="/privacy">Privacy Policy</a>');
      expect(html).toContain('<a href="/terms">Terms</a>');
    });

    it("renders non-footer links outside the Footer Links section", () => {
      const snapshot = makeSnapshot({
        links: [
          { text: "Main Link", href: "/main", isFooter: false },
          { text: "Privacy Policy", href: "/privacy", isFooter: true },
        ],
      });

      const { bodyHtml } = renderSnapshot(snapshot);

      const footerIdx = bodyHtml.indexOf("Footer Links");
      const mainLinkIdx = bodyHtml.indexOf('<a href="/main">Main Link</a>');

      expect(mainLinkIdx).toBeGreaterThan(-1);
      expect(mainLinkIdx).toBeLessThan(footerIdx);
    });

    it("does not render Footer Links section when no footer links exist", () => {
      const snapshot = makeSnapshot({
        links: [{ text: "Main Link", href: "/main" }],
      });

      const { html } = renderSnapshot(snapshot);

      expect(html).not.toContain("Footer Links");
    });
  });
});

describe("table rendering", () => {
  it("renders a table block with headers and rows", () => {
    const snapshot = makeSnapshot({
      contentGroups: [
        {
          heading: { text: "Data", level: 2 },
          blocks: [{
            type: "table",
            text: "Table: Name, Age",
            headers: ["Name", "Age"],
            rows: [["Alice", "30"], ["Bob", "25"]],
          }],
          score: 10,
          collapsed: false,
        },
      ],
    });
    const { bodyHtml } = renderSnapshot(snapshot);
    expect(bodyHtml).toContain('<table tabindex="0">');
    expect(bodyHtml).toContain("<th>Name</th>");
    expect(bodyHtml).toContain("<th>Age</th>");
    expect(bodyHtml).toContain("<td>Alice</td>");
    expect(bodyHtml).toContain("<td>Bob</td>");
  });

  it("renders a table without headers", () => {
    const snapshot = makeSnapshot({
      contentGroups: [
        {
          blocks: [{
            type: "table",
            text: "Table with 2 rows",
            rows: [["X data here", "Y data here"]],
          }],
          score: 10,
          collapsed: false,
        },
      ],
    });
    const { bodyHtml } = renderSnapshot(snapshot);
    expect(bodyHtml).toContain('<table tabindex="0">');
    expect(bodyHtml).not.toContain("<thead>");
    expect(bodyHtml).toContain("<td>X data here</td>");
  });
});

describe("definition-list rendering", () => {
  it("renders a definition-list block as dl/dt/dd", () => {
    const snapshot = makeSnapshot({
      contentGroups: [
        {
          blocks: [{
            type: "definition-list",
            text: "HTML: Markup Language; CSS: Style Sheets",
            definitions: [
              { term: "HTML", description: "Markup Language" },
              { term: "CSS", description: "Style Sheets" },
            ],
          }],
          score: 10,
          collapsed: false,
        },
      ],
    });
    const { bodyHtml } = renderSnapshot(snapshot);
    expect(bodyHtml).toContain("<dl>");
    expect(bodyHtml).toContain("<dt>HTML</dt>");
    expect(bodyHtml).toContain("<dd>Markup Language</dd>");
    expect(bodyHtml).toContain("<dt>CSS</dt>");
    expect(bodyHtml).toContain("<dd>Style Sheets</dd>");
  });
});
