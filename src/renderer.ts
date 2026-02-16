import type {
  PageSnapshot,
  ContentBlock,
  FormSnapshot,
  FormField,
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
      return `<p>${esc(block.text)}</p>`;

    case "list": {
      const items = (block.items ?? [])
        .map((item) => `  <li>${esc(item)}</li>`)
        .join("\n");
      return `<ul>\n${items}\n</ul>`;
    }

    case "image":
      return `<figure><img src="${escAttr(block.src ?? "")}" alt="${escAttr(block.alt ?? block.text)}"><figcaption>${esc(block.alt ?? block.text)}</figcaption></figure>`;

    case "blockquote":
      return `<blockquote><p>${esc(block.text)}</p></blockquote>`;

    case "preformatted":
      return `<pre>${esc(block.text)}</pre>`;

    default:
      return `<p>${esc(block.text)}</p>`;
  }
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

export function renderSnapshot(snapshot: PageSnapshot): string {
  const parts: string[] = [];

  if (snapshot.navLinks.length > 0) {
    const items = snapshot.navLinks
      .map((link) => {
        const current = link.isCurrent ? ' aria-current="page"' : "";
        return `    <li><a href="${escAttr(link.href)}"${current}>${esc(link.text)}</a></li>`;
      })
      .join("\n");
    parts.push(`<nav role="navigation" aria-label="Page navigation">
  <h2>Navigation</h2>
  <ul>
${items}
  </ul>
</nav>`);
  }

  if (snapshot.mainContent.length > 0) {
    const content = snapshot.mainContent.map(renderContentBlock).join("\n");
    parts.push(`<main id="main" role="main">
  <h2>Content</h2>
${content}
</main>`);
  } else {
    parts.push(
      '<main id="main" role="main">\n  <p>No main content could be extracted from this page.</p>\n</main>',
    );
  }

  if (snapshot.forms.length > 0) {
    const formHtml = snapshot.forms.map(renderForm).join("\n");
    parts.push(`<section aria-label="Forms">
  <h2>Forms</h2>
${formHtml}
</section>`);
  }

  if (snapshot.buttons.length > 0) {
    const btns = snapshot.buttons
      .map(
        (btn) =>
          `  <button type="${escAttr(btn.type)}">${esc(btn.text)}</button>`,
      )
      .join("\n");
    parts.push(`<section aria-label="Actions">
  <h2>Actions</h2>
${btns}
</section>`);
  }

  if (snapshot.links.length > 0) {
    const items = snapshot.links
      .map(
        (link) =>
          `    <li><a href="${escAttr(link.href)}">${esc(link.text)}</a></li>`,
      )
      .join("\n");
    parts.push(`<section aria-label="All links">
  <h2>Links</h2>
  <ul>
${items}
  </ul>
</section>`);
  }

  if (snapshot.landmarks.length > 0) {
    const items = snapshot.landmarks
      .map((lm) => {
        const label = lm.label ? ` — ${esc(lm.label)}` : "";
        return `    <li>${esc(lm.role)}${label}</li>`;
      })
      .join("\n");
    parts.push(`<section aria-label="Landmark summary">
  <h2>Page Landmarks</h2>
  <ul>
${items}
  </ul>
</section>`);
  }

  return `<!DOCTYPE html>
<html lang="${escAttr(snapshot.lang)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Accessible Snapshot: ${esc(snapshot.title)}</title>
<link rel="stylesheet" href="snapshot.css">
</head>
<body>
<a href="#main" class="skip-link">Skip to main content</a>

<header role="banner">
  <h1>${esc(snapshot.title)}</h1>
</header>

${parts.join("\n\n")}

<footer role="contentinfo">
  <p class="source-link">Accessible snapshot of <a href="${escAttr(snapshot.url)}">${esc(snapshot.url)}</a></p>
</footer>
</body>
</html>`;
}
