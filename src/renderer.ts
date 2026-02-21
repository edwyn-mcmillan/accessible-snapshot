import type {
  ContentBlock,
  ContentGroup,
  FormField,
  FormSnapshot,
  PageSnapshot,
} from "./types.js";

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escAttr(text: string): string {
  return esc(text);
}

function renderContentBlock(block: ContentBlock): string {
  switch (block.type) {
    case "heading":
      return `<h${block.level}>${esc(block.text)}</h${block.level}>`;

    case "paragraph":
      return `<p tabindex="0">${esc(block.text)}</p>`;

    case "list": {
      const items = (block.items ?? [])
        .map((item) => `  <li>${esc(item)}</li>`)
        .join("\n");
      return `<ul>\n${items}\n</ul>`;
    }

    case "image":
      if (!block.src) return "";
      return `<figure>
  <img src="${escAttr(block.src)}" alt="${escAttr(block.alt ?? "")}" loading="lazy" decoding="async" tabindex="0">
  ${block.alt ? `<figcaption>${esc(block.alt)}</figcaption>` : ""}
</figure>`;

    case "blockquote":
      return `<blockquote><p>${esc(block.text)}</p></blockquote>`;

    case "preformatted":
      return `<pre>${esc(block.text)}</pre>`;

    case "table": {
      const headerRow = block.headers?.length
        ? `<thead><tr>${block.headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>\n`
        : "";
      const bodyRows = (block.rows ?? [])
        .map(
          (row) =>
            `  <tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`,
        )
        .join("\n");
      return `<table tabindex="0">\n${headerRow}<tbody>\n${bodyRows}\n</tbody>\n</table>`;
    }

    case "definition-list": {
      const items = (block.definitions ?? [])
        .map(
          (d) => `  <dt>${esc(d.term)}</dt>\n  <dd>${esc(d.description)}</dd>`,
        )
        .join("\n");
      return `<dl>\n${items}\n</dl>`;
    }

    default:
      return `<p tabindex="0">${esc(block.text)}</p>`;
  }
}

function renderContentGroup(group: ContentGroup): string {
  const blocksHtml = group.blocks.map(renderContentBlock).join("\n");
  const headingHtml = group.heading
    ? `<h${group.heading.level}>${esc(group.heading.text)}</h${group.heading.level}>`
    : "";

  if (group.collapsed) {
    if (!group.heading) return "";
    return `<details class="content-group collapsed">
  <summary>${esc(group.heading.text)}</summary>
  <div class="group-content">
${blocksHtml}
  </div>
</details>`;
  }

  return `<section class="content-group">
${headingHtml}
${blocksHtml}
</section>`;
}

function renderFormField(field: FormField): string {
  const id = `field-${field.name || Math.random().toString(36).slice(2, 8)}`;
  const req = field.required ? " required" : "";
  const label = `<label for="${escAttr(id)}">${esc(field.label || field.name)}${field.required ? ' <span aria-hidden="true">*</span>' : ""}</label>`;

  switch (field.type) {
    case "textarea":
      return `${label}\n<textarea id="${escAttr(id)}" name="${escAttr(field.name)}"${req}>${esc(field.value ?? "")}</textarea>`;

    case "select": {
      const options = (field.options ?? [])
        .map(
          (opt) =>
            `  <option value="${escAttr(opt.value)}">${esc(opt.label)}</option>`,
        )
        .join("\n");
      return `${label}\n<select id="${escAttr(id)}" name="${escAttr(field.name)}"${req}>\n${options}\n</select>`;
    }

    case "checkbox":
    case "radio":
      return `<label><input type="${field.type}" id="${escAttr(id)}" name="${escAttr(field.name)}" value="${escAttr(field.value ?? "")}"${req}> ${esc(field.label || field.name)}</label>`;

    default:
      return `${label}\n<input type="${escAttr(field.type)}" id="${escAttr(id)}" name="${escAttr(field.name)}" value="${escAttr(field.value ?? "")}"${req}>`;
  }
}

function renderForm(form: FormSnapshot): string {
  const fields = form.fields.map(renderFormField).join("\n");
  const legend = form.label ? `<legend>${esc(form.label)}</legend>\n` : "";
  return `<form action="${escAttr(form.action)}" method="${escAttr(form.method)}">
<fieldset>
${legend}${fields}
</fieldset>
</form>`;
}

export function renderSnapshot(snapshot: PageSnapshot): { html: string; title: string; bodyHtml: string } {
  const parts: string[] = [];

  if (snapshot.navLinks.length > 0) {
    const items = snapshot.navLinks
      .map((link) => {
        const current = link.isCurrent ? ' aria-current="page"' : "";
        return `    <li><a href="${escAttr(link.href)}"${current}>${esc(link.text)}</a></li>`;
      })
      .join("\n");
    parts.push(`<details>
  <summary><h2>Navigation (${snapshot.navLinks.length})</h2></summary>
  <nav role="navigation" aria-label="Page navigation">
  <ul>
${items}
  </ul>
  </nav>
</details>`);
  }

  if (snapshot.contentGroups.length > 0) {
    const visibleGroups = snapshot.contentGroups.filter(
      (g) => !g.collapsed || g.heading,
    );
    const blockCount = visibleGroups.reduce((n, g) => n + g.blocks.length, 0);
    const content = snapshot.contentGroups.map(renderContentGroup).join("\n");
    parts.push(`<main id="main" role="main">
<details open>
  <summary><h2>Page Content (${blockCount} items)</h2></summary>
${content}
</details>
</main>`);
  } else {
    parts.push(
      '<main id="main" role="main">\n  <p>No main content could be extracted from this page.</p>\n</main>',
    );
  }

  if (snapshot.forms.length > 0) {
    const formHtml = snapshot.forms.map(renderForm).join("\n");
    parts.push(`<details>
  <summary><h2>Forms (${snapshot.forms.length})</h2></summary>
  <section aria-label="Forms">
${formHtml}
  </section>
</details>`);
  }

  const mainLinks = snapshot.links.filter((l) => !l.isFooter);
  const footerLinks = snapshot.links.filter((l) => l.isFooter);

  if (mainLinks.length > 0) {
    const items = mainLinks
      .map(
        (link) =>
          `    <li><a href="${escAttr(link.href)}">${esc(link.text)}</a></li>`,
      )
      .join("\n");
    parts.push(`<details>
  <summary><h2>Links (${mainLinks.length})</h2></summary>
  <ul>
${items}
  </ul>
</details>`);
  }

  if (footerLinks.length > 0) {
    const items = footerLinks
      .map(
        (link) =>
          `    <li><a href="${escAttr(link.href)}">${esc(link.text)}</a></li>`,
      )
      .join("\n");
    parts.push(`<details>
  <summary><h2>Footer Links (${footerLinks.length})</h2></summary>
  <ul>
${items}
  </ul>
</details>`);
  }

  const pageTitle = `Accessible Snapshot: ${esc(snapshot.title)}`;

  const searchHtml = snapshot.search
    ? `<form action="${escAttr(snapshot.search.action)}" method="GET" role="search" aria-label="Site search" class="snapshot-search">
  <label for="snapshot-search-input">Search this site</label>
  <input type="search" id="snapshot-search-input" name="${escAttr(snapshot.search.paramName)}" placeholder="Search...">
  <button type="submit">Search</button>
</form>`
    : "";

  const bodyHtml = `<header role="banner">
  <h1>${esc(snapshot.title)}</h1>
</header>
${searchHtml ? searchHtml + "\n" : ""}
${parts.join("\n\n")}

<footer role="contentinfo">
  <p class="source-link">Accessible snapshot of <a href="${escAttr(snapshot.url)}">${esc(snapshot.url)}</a></p>
</footer>`;

  const html = `<!DOCTYPE html>
<html lang="${escAttr(snapshot.lang)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${pageTitle}</title>
<link rel="stylesheet" href="snapshot.css">
</head>
<body>
${bodyHtml}
</body>
</html>`;

  return { html, title: pageTitle, bodyHtml };
}
