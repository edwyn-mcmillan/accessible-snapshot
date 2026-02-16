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
<style>
*,
*::before,
*::after {
  box-sizing: border-box;
}
body {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  max-width: 70ch;
  margin: 2rem auto;
  padding: 0 1rem;
  line-height: 1.6;
  color: #1a1a1a;
  background: #fff;
}
:focus {
  outline: 3px solid #4A90D9;
  outline-offset: 2px;
}
.skip-link {
  position: absolute;
  top: -100px;
  left: 0;
  padding: 0.5rem 1rem;
  background: #1a1a1a;
  color: #fff;
  text-decoration: none;
  font-weight: bold;
  z-index: 1000;
}
.skip-link:focus {
  top: 0;
}
h1 { font-size: 1.75rem; margin: 0 0 0.5rem; }
h2 { font-size: 1.35rem; margin: 1.5rem 0 0.5rem; border-bottom: 1px solid #ddd; padding-bottom: 0.25rem; }
h3 { font-size: 1.15rem; margin: 1.25rem 0 0.5rem; }
h4, h5, h6 { font-size: 1rem; margin: 1rem 0 0.5rem; }
a { color: #1a0dab; }
a:visited { color: #681da8; }
nav ul, section ul {
  list-style: none;
  padding: 0;
}
nav li, section li {
  margin: 0.25rem 0;
  padding: 0.25rem 0;
}
blockquote {
  border-left: 3px solid #888;
  margin: 1rem 0;
  padding: 0.5rem 1rem;
  color: #444;
}
pre {
  background: #f5f5f5;
  padding: 1rem;
  overflow-x: auto;
  border-radius: 4px;
}
figure {
  margin: 1rem 0;
}
figcaption {
  font-size: 0.875rem;
  color: #555;
  margin-top: 0.25rem;
}
fieldset {
  border: 1px solid #ccc;
  border-radius: 4px;
  margin: 1rem 0;
  padding: 1rem;
}
legend {
  font-weight: bold;
  padding: 0 0.5rem;
}
label {
  display: block;
  margin: 0.75rem 0 0.25rem;
  font-weight: 500;
}
input, select, textarea {
  font-size: 1rem;
  padding: 0.375rem 0.5rem;
  border: 1px solid #999;
  border-radius: 3px;
  width: 100%;
  max-width: 30rem;
}
button {
  font-size: 1rem;
  padding: 0.5rem 1.25rem;
  cursor: pointer;
  border: 1px solid #555;
  border-radius: 3px;
  background: #f9f9f9;
  margin: 0.25rem 0.25rem 0.25rem 0;
}
button:hover, button:focus {
  background: #e0e0e0;
}
.source-link {
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #ddd;
  font-size: 0.875rem;
  color: #555;
}
</style>
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
