import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deepQueryAll,
  extractPageSnapshot,
  extractText,
  isHidden,
  isNoisyElement,
  isNoiseText,
  isPromotionalParagraph,
  isVisible,
} from "../src/extractor.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setBody(html: string): void {
  document.body.innerHTML = html;
}

function createElement(tag: string, attrs: Record<string, string> = {}): Element {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  return el;
}

// ---------------------------------------------------------------------------
// isHidden / isVisible
// ---------------------------------------------------------------------------

describe("isHidden / isVisible", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns true for element with hidden attribute", () => {
    const el = createElement("div", { hidden: "" });
    document.body.appendChild(el);
    expect(isHidden(el)).toBe(true);
    expect(isVisible(el)).toBe(false);
  });

  it("returns true for element with aria-hidden='true'", () => {
    const el = createElement("span", { "aria-hidden": "true" });
    document.body.appendChild(el);
    expect(isHidden(el)).toBe(true);
    expect(isVisible(el)).toBe(false);
  });

  it("returns false for element with aria-hidden='false'", () => {
    const el = createElement("span", { "aria-hidden": "false" });
    document.body.appendChild(el);
    expect(isHidden(el)).toBe(false);
    expect(isVisible(el)).toBe(true);
  });

  it("returns false for a normal visible element", () => {
    const el = createElement("p");
    el.textContent = "Hello";
    document.body.appendChild(el);
    expect(isHidden(el)).toBe(false);
    expect(isVisible(el)).toBe(true);
  });

  it("returns false when hidden attribute is absent and no aria-hidden", () => {
    const el = createElement("section");
    document.body.appendChild(el);
    expect(isHidden(el)).toBe(false);
  });

  it("treats element without hidden as visible even with other attributes", () => {
    const el = createElement("div", { "data-custom": "true" });
    document.body.appendChild(el);
    expect(isVisible(el)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isNoisyElement
// ---------------------------------------------------------------------------

describe("isNoisyElement", () => {
  it("returns true when id matches a noise pattern", () => {
    const el = createElement("div", { id: "product-card-1" });
    expect(isNoisyElement(el)).toBe(true);
  });

  it("returns true when class matches a noise pattern", () => {
    const el = createElement("div", { class: "newsletter-signup" });
    expect(isNoisyElement(el)).toBe(true);
  });

  it("returns true for sidebar class", () => {
    const el = createElement("aside", { class: "sidebar" });
    expect(isNoisyElement(el)).toBe(true);
  });

  it("returns true for cookie banner id", () => {
    const el = createElement("div", { id: "cookie-banner" });
    expect(isNoisyElement(el)).toBe(true);
  });

  it("returns true for cart id", () => {
    const el = createElement("div", { id: "mini-cart" });
    expect(isNoisyElement(el)).toBe(true);
  });

  it("returns true for promo class", () => {
    const el = createElement("section", { class: "promo-banner" });
    expect(isNoisyElement(el)).toBe(true);
  });

  it("returns false for a plain content element", () => {
    const el = createElement("article", { id: "main-article", class: "content" });
    expect(isNoisyElement(el)).toBe(false);
  });

  it("returns false when neither id nor class are set", () => {
    const el = createElement("div");
    expect(isNoisyElement(el)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isNoiseText
// ---------------------------------------------------------------------------

describe("isNoiseText", () => {
  describe("prices", () => {
    it("treats dollar price like $9.99 as noise", () => {
      expect(isNoiseText("$9.99")).toBe(true);
    });

    it("treats whole dollar price like $10 as noise", () => {
      expect(isNoiseText("$10")).toBe(true);
    });

    it("treats bare decimal like 5.99 as noise", () => {
      expect(isNoiseText("5.99")).toBe(true);
    });

    it("treats integer string 42 as noise", () => {
      expect(isNoiseText("42")).toBe(true);
    });
  });

  describe("measurements", () => {
    it("treats 500g as noise", () => {
      expect(isNoiseText("500g")).toBe(true);
    });

    it("treats 1.5kg as noise", () => {
      expect(isNoiseText("1.5kg")).toBe(true);
    });

    it("treats 250ml as noise", () => {
      expect(isNoiseText("250ml")).toBe(true);
    });

    it("treats 30mm as noise", () => {
      expect(isNoiseText("30mm")).toBe(true);
    });
  });

  describe("chrome strings", () => {
    it("treats 'add to cart' as noise", () => {
      expect(isNoiseText("add to cart")).toBe(true);
    });

    it("treats 'buy now' as noise", () => {
      expect(isNoiseText("buy now")).toBe(true);
    });

    it("treats 'shop now' as noise", () => {
      expect(isNoiseText("shop now")).toBe(true);
    });

    it("treats 'see all' as noise", () => {
      expect(isNoiseText("see all")).toBe(true);
    });

    it("treats 'learn more' as noise", () => {
      expect(isNoiseText("learn more")).toBe(true);
    });

    it("treats 'read more' as noise", () => {
      expect(isNoiseText("read more")).toBe(true);
    });

    it("is case-insensitive for chrome strings", () => {
      expect(isNoiseText("Add To Cart")).toBe(true);
    });
  });

  describe("short strings", () => {
    it("treats single character as noise", () => {
      expect(isNoiseText("A")).toBe(true);
    });

    it("treats two-character string as noise", () => {
      expect(isNoiseText("ea")).toBe(true);
    });
  });

  describe("empty / whitespace", () => {
    it("treats empty string as noise", () => {
      expect(isNoiseText("")).toBe(true);
    });

    it("treats whitespace-only string as noise", () => {
      expect(isNoiseText("   ")).toBe(true);
    });
  });

  describe("pagination and reviews", () => {
    it("treats pagination like 1/5 as noise", () => {
      expect(isNoiseText("1/5")).toBe(true);
    });

    it("treats review string as noise", () => {
      expect(isNoiseText("4.5 out of 5 stars")).toBe(true);
    });

    it("treats limit text as noise", () => {
      expect(isNoiseText("Limit 2 per customer")).toBe(true);
    });
  });

  describe("normal content", () => {
    it("does not treat a normal sentence as noise", () => {
      expect(isNoiseText("Hello world this is content")).toBe(false);
    });

    it("does not treat a multi-word article title as noise", () => {
      expect(isNoiseText("How to improve accessibility on the web")).toBe(false);
    });

    it("does not treat a product description sentence as noise", () => {
      expect(isNoiseText("This product is made from recycled materials.")).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// isPromotionalParagraph
// ---------------------------------------------------------------------------

describe("isPromotionalParagraph", () => {
  describe("short action-verb CTAs", () => {
    it("treats 'Shop now and save big' as promotional", () => {
      expect(isPromotionalParagraph("Shop now and save big")).toBe(true);
    });

    it("treats 'Grab these deals today' as promotional", () => {
      expect(isPromotionalParagraph("Grab these deals today")).toBe(true);
    });

    it("treats 'Buy today and get free delivery' as promotional", () => {
      expect(isPromotionalParagraph("Buy today and get free delivery")).toBe(true);
    });

    it("treats 'Order now' as promotional", () => {
      expect(isPromotionalParagraph("Order now")).toBe(true);
    });

    it("treats 'Discover our latest range' as promotional", () => {
      expect(isPromotionalParagraph("Discover our latest range")).toBe(true);
    });

    it("treats 'Browse our full selection' as promotional", () => {
      expect(isPromotionalParagraph("Browse our full selection")).toBe(true);
    });

    it("treats 'Save big on groceries now' as promotional", () => {
      expect(isPromotionalParagraph("Save big on groceries now")).toBe(true);
    });
  });

  describe("single capitalised word (category label)", () => {
    it("treats 'Electronics' as promotional", () => {
      expect(isPromotionalParagraph("Electronics")).toBe(true);
    });

    it("treats 'Beverages' as promotional", () => {
      expect(isPromotionalParagraph("Beverages")).toBe(true);
    });
  });

  describe("marketing keyword density", () => {
    it("treats copy with 2+ marketing keywords as promotional", () => {
      expect(
        isPromotionalParagraph("Shop online and get groceries at your fingertips"),
      ).toBe(true);
    });

    it("treats copy mentioning 'start shopping' and 'your door' as promotional", () => {
      expect(
        isPromotionalParagraph("Start shopping and have it delivered straight to your door"),
      ).toBe(true);
    });
  });

  describe("CTA-ending paragraphs", () => {
    it("treats a sentence ending with 'today' as promotional when short", () => {
      expect(isPromotionalParagraph("Get the best prices today")).toBe(true);
    });

    it("treats a sentence ending with 'now' as promotional when short", () => {
      expect(isPromotionalParagraph("Sign up and save now")).toBe(true);
    });
  });

  describe("normal prose", () => {
    it("does not treat a long factual paragraph as promotional", () => {
      expect(
        isPromotionalParagraph(
          "Accessibility refers to the design of products, devices, services, or environments for people who experience disabilities. The concept of accessible design and practice of accessible development ensures both direct access and indirect access.",
        ),
      ).toBe(false);
    });

    it("does not treat a plain multi-sentence paragraph as promotional", () => {
      expect(
        isPromotionalParagraph(
          "The store opens at nine in the morning. Staff are available to assist customers throughout the day. Parking is available at the rear of the building.",
        ),
      ).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// extractText
// ---------------------------------------------------------------------------

describe("extractText", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("extracts text from a simple paragraph", () => {
    setBody("<p>Hello world</p>");
    const p = document.querySelector("p")!;
    expect(extractText(p)).toBe("Hello world");
  });

  it("concatenates text from nested inline elements", () => {
    setBody("<p>Hello <strong>world</strong></p>");
    const p = document.querySelector("p")!;
    expect(extractText(p)).toBe("Hello world");
  });

  it("inserts a space at block-level boundaries", () => {
    setBody("<div><p>First</p><p>Second</p></div>");
    const div = document.querySelector("div")!;
    const result = extractText(div);
    expect(result).toContain("First");
    expect(result).toContain("Second");
  });

  it("skips hidden elements", () => {
    setBody('<p>Visible<span hidden> Hidden</span></p>');
    const p = document.querySelector("p")!;
    expect(extractText(p)).toBe("Visible");
  });

  it("skips aria-hidden elements", () => {
    setBody('<p>Real<span aria-hidden="true"> Ghost</span></p>');
    const p = document.querySelector("p")!;
    expect(extractText(p)).toBe("Real");
  });

  it("collapses excess whitespace", () => {
    setBody("<p>  Too   many   spaces  </p>");
    const p = document.querySelector("p")!;
    expect(extractText(p)).toBe("Too many spaces");
  });

  it("returns empty string for element with no text content", () => {
    setBody("<div><img src='x.png' /></div>");
    const div = document.querySelector("div")!;
    expect(extractText(div)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// deepQueryAll
// ---------------------------------------------------------------------------

describe("deepQueryAll", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("finds elements matching the selector in a flat DOM", () => {
    setBody("<a href='/a'>A</a><a href='/b'>B</a>");
    const results = deepQueryAll(document.body, "a[href]");
    expect(results).toHaveLength(2);
  });

  it("finds elements inside nested containers", () => {
    setBody("<nav><ul><li><a href='/home'>Home</a></li></ul></nav>");
    const results = deepQueryAll(document, "a[href]");
    expect(results).toHaveLength(1);
    expect((results[0] as HTMLAnchorElement).textContent).toBe("Home");
  });

  it("returns empty array when no elements match", () => {
    setBody("<div>No links here</div>");
    const results = deepQueryAll(document.body, "a[href]");
    expect(results).toHaveLength(0);
  });

  it("works with document as root", () => {
    setBody("<h1>Title</h1><h2>Subtitle</h2>");
    const results = deepQueryAll(document, "h1, h2");
    expect(results).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// extractPageSnapshot — integration tests
// ---------------------------------------------------------------------------

describe("extractPageSnapshot", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.title = "";
  });

  // -------------------------------------------------------------------------
  // Meta fields
  // -------------------------------------------------------------------------

  it("captures the document title", () => {
    document.title = "Test Page";
    setBody("<main><p>Some content that is long enough to pass scoring.</p></main>");
    const snapshot = extractPageSnapshot(document);
    expect(snapshot.title).toBe("Test Page");
  });

  it("falls back to 'Untitled' when title is empty", () => {
    document.title = "";
    setBody("<main></main>");
    const snapshot = extractPageSnapshot(document);
    expect(snapshot.title).toBe("Untitled");
  });

  // -------------------------------------------------------------------------
  // Headings
  // -------------------------------------------------------------------------

  it("extracts h1 headings", () => {
    setBody("<main><h1 id='main-heading'>Welcome</h1></main>");
    const snapshot = extractPageSnapshot(document);
    const h1 = snapshot.headings.find((h) => h.level === 1);
    expect(h1).toBeDefined();
    expect(h1!.text).toBe("Welcome");
    expect(h1!.id).toBe("main-heading");
  });

  it("extracts multiple heading levels in order", () => {
    setBody("<main><h1>Title</h1><h2>Section</h2><h3>Subsection</h3></main>");
    const snapshot = extractPageSnapshot(document);
    const levels = snapshot.headings.map((h) => h.level);
    expect(levels).toContain(1);
    expect(levels).toContain(2);
    expect(levels).toContain(3);
  });

  it("omits headings that are hidden", () => {
    setBody('<main><h2 hidden>Hidden heading</h2><h2>Visible heading</h2></main>');
    const snapshot = extractPageSnapshot(document);
    const texts = snapshot.headings.map((h) => h.text);
    expect(texts).not.toContain("Hidden heading");
    expect(texts).toContain("Visible heading");
  });

  it("omits heading id when element has no id attribute", () => {
    setBody("<main><h2>No ID here</h2></main>");
    const snapshot = extractPageSnapshot(document);
    const h = snapshot.headings.find((h) => h.text === "No ID here");
    expect(h).toBeDefined();
    expect(h!.id).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Nav links
  // -------------------------------------------------------------------------

  it("extracts links from a <nav> element", () => {
    setBody(`
      <nav>
        <a href="/home">Home</a>
        <a href="/about">About</a>
      </nav>
    `);
    const snapshot = extractPageSnapshot(document);
    const texts = snapshot.navLinks.map((l) => l.text);
    expect(texts).toContain("Home");
    expect(texts).toContain("About");
  });

  it("marks current nav link via aria-current='page'", () => {
    setBody(`
      <nav>
        <a href="/home" aria-current="page">Home</a>
        <a href="/about">About</a>
      </nav>
    `);
    const snapshot = extractPageSnapshot(document);
    const current = snapshot.navLinks.find((l) => l.isCurrent);
    expect(current).toBeDefined();
    expect(current!.text).toBe("Home");
  });

  it("falls back to .nav class links when no <nav> element", () => {
    setBody(`
      <div class="nav">
        <a href="/products">Products</a>
        <a href="/contact">Contact</a>
      </div>
    `);
    const snapshot = extractPageSnapshot(document);
    const texts = snapshot.navLinks.map((l) => l.text);
    expect(texts).toContain("Products");
    expect(texts).toContain("Contact");
  });

  it("falls back to header links when no nav or .nav", () => {
    setBody(`
      <header>
        <a href="/login">Login</a>
        <a href="/signup">Sign Up</a>
      </header>
    `);
    const snapshot = extractPageSnapshot(document);
    const texts = snapshot.navLinks.map((l) => l.text);
    expect(texts).toContain("Login");
  });

  it("deduplicates nav links with the same href", () => {
    setBody(`
      <nav>
        <a href="/home">Home</a>
        <a href="/home">Home again</a>
      </nav>
    `);
    const snapshot = extractPageSnapshot(document);
    const homeLinks = snapshot.navLinks.filter((l) => l.text === "Home");
    expect(homeLinks).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // Forms
  // -------------------------------------------------------------------------

  it("extracts a form with labelled inputs", () => {
    setBody(`
      <form method="post" action="/submit">
        <label for="fname">First name</label>
        <input type="text" id="fname" name="firstName" />
        <label for="email">Email address</label>
        <input type="email" id="email" name="email" required />
        <button type="submit">Submit</button>
      </form>
    `);
    const snapshot = extractPageSnapshot(document);
    expect(snapshot.forms).toHaveLength(1);
    const form = snapshot.forms[0];
    expect(form.method).toBe("POST");
    const fieldNames = form.fields.map((f) => f.name);
    expect(fieldNames).toContain("firstName");
    expect(fieldNames).toContain("email");
  });

  it("marks required fields", () => {
    setBody(`
      <form>
        <label for="q">Query</label>
        <input type="text" id="q" name="q" required />
      </form>
    `);
    const snapshot = extractPageSnapshot(document);
    const field = snapshot.forms[0].fields.find((f) => f.name === "q");
    expect(field!.required).toBe(true);
  });

  it("omits hidden input fields", () => {
    setBody(`
      <form>
        <input type="hidden" name="csrf" value="token123" />
        <label for="username">Username</label>
        <input type="text" id="username" name="username" />
      </form>
    `);
    const snapshot = extractPageSnapshot(document);
    const fieldTypes = snapshot.forms[0].fields.map((f) => f.type);
    expect(fieldTypes).not.toContain("hidden");
  });

  it("extracts select options", () => {
    setBody(`
      <form>
        <label for="colour">Colour</label>
        <select id="colour" name="colour">
          <option value="red">Red</option>
          <option value="blue">Blue</option>
        </select>
      </form>
    `);
    const snapshot = extractPageSnapshot(document);
    const select = snapshot.forms[0].fields.find((f) => f.type === "select");
    expect(select).toBeDefined();
    expect(select!.options).toHaveLength(2);
    const optionValues = select!.options!.map((o) => o.value);
    expect(optionValues).toContain("red");
    expect(optionValues).toContain("blue");
  });

  it("extracts textarea as a field", () => {
    setBody(`
      <form>
        <label for="msg">Message</label>
        <textarea id="msg" name="message"></textarea>
      </form>
    `);
    const snapshot = extractPageSnapshot(document);
    const field = snapshot.forms[0].fields.find((f) => f.type === "textarea");
    expect(field).toBeDefined();
    expect(field!.name).toBe("message");
  });

  // -------------------------------------------------------------------------
  // Search detection
  // -------------------------------------------------------------------------

  it("detects a search input by type='search'", () => {
    setBody(`
      <form action="/search" method="get">
        <input type="search" name="q" />
      </form>
    `);
    const snapshot = extractPageSnapshot(document);
    expect(snapshot.search).toBeDefined();
    expect(snapshot.search!.paramName).toBe("q");
  });

  it("detects a search input by name='q'", () => {
    setBody(`
      <form action="/results">
        <input type="text" name="q" />
      </form>
    `);
    const snapshot = extractPageSnapshot(document);
    expect(snapshot.search).toBeDefined();
    expect(snapshot.search!.paramName).toBe("q");
  });

  it("detects a search input by placeholder", () => {
    setBody(`
      <form>
        <input type="text" name="term" placeholder="Search products..." />
      </form>
    `);
    const snapshot = extractPageSnapshot(document);
    expect(snapshot.search).toBeDefined();
  });

  it("detects a search input inside a role=search landmark", () => {
    setBody(`
      <div role="search">
        <input type="text" name="s" />
      </div>
    `);
    const snapshot = extractPageSnapshot(document);
    expect(snapshot.search).toBeDefined();
    expect(snapshot.search!.paramName).toBe("s");
  });

  it("returns undefined search when no search input is present", () => {
    setBody("<main><p>No search form here.</p></main>");
    const snapshot = extractPageSnapshot(document);
    expect(snapshot.search).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Landmarks
  // -------------------------------------------------------------------------

  it("captures a nav landmark", () => {
    setBody("<nav aria-label='Primary'><a href='/'>Home</a></nav>");
    const snapshot = extractPageSnapshot(document);
    const nav = snapshot.landmarks.find((l) => l.role === "navigation");
    expect(nav).toBeDefined();
    expect(nav!.label).toBe("Primary");
  });

  it("captures a main landmark", () => {
    setBody("<main><p>Content</p></main>");
    const snapshot = extractPageSnapshot(document);
    const main = snapshot.landmarks.find((l) => l.role === "main");
    expect(main).toBeDefined();
  });

  it("captures footer as contentinfo landmark", () => {
    setBody("<footer><p>Footer content</p></footer>");
    const snapshot = extractPageSnapshot(document);
    const footer = snapshot.landmarks.find((l) => l.role === "contentinfo");
    expect(footer).toBeDefined();
  });

  it("does not include hidden landmarks", () => {
    setBody('<nav hidden><a href="/secret">Secret</a></nav>');
    const snapshot = extractPageSnapshot(document);
    expect(snapshot.landmarks).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Noise filtering in content
  // -------------------------------------------------------------------------

  it("excludes elements with noisy class names from content blocks", () => {
    setBody(`
      <main>
        <div class="product-card">
          <p>Product price</p>
        </div>
        <p>This is real editorial content that should appear in the output.</p>
      </main>
    `);
    const snapshot = extractPageSnapshot(document);
    const allText = snapshot.contentGroups
      .flatMap((g) => g.blocks)
      .map((b) => b.text);
    expect(allText).not.toContain("Product price");
    expect(allText.some((t) => t.includes("real editorial content"))).toBe(true);
  });

  it("excludes elements with noisy id from content blocks", () => {
    setBody(`
      <main>
        <div id="newsletter">
          <p>Sign up to our newsletter</p>
        </div>
        <p>This paragraph contains enough words to be kept by the extractor.</p>
      </main>
    `);
    const snapshot = extractPageSnapshot(document);
    const allText = snapshot.contentGroups
      .flatMap((g) => g.blocks)
      .map((b) => b.text);
    expect(allText).not.toContain("Sign up to our newsletter");
  });

  // -------------------------------------------------------------------------
  // Content block types
  // -------------------------------------------------------------------------

  it("extracts paragraph blocks from <main>", () => {
    setBody(`
      <main>
        <p>This is a sufficiently long paragraph that should be captured by the extractor without filtering.</p>
      </main>
    `);
    const snapshot = extractPageSnapshot(document);
    const paragraphs = snapshot.contentGroups
      .flatMap((g) => g.blocks)
      .filter((b) => b.type === "paragraph");
    expect(paragraphs.length).toBeGreaterThan(0);
  });

  it("extracts list items from <ul>", () => {
    setBody(`
      <main>
        <ul>
          <li>Item one with enough words to pass filtering</li>
          <li>Item two with enough words to pass filtering</li>
          <li>Item three with enough words to pass filtering</li>
        </ul>
      </main>
    `);
    const snapshot = extractPageSnapshot(document);
    const lists = snapshot.contentGroups
      .flatMap((g) => g.blocks)
      .filter((b) => b.type === "list");
    expect(lists.length).toBeGreaterThan(0);
    expect(lists[0].items).toBeDefined();
    expect(lists[0].items!.length).toBe(3);
  });

  it("extracts blockquote blocks", () => {
    setBody(`
      <main>
        <blockquote>This is a meaningful quote worth extracting.</blockquote>
      </main>
    `);
    const snapshot = extractPageSnapshot(document);
    const quotes = snapshot.contentGroups
      .flatMap((g) => g.blocks)
      .filter((b) => b.type === "blockquote");
    expect(quotes.length).toBeGreaterThan(0);
  });

  it("extracts preformatted blocks", () => {
    setBody(`
      <main>
        <pre>const x = 1;</pre>
      </main>
    `);
    const snapshot = extractPageSnapshot(document);
    const pre = snapshot.contentGroups
      .flatMap((g) => g.blocks)
      .filter((b) => b.type === "preformatted");
    expect(pre.length).toBeGreaterThan(0);
  });

  it("extracts image alt text as image block", () => {
    setBody(`
      <main>
        <img src="/hero.jpg" alt="A team of engineers collaborating on a project" />
      </main>
    `);
    const snapshot = extractPageSnapshot(document);
    const images = snapshot.contentGroups
      .flatMap((g) => g.blocks)
      .filter((b) => b.type === "image");
    expect(images.length).toBeGreaterThan(0);
    expect(images[0].alt).toBe("A team of engineers collaborating on a project");
  });

  it("skips images with empty alt text", () => {
    setBody('<main><img src="/decorative.png" alt="" /></main>');
    const snapshot = extractPageSnapshot(document);
    const images = snapshot.contentGroups
      .flatMap((g) => g.blocks)
      .filter((b) => b.type === "image");
    expect(images).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Buttons
  // -------------------------------------------------------------------------

  it("extracts standalone buttons outside forms", () => {
    setBody(`
      <main>
        <button type="button">Open menu</button>
      </main>
    `);
    const snapshot = extractPageSnapshot(document);
    const btn = snapshot.buttons.find((b) => b.text === "Open menu");
    expect(btn).toBeDefined();
  });

  it("excludes buttons that are inside forms", () => {
    setBody(`
      <form>
        <button type="submit">Submit form</button>
      </form>
    `);
    const snapshot = extractPageSnapshot(document);
    const btn = snapshot.buttons.find((b) => b.text === "Submit form");
    expect(btn).toBeUndefined();
  });

  it("excludes buttons with noisy text", () => {
    setBody(`
      <main>
        <button>Add to cart</button>
        <button>Open help panel</button>
      </main>
    `);
    const snapshot = extractPageSnapshot(document);
    const texts = snapshot.buttons.map((b) => b.text);
    expect(texts).not.toContain("Add to cart");
  });

  // -------------------------------------------------------------------------
  // Links
  // -------------------------------------------------------------------------

  it("excludes nav hrefs from the links list", () => {
    setBody(`
      <nav><a href="/home">Home</a></nav>
      <main>
        <p>Content paragraph with enough words here.</p>
        <a href="/home">Back to home</a>
      </main>
    `);
    const snapshot = extractPageSnapshot(document);
    const linkHrefs = snapshot.links.map((l) => l.href);
    const navHrefs = snapshot.navLinks.map((l) => l.href);
    for (const href of navHrefs) {
      expect(linkHrefs).not.toContain(href);
    }
  });

  it("marks links inside <footer> as isFooter=true", () => {
    setBody(`
      <footer>
        <a href="/privacy">Privacy Policy</a>
      </footer>
    `);
    const snapshot = extractPageSnapshot(document);
    const footerLink = snapshot.links.find((l) => l.text === "Privacy Policy");
    expect(footerLink).toBeDefined();
    expect(footerLink!.isFooter).toBe(true);
  });

  it("excludes fragment-only links from the links list", () => {
    setBody(`
      <main>
        <a href="#section-one">Skip to section</a>
        <p>Some real content that matters to the reader here.</p>
      </main>
    `);
    const snapshot = extractPageSnapshot(document);
    const texts = snapshot.links.map((l) => l.text);
    expect(texts).not.toContain("Skip to section");
  });
});

// ---------------------------------------------------------------------------
// Table extraction
// ---------------------------------------------------------------------------

describe("extractPageSnapshot – table extraction", () => {
  afterEach(() => { document.body.innerHTML = ""; document.title = ""; });

  it("extracts a table with headers and rows", () => {
    setBody(`<main><table>
      <thead><tr><th>Name</th><th>Age</th></tr></thead>
      <tbody><tr><td>Alice</td><td>30</td></tr><tr><td>Bob</td><td>25</td></tr></tbody>
    </table></main>`);
    const snapshot = extractPageSnapshot(document);
    const tables = snapshot.contentGroups.flatMap(g => g.blocks).filter(b => b.type === "table");
    expect(tables).toHaveLength(1);
    expect(tables[0].headers).toEqual(["Name", "Age"]);
    expect(tables[0].rows).toHaveLength(2);
    expect(tables[0].rows![0]).toEqual(["Alice", "30"]);
  });

  it("extracts a table without thead using first-row th elements", () => {
    setBody(`<main><table>
      <tr><th>Col A</th><th>Col B</th></tr>
      <tr><td>Data one here</td><td>Data two here</td></tr>
    </table></main>`);
    const snapshot = extractPageSnapshot(document);
    const tables = snapshot.contentGroups.flatMap(g => g.blocks).filter(b => b.type === "table");
    expect(tables).toHaveLength(1);
    expect(tables[0].headers).toEqual(["Col A", "Col B"]);
  });

  it("skips empty tables", () => {
    setBody(`<main><table><tbody></tbody></table><p>Some paragraph content that is long enough.</p></main>`);
    const snapshot = extractPageSnapshot(document);
    const tables = snapshot.contentGroups.flatMap(g => g.blocks).filter(b => b.type === "table");
    expect(tables).toHaveLength(0);
  });

  it("uses caption as summary text when available", () => {
    setBody(`<main><table>
      <caption>Sales Data</caption>
      <tbody><tr><td>Q1 revenue amount</td><td>100 thousand dollars</td></tr></tbody>
    </table></main>`);
    const snapshot = extractPageSnapshot(document);
    const tables = snapshot.contentGroups.flatMap(g => g.blocks).filter(b => b.type === "table");
    expect(tables[0].text).toBe("Sales Data");
  });

  it("filters rows where every cell is noise", () => {
    setBody(`<main><table>
      <tbody>
        <tr><td>$9.99</td><td>ea</td></tr>
        <tr><td>Actual content row here</td><td>With real data</td></tr>
      </tbody>
    </table></main>`);
    const snapshot = extractPageSnapshot(document);
    const tables = snapshot.contentGroups.flatMap(g => g.blocks).filter(b => b.type === "table");
    expect(tables[0].rows).toHaveLength(1);
    expect(tables[0].rows![0][0]).toBe("Actual content row here");
  });
});

// ---------------------------------------------------------------------------
// Definition list extraction
// ---------------------------------------------------------------------------

describe("extractPageSnapshot – definition list extraction", () => {
  afterEach(() => { document.body.innerHTML = ""; document.title = ""; });

  it("extracts a definition list with dt/dd pairs", () => {
    setBody(`<main><dl>
      <dt>HTML</dt><dd>HyperText Markup Language used for web pages</dd>
      <dt>CSS</dt><dd>Cascading Style Sheets for styling documents</dd>
    </dl></main>`);
    const snapshot = extractPageSnapshot(document);
    const dls = snapshot.contentGroups.flatMap(g => g.blocks).filter(b => b.type === "definition-list");
    expect(dls).toHaveLength(1);
    expect(dls[0].definitions).toHaveLength(2);
    expect(dls[0].definitions![0].term).toBe("HTML");
    expect(dls[0].definitions![0].description).toContain("HyperText");
  });

  it("pairs a dt with multiple following dd elements", () => {
    setBody(`<main><dl>
      <dt>Term with enough length</dt>
      <dd>First definition of the term above</dd>
      <dd>Second definition of the term above</dd>
    </dl></main>`);
    const snapshot = extractPageSnapshot(document);
    const dls = snapshot.contentGroups.flatMap(g => g.blocks).filter(b => b.type === "definition-list");
    expect(dls[0].definitions![0].description).toContain("First definition");
    expect(dls[0].definitions![0].description).toContain("Second definition");
  });

  it("skips definition lists with no valid pairs", () => {
    setBody(`<main><dl><dt>ea</dt><dd></dd></dl><p>Content here that is long enough to pass.</p></main>`);
    const snapshot = extractPageSnapshot(document);
    const dls = snapshot.contentGroups.flatMap(g => g.blocks).filter(b => b.type === "definition-list");
    expect(dls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Figure/figcaption handler
// ---------------------------------------------------------------------------

describe("extractPageSnapshot – figure/figcaption", () => {
  afterEach(() => { document.body.innerHTML = ""; document.title = ""; });

  it("extracts figure with img and figcaption", () => {
    setBody(`<main><figure>
      <img src="/photo.jpg" alt="A nice photo" />
      <figcaption>Photo of a beautiful sunset over the ocean</figcaption>
    </figure></main>`);
    const snapshot = extractPageSnapshot(document);
    const images = snapshot.contentGroups.flatMap(g => g.blocks).filter(b => b.type === "image");
    expect(images).toHaveLength(1);
    expect(images[0].alt).toBe("Photo of a beautiful sunset over the ocean");
  });

  it("falls back to alt text when no figcaption exists", () => {
    setBody(`<main><figure>
      <img src="/hero.jpg" alt="Hero image of team collaborating together" />
    </figure></main>`);
    const snapshot = extractPageSnapshot(document);
    const images = snapshot.contentGroups.flatMap(g => g.blocks).filter(b => b.type === "image");
    expect(images).toHaveLength(1);
    expect(images[0].text).toBe("Hero image of team collaborating together");
  });

  it("handles figure with picture element inside", () => {
    setBody(`<main><figure>
      <picture><source srcset="/photo.webp" type="image/webp" /><img src="/photo.jpg" alt="Responsive photo of nature" /></picture>
      <figcaption>Nature landscape from the mountains</figcaption>
    </figure></main>`);
    const snapshot = extractPageSnapshot(document);
    const images = snapshot.contentGroups.flatMap(g => g.blocks).filter(b => b.type === "image");
    expect(images).toHaveLength(1);
    expect(images[0].alt).toBe("Nature landscape from the mountains");
  });
});

// ---------------------------------------------------------------------------
// Lazy-loaded images
// ---------------------------------------------------------------------------

describe("extractPageSnapshot – lazy-loaded images", () => {
  afterEach(() => { document.body.innerHTML = ""; document.title = ""; });

  it("uses data-src when src is a placeholder", () => {
    setBody(`<main><img src="data:image/gif;base64,R0lGOD" data-src="/real-image.jpg" alt="Lazy loaded image description here" /></main>`);
    const snapshot = extractPageSnapshot(document);
    const images = snapshot.contentGroups.flatMap(g => g.blocks).filter(b => b.type === "image");
    expect(images).toHaveLength(1);
    expect(images[0].src).toContain("/real-image.jpg");
  });

  it("uses data-lazy-src as fallback", () => {
    setBody(`<main><img src="data:image/gif;base64,R0lGOD" data-lazy-src="/lazy.jpg" alt="Another lazy loaded image here" /></main>`);
    const snapshot = extractPageSnapshot(document);
    const images = snapshot.contentGroups.flatMap(g => g.blocks).filter(b => b.type === "image");
    expect(images[0].src).toContain("/lazy.jpg");
  });

  it("uses srcset first entry when src is placeholder", () => {
    setBody(`<main><img src="/placeholder.gif" srcset="/real-400.jpg 400w, /real-800.jpg 800w" alt="Srcset image with lazy loading" /></main>`);
    const snapshot = extractPageSnapshot(document);
    const images = snapshot.contentGroups.flatMap(g => g.blocks).filter(b => b.type === "image");
    expect(images[0].src).toContain("/real-400.jpg");
  });
});

// ---------------------------------------------------------------------------
// isHidden enhancements
// ---------------------------------------------------------------------------

describe("isHidden – enhanced checks", () => {
  afterEach(() => { document.body.innerHTML = ""; });

  it("returns true for element with inert attribute", () => {
    const el = createElement("div", { inert: "" });
    document.body.appendChild(el);
    expect(isHidden(el)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// details/summary handling
// ---------------------------------------------------------------------------

describe("extractPageSnapshot – details/summary", () => {
  afterEach(() => { document.body.innerHTML = ""; document.title = ""; });

  it("extracts summary as a heading-level-4 block", () => {
    setBody(`<main><details>
      <summary>Frequently Asked Questions</summary>
      <p>Here are answers to common questions that people ask.</p>
    </details></main>`);
    const snapshot = extractPageSnapshot(document);
    const blocks = snapshot.contentGroups.flatMap(g => g.blocks);
    const headings = blocks.filter(b => b.type === "heading");
    expect(headings.some(h => h.text === "Frequently Asked Questions" && h.level === 4)).toBe(true);
    const paras = blocks.filter(b => b.type === "paragraph");
    expect(paras.some(p => p.text.includes("answers to common questions"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ARIA widget roles
// ---------------------------------------------------------------------------

describe("extractPageSnapshot – ARIA widget roles", () => {
  afterEach(() => { document.body.innerHTML = ""; document.title = ""; });

  it("extracts role='img' with aria-label as image block", () => {
    setBody(`<main><div role="img" aria-label="Decorative illustration of a team working together"></div></main>`);
    const snapshot = extractPageSnapshot(document);
    const images = snapshot.contentGroups.flatMap(g => g.blocks).filter(b => b.type === "image");
    expect(images).toHaveLength(1);
    expect(images[0].alt).toBe("Decorative illustration of a team working together");
  });
});

// ---------------------------------------------------------------------------
// isNoisyElement – data-* attributes
// ---------------------------------------------------------------------------

describe("isNoisyElement – data-* attributes", () => {
  it("returns true when data-component matches noise pattern", () => {
    const el = createElement("div", { "data-component": "product-card" });
    expect(isNoisyElement(el)).toBe(true);
  });

  it("returns true when data-testid matches noise pattern", () => {
    const el = createElement("div", { "data-testid": "newsletter-form" });
    expect(isNoisyElement(el)).toBe(true);
  });

  it("returns true when data-type matches noise pattern", () => {
    const el = createElement("div", { "data-type": "sidebar-widget" });
    expect(isNoisyElement(el)).toBe(true);
  });

  it("returns false when data-* attributes are clean", () => {
    const el = createElement("div", { "data-component": "article-content" });
    expect(isNoisyElement(el)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Live region filtering
// ---------------------------------------------------------------------------

describe("extractPageSnapshot – live region filtering", () => {
  afterEach(() => { document.body.innerHTML = ""; document.title = ""; });

  it("skips elements with role='alert'", () => {
    setBody(`<main>
      <div role="alert"><p>Session expired please log in again</p></div>
      <p>This is the real content that should be kept by extractor.</p>
    </main>`);
    const snapshot = extractPageSnapshot(document);
    const texts = snapshot.contentGroups.flatMap(g => g.blocks).map(b => b.text);
    expect(texts.some(t => t.includes("Session expired"))).toBe(false);
    expect(texts.some(t => t.includes("real content"))).toBe(true);
  });

  it("skips elements with role='status'", () => {
    setBody(`<main>
      <div role="status"><p>Loading content please wait a moment</p></div>
      <p>Actual page content that should appear in output.</p>
    </main>`);
    const snapshot = extractPageSnapshot(document);
    const texts = snapshot.contentGroups.flatMap(g => g.blocks).map(b => b.text);
    expect(texts.some(t => t.includes("Loading content"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Link protocol filtering
// ---------------------------------------------------------------------------

describe("extractPageSnapshot – link protocol filtering", () => {
  afterEach(() => { document.body.innerHTML = ""; document.title = ""; });

  it("filters tel: links from the links list", () => {
    setBody(`<main>
      <a href="tel:+1234567890">Call Us Now</a>
      <a href="/contact">Contact Page</a>
    </main>`);
    const snapshot = extractPageSnapshot(document);
    const hrefs = snapshot.links.map(l => l.href);
    expect(hrefs.some(h => h.startsWith("tel:"))).toBe(false);
  });

  it("filters mailto: links from the links list", () => {
    setBody(`<main>
      <a href="mailto:test@example.com">Email Us Today</a>
      <a href="/about">About Page</a>
    </main>`);
    const snapshot = extractPageSnapshot(document);
    const hrefs = snapshot.links.map(l => l.href);
    expect(hrefs.some(h => h.startsWith("mailto:"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Picture element
// ---------------------------------------------------------------------------

describe("extractPageSnapshot – picture element", () => {
  afterEach(() => { document.body.innerHTML = ""; document.title = ""; });

  it("extracts image from a standalone picture element", () => {
    setBody(`<main><picture>
      <source srcset="/photo.webp" type="image/webp" />
      <img src="/photo.jpg" alt="Responsive image with picture element" />
    </picture></main>`);
    const snapshot = extractPageSnapshot(document);
    const images = snapshot.contentGroups.flatMap(g => g.blocks).filter(b => b.type === "image");
    expect(images).toHaveLength(1);
    expect(images[0].alt).toBe("Responsive image with picture element");
  });
});
