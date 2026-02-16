import type {
  PageSnapshot,
  Landmark,
  Heading,
  NavLink,
  ContentBlock,
  FormSnapshot,
  FormField,
  ButtonSnapshot,
  LinkSnapshot,
} from "./types.js";

function isHidden(el: Element): boolean {
  if (el.hasAttribute("hidden")) return true;
  if (el.getAttribute("aria-hidden") === "true") return true;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return true;
  return false;
}

function isVisible(el: Element): boolean {
  return !isHidden(el);
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

function trimmedText(el: Element): string {
  return el.textContent?.trim() ?? "";
}

function absoluteUrl(href: string): string {
  try {
    return new URL(href, document.baseURI).href;
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
    doc.querySelectorAll(selector).forEach((el) => {
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
  doc.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((el) => {
    if (!isVisible(el)) return;
    const text = trimmedText(el);
    if (!text) return;
    const level = parseInt(el.tagName[1], 10);
    headings.push({ level, text, id: el.id || undefined });
  });
  return headings;
}

function extractNavLinks(doc: Document): NavLink[] {
  const links: NavLink[] = [];
  const seen = new Set<string>();

  doc
    .querySelectorAll('nav a[href], [role="navigation"] a[href]')
    .forEach((el) => {
      if (!isVisible(el)) return;
      const anchor = el as HTMLAnchorElement;
      const href = absoluteUrl(anchor.href);
      if (seen.has(href)) return;
      seen.add(href);

      const text =
        trimmedText(anchor) || anchor.getAttribute("aria-label") || href;
      links.push({
        text,
        href,
        isCurrent: anchor.getAttribute("aria-current") === "page",
      });
    });
  return links;
}

function extractMainContent(doc: Document): ContentBlock[] {
  const main = doc.querySelector("main") ?? doc.querySelector('[role="main"]');
  const root = main ?? doc.body;
  return extractContentBlocks(root);
}

function extractContentBlocks(root: Element): ContentBlock[] {
  const blocks: ContentBlock[] = [];

  for (const child of Array.from(root.children)) {
    if (!isVisible(child)) continue;

    const tag = child.tagName.toLowerCase();

    if (/^h[1-6]$/.test(tag)) {
      const text = trimmedText(child);
      if (text) {
        blocks.push({
          type: "heading",
          text,
          level: parseInt(tag[1], 10),
        });
      }
      continue;
    }

    if (tag === "p") {
      const text = trimmedText(child);
      if (text) blocks.push({ type: "paragraph", text });
      continue;
    }

    if (tag === "ul" || tag === "ol") {
      const items = Array.from(child.querySelectorAll(":scope > li"))
        .map((li) => trimmedText(li))
        .filter(Boolean);
      if (items.length) {
        blocks.push({ type: "list", text: "", items });
      }
      continue;
    }

    if (tag === "blockquote") {
      const text = trimmedText(child);
      if (text) blocks.push({ type: "blockquote", text });
      continue;
    }

    if (tag === "pre") {
      const text = trimmedText(child);
      if (text) blocks.push({ type: "preformatted", text });
      continue;
    }

    if (tag === "img") {
      const img = child as HTMLImageElement;
      const alt = img.alt?.trim();
      if (alt) {
        blocks.push({
          type: "image",
          text: alt,
          alt,
          src: absoluteUrl(img.src),
        });
      }
      continue;
    }

    if (
      ["nav", "form", "script", "style", "link", "meta", "noscript"].includes(
        tag,
      )
    ) {
      continue;
    }

    if (child.children.length > 0) {
      blocks.push(...extractContentBlocks(child));
    } else {
      const text = trimmedText(child);
      if (text) blocks.push({ type: "paragraph", text });
    }
  }

  return blocks;
}

function extractForms(doc: Document): FormSnapshot[] {
  const forms: FormSnapshot[] = [];

  doc.querySelectorAll("form").forEach((form) => {
    if (!isVisible(form)) return;

    const fields: FormField[] = [];

    form.querySelectorAll("input, select, textarea").forEach((el) => {
      if (!isVisible(el)) return;

      const input = el as HTMLInputElement;
      const type =
        el.tagName.toLowerCase() === "textarea"
          ? "textarea"
          : el.tagName.toLowerCase() === "select"
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

      if (el.tagName.toLowerCase() === "select") {
        const select = el as HTMLSelectElement;
        field.options = Array.from(select.options).map((opt) => ({
          value: opt.value,
          label: opt.text.trim(),
        }));
      }

      fields.push(field);
    });

    forms.push({
      action: form.action ? absoluteUrl(form.action) : "",
      method: (form.method || "get").toUpperCase(),
      label: getAccessibleName(form) || undefined,
      fields,
    });
  });

  return forms;
}

function extractButtons(doc: Document): ButtonSnapshot[] {
  const buttons: ButtonSnapshot[] = [];
  const seen = new Set<Element>();

  doc
    .querySelectorAll(
      'button, input[type="submit"], input[type="button"], input[type="reset"], [role="button"]',
    )
    .forEach((el) => {
      if (seen.has(el) || !isVisible(el)) return;
      seen.add(el);

      if (el.closest("form")) return;

      let text: string;
      if (el instanceof HTMLInputElement) {
        text = el.value || el.type;
      } else {
        text = getAccessibleName(el);
      }
      if (!text) return;

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

function extractLinks(doc: Document): LinkSnapshot[] {
  const links: LinkSnapshot[] = [];
  const seen = new Set<string>();

  const navHrefs = new Set<string>();
  doc
    .querySelectorAll('nav a[href], [role="navigation"] a[href]')
    .forEach((el) => {
      navHrefs.add((el as HTMLAnchorElement).href);
    });

  doc.querySelectorAll("a[href]").forEach((el) => {
    if (!isVisible(el)) return;
    const anchor = el as HTMLAnchorElement;
    const href = absoluteUrl(anchor.href);

    if (navHrefs.has(anchor.href)) return;
    if (href.startsWith("javascript:")) return;
    if (seen.has(href)) return;
    seen.add(href);

    const text =
      trimmedText(anchor) || anchor.getAttribute("aria-label") || href;
    links.push({ text, href });
  });

  return links;
}

export function extractPageSnapshot(doc: Document): PageSnapshot {
  return {
    url: doc.URL,
    title: doc.title?.trim() || "Untitled",
    lang: doc.documentElement.lang || "en",
    landmarks: extractLandmarks(doc),
    headings: extractHeadings(doc),
    navLinks: extractNavLinks(doc),
    mainContent: extractMainContent(doc),
    forms: extractForms(doc),
    buttons: extractButtons(doc),
    links: extractLinks(doc),
  };
}
