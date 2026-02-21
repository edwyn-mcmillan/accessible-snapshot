import { groupAndScoreContent } from "./grouper.js";
import type {
  ButtonSnapshot,
  ContentBlock,
  FormField,
  FormSnapshot,
  Heading,
  Landmark,
  LinkSnapshot,
  NavLink,
  PageSnapshot,
} from "./types.js";

export function isHidden(el: Element): boolean {
  if (el.hasAttribute("hidden")) return true;
  if (el.getAttribute("aria-hidden") === "true") return true;
  if (el.hasAttribute("inert")) return true;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return true;
  // Zero-dimension with overflow:hidden catches more hidden containers
  if (
    style.overflow === "hidden" &&
    el instanceof HTMLElement &&
    el.offsetWidth === 0 &&
    el.offsetHeight === 0
  ) {
    return true;
  }
  return false;
}

export function isVisible(el: Element): boolean {
  return !isHidden(el);
}

function isPresentational(el: Element): boolean {
  const role = el.getAttribute("role");
  return role === "presentation" || role === "none";
}

const NOISE_PATTERNS =
  /\b(cookie|consent|gdpr|ccpa|banner|modal|popup|overlay|dialog|social|share|sharing|ad-|ads-|advert|sponsor|sidebar|related|recommended|newsletter|subscribe|widget|toast|alert|toolbar|tooltip|promo|callout|announcement|notification|price|cart|basket|checkout|quantity|add-to|wishlist|product-card|shelf|buy-now|rating|review-count|stock|sku)\b/i;

export function isNoisyElement(el: Element): boolean {
  const id = el.id;
  const cls = el.className;
  const classStr = typeof cls === "string" ? cls : "";
  if (id && NOISE_PATTERNS.test(id)) return true;
  if (classStr && NOISE_PATTERNS.test(classStr)) return true;
  // Check data-* attributes against noise patterns
  const dataComponent = el.getAttribute("data-component");
  if (dataComponent && NOISE_PATTERNS.test(dataComponent)) return true;
  const dataTestid = el.getAttribute("data-testid");
  if (dataTestid && NOISE_PATTERNS.test(dataTestid)) return true;
  const dataType = el.getAttribute("data-type");
  if (dataType && NOISE_PATTERNS.test(dataType)) return true;
  return false;
}

const NOISE_CHROME_STRINGS = new Set([
  "add",
  "ea",
  "kg",
  "add to list",
  "add to cart",
  "see all",
  "view all",
  "shop now",
  "log in",
  "register",
  "book slot",
  "buy now",
  "remove",
  "save",
  "qty",
  "select unit type",
  "log in or register",
  "grab them while they last",
  "see more",
  "book your slot",
  "learn more",
  "read more",
  "find out more",
  "view more",
  "show more",
  "load more",
]);

const PRICE_PATTERN = /^\$?\d+[\.,]?\d*(%|\/\d*\w+)?$/;
const UNIT_PRICE_PATTERN = /^\$\d+\.\d{2}\/\w+$/;
const MEASUREMENT_PATTERN =
  /^\d+(\.\d+)?\s*(g|kg|mg|ml|l|pk|sheets|mm|cm|m|oz|lb)$/i;
const MULTI_UNIT_PATTERN = /^\d+\s*x\s*\d+\s*\w+$/i;
const LIMIT_PATTERN = /^Limit \d+/i;
const REVIEW_PATTERN = /^\d+(\.\d+)?\s+out of \d+\s+stars/i;
const PAGINATION_PATTERN = /^\d+\s*\/\s*\d+$/;
const PRICE_PER_UNIT_PATTERN = /^\$\d+\.\d+\s*\/\s*\d*\s*\w+$/;
const SLIDE_CONTROL_PATTERN = /^(Go to slide|Previous slide|Next slide)/i;

export function isNoiseText(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (PRICE_PATTERN.test(t)) return true;
  if (UNIT_PRICE_PATTERN.test(t)) return true;
  if (t.length <= 2) return true;
  if (NOISE_CHROME_STRINGS.has(t.toLowerCase())) return true;
  if (MEASUREMENT_PATTERN.test(t)) return true;
  if (MULTI_UNIT_PATTERN.test(t)) return true;
  if (LIMIT_PATTERN.test(t)) return true;
  if (REVIEW_PATTERN.test(t)) return true;
  if (PAGINATION_PATTERN.test(t)) return true;
  if (PRICE_PER_UNIT_PATTERN.test(t)) return true;
  return false;
}

const PROMOTIONAL_PATTERN =
  /^(grab|shop|buy|order|get|book|check out|discover|explore|browse|find|view|see|start|try|save|don't miss|hurry)\b/i;

const MARKETING_KEYWORDS = [
  "shop online",
  "your local store",
  "personal shoppers",
  "at your fingertips",
  "your door",
  "suits you",
  "start shopping",
  "online grocery",
  "fingertips",
  "straight to your",
  "pick your items",
  "download the app",
];

const CTA_ENDING_PATTERN = /\b(today|now|today!|now!)\.?!?$/i;

export function isPromotionalParagraph(text: string): boolean {
  const t = text.trim();
  const tLower = t.toLowerCase();
  const wordCount = t.split(/\s+/).length;
  // Short promotional calls-to-action (under 10 words, starts with action verb, ends with !)
  if (wordCount <= 10 && PROMOTIONAL_PATTERN.test(t)) return true;
  // Single word that's likely a category label echo
  if (wordCount === 1 && /^[A-Z]/.test(t)) return true;
  // Marketing copy: under 30 words with 2+ marketing keywords
  if (wordCount <= 30) {
    let keywordHits = 0;
    for (const kw of MARKETING_KEYWORDS) {
      if (tLower.includes(kw)) keywordHits++;
    }
    if (keywordHits >= 2) return true;
  }
  // CTA-ending paragraphs (under 30 words ending with "today.", "now.", etc.)
  if (wordCount <= 30 && CTA_ENDING_PATTERN.test(t)) return true;
  return false;
}

function getAccessibleName(el: Element): string {
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const parts = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean);
    if (parts.length) return parts.join(" ");
  }

  const ariaLabel = el.getAttribute("aria-label")?.trim();
  if (ariaLabel) return ariaLabel;

  if (el instanceof HTMLElement && "labels" in el) {
    const labels = (el as HTMLInputElement).labels;
    if (labels && labels.length) {
      return Array.from(labels)
        .map((l) => l.textContent?.trim())
        .filter(Boolean)
        .join(" ");
    }
  }

  const parentLabel = el.closest("label");
  if (parentLabel) {
    const text = parentLabel.textContent?.trim();
    if (text) return text;
  }

  const title = el.getAttribute("title")?.trim();
  if (title) return title;

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const placeholder = el.placeholder?.trim();
    if (placeholder) return placeholder;
  }

  return el.textContent?.trim() ?? "";
}

/**
 * Derive a human-readable label for a <form> without falling back to the
 * form's full textContent (which would include inline <style> and <script>).
 */
function getFormLabel(form: HTMLFormElement): string | undefined {
  const labelledBy = form.getAttribute("aria-labelledby");
  if (labelledBy) {
    const parts = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean);
    if (parts.length) return parts.join(" ");
  }

  const ariaLabel = form.getAttribute("aria-label")?.trim();
  if (ariaLabel) return ariaLabel;

  const title = form.getAttribute("title")?.trim();
  if (title) return title;

  // Use the first fieldset's legend text if available
  const legend = form.querySelector("fieldset > legend");
  if (legend) {
    const text = extractText(legend);
    if (text) return text;
  }

  return undefined;
}

const BLOCK_TAGS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "details",
  "dialog",
  "dd",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hgroup",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "ul",
  "tr",
  "td",
  "th",
]);

const SKIP_TAGS = new Set([
  "nav",
  "form",
  "script",
  "style",
  "link",
  "meta",
  "noscript",
  "svg",
  "dialog",
  "template",
  "canvas",
  "video",
  "audio",
  "aside",
  "header",
  "footer",
  "button",
]);

const MAX_DEPTH = 50;

/**
 * Resolve the best available image URL from an <img> element,
 * handling lazy-loaded images that use data-src, data-lazy-src, srcset, etc.
 */
function resolveImageSrc(img: HTMLImageElement): string | undefined {
  const src = img.getAttribute("src");
  // Use src if it's a real URL (not a placeholder or data URI)
  if (src && !src.startsWith("data:") && !/placeholder/i.test(src)) {
    return src;
  }
  // Fallback through common lazy-load attributes
  const dataSrc = img.getAttribute("data-src");
  if (dataSrc) return dataSrc;
  const dataLazySrc = img.getAttribute("data-lazy-src");
  if (dataLazySrc) return dataLazySrc;
  const dataOriginal = img.getAttribute("data-original");
  if (dataOriginal) return dataOriginal;
  // Try first entry from srcset
  const srcset = img.getAttribute("srcset");
  if (srcset) {
    const first = srcset.split(",")[0]?.trim().split(/\s+/)[0];
    if (first) return first;
  }
  // Fall back to src even if it was a data URI (better than nothing)
  return src || undefined;
}

/** Live region roles that contain transient notifications, not page content. */
const LIVE_REGION_ROLES = new Set(["alert", "status", "log", "marquee", "timer"]);

/**
 * Walk the DOM tree and extract text with proper spacing.
 * Inserts spaces at block-level element boundaries and between sibling inline elements.
 */
export function extractText(el: Element): string {
  const parts: string[] = [];

  function walk(node: Node, depth: number = 0) {
    if (depth > MAX_DEPTH) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text.trim()) {
        parts.push(text);
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;

    if (isHidden(element)) return;

    const tag = element.tagName.toLowerCase();

    // Never include raw CSS or JS in extracted text
    if (tag === "style" || tag === "script") return;

    const isBlock = BLOCK_TAGS.has(tag) || tag === "br";

    if (isBlock && parts.length > 0) {
      parts.push(" ");
    }

    // Descend into shadow root if present
    if (element.shadowRoot) {
      for (const child of Array.from(element.shadowRoot.childNodes)) {
        walk(child, depth + 1);
      }
    } else {
      for (const child of Array.from(node.childNodes)) {
        walk(child, depth + 1);
      }
    }

    if (isBlock && parts.length > 0) {
      parts.push(" ");
    }
  }

  walk(el);

  return parts.join("").replace(/\s+/g, " ").trim();
}

/**
 * Recursively query all matching elements, descending into open shadow roots.
 */
export function deepQueryAll(root: Element | Document, selector: string): Element[] {
  const results: Element[] = [];

  function collect(node: Element | Document) {
    results.push(...Array.from(node.querySelectorAll(selector)));

    // Traverse shadow roots
    const elements = node.querySelectorAll("*");
    for (const el of Array.from(elements)) {
      if (el.shadowRoot) {
        collect(el.shadowRoot as unknown as Document);
      }
    }
  }

  collect(root);
  return results;
}

function absoluteUrl(href: string): string {
  try {
    const url = new URL(href, document.baseURI);
    // Decode encoded path separators (%2F) so links work when clicked
    url.pathname = decodeURIComponent(url.pathname);
    return url.href;
  } catch {
    return href;
  }
}

const LANDMARK_SELECTORS = [
  { selector: 'header, [role="banner"]', role: "banner" },
  { selector: 'nav, [role="navigation"]', role: "navigation" },
  { selector: 'main, [role="main"]', role: "main" },
  { selector: 'footer, [role="contentinfo"]', role: "contentinfo" },
  { selector: 'aside, [role="complementary"]', role: "complementary" },
  { selector: '[role="search"]', role: "search" },
  { selector: '[role="form"]', role: "form" },
] as const;

function extractLandmarks(doc: Document): Landmark[] {
  const landmarks: Landmark[] = [];
  const seen = new Set<Element>();

  for (const { selector, role } of LANDMARK_SELECTORS) {
    deepQueryAll(doc, selector).forEach((el) => {
      if (seen.has(el) || !isVisible(el)) return;
      seen.add(el);
      landmarks.push({
        role,
        label:
          el.getAttribute("aria-label") ??
          el.getAttribute("aria-labelledby") ??
          undefined,
      });
    });
  }
  return landmarks;
}

function extractHeadings(doc: Document): Heading[] {
  const headings: Heading[] = [];
  deepQueryAll(doc, "h1, h2, h3, h4, h5, h6").forEach((el) => {
    if (!isVisible(el)) return;
    const text = extractText(el);
    if (!text) return;
    const level = parseInt(el.tagName[1], 10);
    headings.push({ level, text, id: el.id || undefined });
  });
  return headings;
}

/** Labels that identify a nav element as primary/main site navigation. */
const PRIMARY_NAV_LABELS =
  /\b(primary|main|site|global|top)\b/i;

/** Labels that identify a nav element as secondary/auxiliary. */
const SECONDARY_NAV_LABELS =
  /\b(footer|secondary|legal|social|breadcrumb|utility|meta|supplementary)\b/i;

function extractNavLinks(doc: Document): NavLink[] {
  const seen = new Set<string>();
  const siteOrigin = (() => { try { return new URL(doc.URL).origin; } catch { return ""; } })();

  function collectFromAnchors(anchors: Element[]): NavLink[] {
    const result: NavLink[] = [];
    for (const el of anchors) {
      const anchor = el as HTMLAnchorElement;
      const href = absoluteUrl(anchor.href);
      if (seen.has(href)) continue;
      seen.add(href);

      const text =
        extractText(anchor) || anchor.getAttribute("aria-label") || href;

      // Skip nav links where text is just a URL (no meaningful label)
      if (text === href || /^https?:\/\//.test(text)) continue;

      // Skip links with double-encoded URLs (broken hrefs like /%252F...)
      const rawHref = anchor.getAttribute("href") ?? "";
      if (/%25/.test(rawHref)) continue;

      // Skip external-domain links (social media, partner sites)
      if (siteOrigin && href.startsWith("http")) {
        try {
          if (new URL(href).origin !== siteOrigin) continue;
        } catch { /* keep link if URL parsing fails */ }
      }

      result.push({
        text,
        href,
        isCurrent: anchor.getAttribute("aria-current") === "page",
      });
    }
    return result;
  }

  function getNavLabel(nav: Element): string {
    return (
      nav.getAttribute("aria-label") ??
      nav.getAttribute("aria-labelledby") ??
      ""
    );
  }

  // Collect all nav elements
  const navEls = deepQueryAll(doc, 'nav, [role="navigation"]');

  // Tier 1: Navs explicitly labelled as primary/main
  const primaryNavs = navEls.filter((n) => PRIMARY_NAV_LABELS.test(getNavLabel(n)));

  // Tier 2: Navs inside header/banner that are NOT secondary-labelled
  const headerNavs = navEls.filter(
    (n) =>
      !primaryNavs.includes(n) &&
      !SECONDARY_NAV_LABELS.test(getNavLabel(n)) &&
      (n.closest("header") !== null || n.closest('[role="banner"]') !== null),
  );

  // Tier 3: All remaining navs that aren't in footer and aren't secondary-labelled
  const otherNavs = navEls.filter(
    (n) =>
      !primaryNavs.includes(n) &&
      !headerNavs.includes(n) &&
      !SECONDARY_NAV_LABELS.test(getNavLabel(n)) &&
      n.closest("footer") === null &&
      n.closest('[role="contentinfo"]') === null,
  );

  // Collect links tier by tier, stopping once we have a reasonable set
  let links = collectFromAnchors(
    primaryNavs.flatMap((n) => Array.from(n.querySelectorAll("a[href]"))),
  );

  if (links.length === 0) {
    links = collectFromAnchors(
      headerNavs.flatMap((n) => Array.from(n.querySelectorAll("a[href]"))),
    );
  }

  if (links.length === 0) {
    links = collectFromAnchors(
      otherNavs.flatMap((n) => Array.from(n.querySelectorAll("a[href]"))),
    );
  }

  // Fallback: menu roles, common nav classes, and header links
  if (links.length === 0) {
    const fallbackAnchors = deepQueryAll(doc,
      [
        '[role="menu"] a[href]',
        '[role="menubar"] a[href]',
        ".nav a[href]",
        ".menu a[href]",
        ".navigation a[href]",
        "header a[href]",
        '[role="banner"] a[href]',
      ].join(", "),
    );
    links = collectFromAnchors(fallbackAnchors);
  }

  return links;
}

function extractMainContent(
  doc: Document,
  knownHeadings: Set<string>,
): ContentBlock[] {
  const main = doc.querySelector("main") ?? doc.querySelector('[role="main"]');
  const root = main ?? doc.body;
  const sourceContext = main ? "main" : "body";
  return extractContentBlocks(root, knownHeadings, sourceContext);
}

function extractContentBlocks(
  root: Element,
  knownHeadings: Set<string>,
  sourceContext: "main" | "article" | "body" = "body",
  depth: number = 0,
): ContentBlock[] {
  if (depth > MAX_DEPTH) return [];

  const blocks: ContentBlock[] = [];

  for (const child of Array.from(root.children)) {
    if (!isVisible(child)) continue;
    if (isPresentational(child)) continue;
    if (isNoisyElement(child)) continue;

    const tag = child.tagName.toLowerCase();

    // 3A: Skip live region roles (transient notifications, not content)
    const role = child.getAttribute("role");
    if (role && LIVE_REGION_ROLES.has(role)) continue;

    // Upgrade context for <article> elements
    const childContext = tag === "article" ? "article" : sourceContext;

    if (/^h[1-6]$/.test(tag)) {
      const text = extractText(child);
      if (text && !knownHeadings.has(text)) {
        blocks.push({
          type: "heading",
          text,
          level: parseInt(tag[1], 10),
          sourceContext: childContext,
        });
      }
      continue;
    }

    if (tag === "p") {
      const text = extractText(child);
      if (text && !isNoiseText(text) && !isPromotionalParagraph(text))
        blocks.push({ type: "paragraph", text, sourceContext: childContext });
      continue;
    }

    if (tag === "ul" || tag === "ol") {
      const items = Array.from(child.querySelectorAll(":scope > li"))
        .map((li) => extractText(li))
        .filter((t) => t && !isNoiseText(t));
      if (items.length) {
        blocks.push({
          type: "list",
          text: "",
          items,
          sourceContext: childContext,
        });
      }
      continue;
    }

    // 1B: Definition list extraction
    if (tag === "dl") {
      const defs: Array<{ term: string; description: string }> = [];
      const children = Array.from(child.children);
      let i = 0;
      while (i < children.length) {
        const dtEl = children[i];
        if (dtEl.tagName.toLowerCase() === "dt") {
          const term = extractText(dtEl);
          // Collect all following <dd> elements as the description
          const descParts: string[] = [];
          while (i + 1 < children.length && children[i + 1].tagName.toLowerCase() === "dd") {
            i++;
            const desc = extractText(children[i]);
            if (desc) descParts.push(desc);
          }
          if (term && descParts.length > 0 && !isNoiseText(term)) {
            defs.push({ term, description: descParts.join(" ") });
          }
        }
        i++;
      }
      if (defs.length > 0) {
        blocks.push({
          type: "definition-list",
          text: defs.map((d) => `${d.term}: ${d.description}`).join("; "),
          definitions: defs,
          sourceContext: childContext,
        });
      }
      continue;
    }

    if (tag === "blockquote") {
      const text = extractText(child);
      if (text)
        blocks.push({ type: "blockquote", text, sourceContext: childContext });
      continue;
    }

    if (tag === "pre") {
      const text = extractText(child);
      if (text)
        blocks.push({
          type: "preformatted",
          text,
          sourceContext: childContext,
        });
      continue;
    }

    // 1A: Table extraction
    if (tag === "table") {
      const headers: string[] = [];
      const rows: string[][] = [];

      // Extract headers from <thead> <th> or first row <th>
      child.querySelectorAll("thead th").forEach((th) => {
        headers.push(extractText(th));
      });
      // If no thead, check first tr for th elements
      if (headers.length === 0) {
        const firstRow = child.querySelector("tr");
        if (firstRow) {
          const ths = firstRow.querySelectorAll("th");
          if (ths.length > 0) {
            ths.forEach((th) => headers.push(extractText(th)));
          }
        }
      }

      // Extract rows from <tbody> or all <tr> elements
      const allRows = child.querySelectorAll("tbody tr, :scope > tr");
      allRows.forEach((tr) => {
        // Skip rows that only contain <th> (header rows)
        const tds = tr.querySelectorAll("td");
        if (tds.length === 0) return;
        const cells = Array.from(tds).map((td) => extractText(td));
        // Filter rows where every cell is noise
        if (cells.every((c) => !c || isNoiseText(c))) return;
        rows.push(cells);
      });

      if (rows.length > 0) {
        // Build summary text from caption or headers
        const caption = child.querySelector("caption");
        const summaryText = caption
          ? extractText(caption)
          : headers.length > 0
            ? `Table: ${headers.join(", ")}`
            : `Table with ${rows.length} rows`;
        blocks.push({
          type: "table",
          text: summaryText,
          headers: headers.length > 0 ? headers : undefined,
          rows,
          sourceContext: childContext,
        });
      }
      continue;
    }

    // 1C: Figure/figcaption handler (before img)
    if (tag === "figure") {
      const img = child.querySelector("img") ?? child.querySelector("picture img");
      if (img) {
        const imgEl = img as HTMLImageElement;
        const figcaption = child.querySelector("figcaption");
        const captionText = figcaption ? extractText(figcaption) : "";
        const alt = imgEl.alt?.trim() || "";
        const displayText = captionText || alt;
        if (displayText) {
          const resolvedSrc = resolveImageSrc(imgEl);
          blocks.push({
            type: "image",
            text: displayText,
            alt: captionText || alt,
            src: resolvedSrc ? absoluteUrl(resolvedSrc) : undefined,
            sourceContext: childContext,
          });
        }
      } else {
        // Figure without image — extract content normally
        blocks.push(...extractContentBlocks(child, knownHeadings, childContext, depth + 1));
      }
      continue;
    }

    // 2F: <picture> element — find inner <img> and delegate
    if (tag === "picture") {
      const img = child.querySelector("img");
      if (img) {
        const imgEl = img as HTMLImageElement;
        const alt = imgEl.alt?.trim();
        if (alt) {
          const resolvedSrc = resolveImageSrc(imgEl);
          blocks.push({
            type: "image",
            text: alt,
            alt,
            src: resolvedSrc ? absoluteUrl(resolvedSrc) : undefined,
            sourceContext: childContext,
          });
        }
      }
      continue;
    }

    // 1E: Image with lazy-load fallback
    if (tag === "img") {
      const img = child as HTMLImageElement;
      const alt = img.alt?.trim();
      if (alt) {
        const resolvedSrc = resolveImageSrc(img);
        blocks.push({
          type: "image",
          text: alt,
          alt,
          src: resolvedSrc ? absoluteUrl(resolvedSrc) : undefined,
          sourceContext: childContext,
        });
      }
      continue;
    }

    // 2D: ARIA role="img" with aria-label
    if (role === "img") {
      const ariaLabel = child.getAttribute("aria-label")?.trim();
      if (ariaLabel) {
        blocks.push({
          type: "image",
          text: ariaLabel,
          alt: ariaLabel,
          sourceContext: childContext,
        });
      }
      continue;
    }

    // Handle same-origin iframes
    if (tag === "iframe") {
      try {
        const iframe = child as HTMLIFrameElement;
        const iframeDoc = iframe.contentDocument;
        if (iframeDoc?.body) {
          blocks.push(...extractContentBlocks(iframeDoc.body, knownHeadings, childContext, depth + 1));
        }
      } catch {
        // Cross-origin iframe — skip silently
      }
      continue;
    }

    // 2B: <details>/<summary> handling
    if (tag === "details") {
      const summary = child.querySelector(":scope > summary");
      if (summary) {
        const summaryText = extractText(summary);
        if (summaryText && !knownHeadings.has(summaryText)) {
          blocks.push({
            type: "heading",
            text: summaryText,
            level: 4,
            sourceContext: childContext,
          });
        }
      }
      // Recurse into remaining children, skipping the already-handled summary
      for (const detailChild of Array.from(child.children)) {
        if (detailChild.tagName.toLowerCase() === "summary") continue;
        blocks.push(...extractContentBlocks(detailChild, knownHeadings, childContext, depth + 1));
      }
      continue;
    }

    if (SKIP_TAGS.has(tag)) {
      continue;
    }

    // Descend into shadow root if present
    if (child.shadowRoot) {
      blocks.push(...extractContentBlocks(child.shadowRoot as unknown as Element, knownHeadings, childContext, depth + 1));
      continue;
    }

    if (child.children.length > 0) {
      blocks.push(...extractContentBlocks(child, knownHeadings, childContext, depth + 1));
    } else {
      const text = extractText(child);
      if (text && !isNoiseText(text) && !isPromotionalParagraph(text))
        blocks.push({ type: "paragraph", text, sourceContext: childContext });
    }
  }

  return blocks;
}

function extractForms(doc: Document): FormSnapshot[] {
  const forms: FormSnapshot[] = [];
  const seenActions = new Set<string>();

  (deepQueryAll(doc, "form") as HTMLFormElement[]).forEach((form) => {
    if (!isVisible(form)) return;

    const action = form.action ? absoluteUrl(form.action) : "";

    // Skip duplicate forms (same action URL = same form embedded twice)
    if (action && seenActions.has(action)) return;
    if (action) seenActions.add(action);

    const fields: FormField[] = [];

    form.querySelectorAll("input, select, textarea").forEach((el) => {
      if (!isVisible(el)) return;

      // Skip honeypot/bot-trap fields — tabindex="-1" signals intentional
      // removal from the tab order, a common anti-spam technique
      if (el.getAttribute("tabindex") === "-1") return;

      const input = el as HTMLInputElement;
      const tagName = el.tagName.toLowerCase();
      const type =
        tagName === "textarea"
          ? "textarea"
          : tagName === "select"
            ? "select"
            : input.type || "text";

      if (type === "hidden") return;

      const label = getAccessibleName(el);
      const field: FormField = {
        type,
        name: input.name || "",
        label,
        required: input.required || el.getAttribute("aria-required") === "true",
        value: input.value || undefined,
      };

      if (type === "select") {
        const select = el as HTMLSelectElement;
        field.options = Array.from(select.options).map((opt) => ({
          value: opt.value,
          label: opt.text.trim(),
        }));
      }

      fields.push(field);
    });

    forms.push({
      action,
      method: (form.method || "get").toUpperCase(),
      label: getFormLabel(form),
      fields,
    });
  });

  return forms;
}

function extractButtons(doc: Document): ButtonSnapshot[] {
  const buttons: ButtonSnapshot[] = [];
  const seenElements = new Set<Element>();
  const seenText = new Set<string>();

  deepQueryAll(
    doc,
    'button, input[type="submit"], input[type="button"], input[type="reset"], [role="button"]',
  ).forEach((el) => {
      if (seenElements.has(el) || !isVisible(el)) return;
      seenElements.add(el);

      if (el.closest("form")) return;

      let text: string;
      if (el instanceof HTMLInputElement) {
        text = el.value || el.type;
      } else {
        text = getAccessibleName(el);
      }
      if (!text) return;

      // Filter noise text and chrome strings
      if (isNoiseText(text)) return;
      if (NOISE_CHROME_STRINGS.has(text.toLowerCase())) return;

      // Filter carousel/slide controls
      if (SLIDE_CONTROL_PATTERN.test(text)) return;

      // Deduplicate by text (keep first occurrence)
      const textLower = text.toLowerCase();
      if (seenText.has(textLower)) return;
      seenText.add(textLower);

      let type: "submit" | "button" | "reset" = "button";
      if (el instanceof HTMLButtonElement) {
        type = (el.type as "submit" | "button" | "reset") || "submit";
      } else if (el instanceof HTMLInputElement) {
        type = el.type as "submit" | "button" | "reset";
      }

      buttons.push({ text, type });
    });

  return buttons;
}

function cleanLinkText(text: string): string {
  // Collapse whitespace/newlines
  let cleaned = text.replace(/\s+/g, " ").trim();
  // Truncate excessively long text to first sentence or 120 chars
  if (cleaned.length > 120) {
    const sentenceEnd = cleaned.search(/[.!?]\s/);
    if (sentenceEnd > 0 && sentenceEnd < 120) {
      cleaned = cleaned.slice(0, sentenceEnd + 1);
    } else {
      cleaned = cleaned.slice(0, 120).replace(/\s+\S*$/, "") + "…";
    }
  }
  return cleaned;
}

function extractLinks(
  doc: Document,
  contentTexts?: Set<string>,
  navHrefs?: Set<string>,
): LinkSnapshot[] {
  const links: LinkSnapshot[] = [];
  const seen = new Set<string>();
  const seenText = new Set<string>();
  const currentUrl = doc.URL.replace(/#.*$/, "");

  deepQueryAll(doc, 'a[href], [role="link"][href]').forEach((el) => {
    if (!isVisible(el)) return;
    const anchor = el as HTMLAnchorElement;
    const rawHref = anchor.getAttribute("href") ?? "";

    // Skip fragment-only links
    if (/^#/.test(rawHref)) return;

    // Skip double-encoded URLs (broken hrefs like /%252F...)
    if (/%25/.test(rawHref)) return;

    const href = absoluteUrl(anchor.href);

    // Skip self-links (current page URL)
    if (href.replace(/#.*$/, "") === currentUrl) return;

    if (navHrefs?.has(href)) return;
    if (href.startsWith("javascript:")) return;

    // 3B: Filter tel: and mailto: protocol links
    if (href.startsWith("tel:") || href.startsWith("mailto:")) return;

    // 2D: Filter data: and blob: URLs
    if (href.startsWith("data:") || href.startsWith("blob:")) return;
    if (seen.has(href)) return;
    seen.add(href);

    let text = extractText(anchor) || anchor.getAttribute("aria-label") || href;
    text = cleanLinkText(text);

    // Filter links where displayed text is just the raw URL (no meaningful label)
    if (text === href || text === rawHref) return;

    // Apply noise and chrome string checks to link text
    if (isNoiseText(text)) return;
    if (NOISE_CHROME_STRINGS.has(text.toLowerCase())) return;

    // Filter promotional/CTA link text
    if (isPromotionalParagraph(text)) return;

    // Filter carousel/slide controls
    if (SLIDE_CONTROL_PATTERN.test(text)) return;

    // Deduplicate links whose text closely matches content paragraphs
    if (contentTexts) {
      const textLower = text.toLowerCase();
      let duplicatesContent = false;
      for (const ct of contentTexts) {
        const ctLower = ct.toLowerCase();
        if (ctLower.includes(textLower) || textLower.includes(ctLower)) {
          duplicatesContent = true;
          break;
        }
      }
      if (duplicatesContent) return;
    }

    // Deduplicate by link text (keep first occurrence)
    const textLower = text.toLowerCase();
    if (seenText.has(textLower)) return;
    seenText.add(textLower);

    const isFooter = !!anchor.closest('footer, [role="contentinfo"]');
    links.push({ text, href, isFooter });
  });

  return links;
}

export function extractPageSnapshot(doc: Document): PageSnapshot {
  const headings = extractHeadings(doc);
  const knownHeadings = new Set(headings.map((h) => h.text));
  const mainContent = extractMainContent(doc, knownHeadings);

  const contentGroups = groupAndScoreContent(mainContent);

  // Collect content paragraph texts for link deduplication
  const contentTexts = new Set<string>();
  for (const group of contentGroups) {
    for (const block of group.blocks) {
      if (block.type === "paragraph" && block.text.split(/\s+/).length >= 3) {
        contentTexts.add(block.text);
      }
    }
  }

  const navLinks = extractNavLinks(doc);
  const navHrefs = new Set(navLinks.map((l) => l.href));

  return {
    url: doc.URL,
    title: doc.title?.trim() || "Untitled",
    lang: doc.documentElement.lang || "en",
    landmarks: extractLandmarks(doc),
    headings,
    navLinks,
    contentGroups,
    forms: extractForms(doc),
    buttons: extractButtons(doc),
    links: extractLinks(doc, contentTexts, navHrefs),
    search: extractSearch(doc),
  };
}

function extractSearch(
  doc: Document,
): { action: string; paramName: string } | undefined {
  // Look for search input — try multiple selectors
  const searchInput = deepQueryAll(doc,
    [
      'input[type="search"]',
      'input[name="q"]',
      'input[name="query"]',
      'input[name="search"]',
      'input[name="s"]',
      'input[aria-label*="search" i]',
      'input[placeholder*="search" i]',
      'input[id*="search" i]',
      'input[data-testid*="search" i]',
      '[role="search"] input',
      '[role="searchbox"]',
    ].join(", "),
  )[0];
  if (!searchInput) return undefined;

  const inputEl = searchInput as HTMLInputElement;
  const paramName = inputEl.name || "q";

  const form = searchInput.closest("form");
  if (form) {
    const action = form.action ? absoluteUrl(form.action) : doc.URL;
    return { action, paramName };
  }

  // No form wrapper — construct search URL from site origin
  try {
    const origin = new URL(doc.URL).origin;
    return { action: `${origin}/search`, paramName };
  } catch {
    return undefined;
  }
}
