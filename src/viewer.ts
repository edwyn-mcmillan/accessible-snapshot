(async () => {
  await initialLoad();

  // Image click → open lightbox
  document.addEventListener("click", (e) => {
    const img = (e.target as Element).closest("img[tabindex='0']");
    if (img instanceof HTMLImageElement) {
      e.preventDefault();
      openLightbox(img);
      return;
    }

    // Intercept all link clicks — delegate to the original tab
    const anchor = (e.target as Element).closest("a");
    if (!anchor) return;

    const href = anchor.getAttribute("href");
    if (!href) return;

    // Allow fragment-only links for in-page navigation
    if (href.startsWith("#")) return;

    e.preventDefault();

    // Show loading indicator
    showLoading();

    // Send navigation request to background
    chrome.runtime.sendMessage({ type: "navigate", href });
  });

  // Keyboard: Enter on focused image opens lightbox; Enter/Escape closes it
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === "Escape") {
      if (document.getElementById("snapshot-lightbox")) {
        e.preventDefault();
        closeLightbox();
        return;
      }
    }
    if (e.key === "Enter" && document.activeElement instanceof HTMLImageElement) {
      e.preventDefault();
      openLightbox(document.activeElement);
    }
  });

  // Listen for snapshot updates from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "snapshot-updated") {
      if (typeof message.bodyHtml === "string") {
        applySnapshot(message.title ?? "", message.bodyHtml);
      } else {
        updateSnapshot();
      }
    }
    if (message.type === "navigate-error") {
      hideLoading();
      showError(message.error);
    }
  });
})();

async function initialLoad(): Promise<void> {
  const { snapshotHtml } = await chrome.storage.session.get("snapshotHtml");
  if (typeof snapshotHtml === "string" && snapshotHtml.length > 0) {
    document.open();
    document.write(snapshotHtml);
    document.close();
  } else {
    document.body.textContent =
      "No snapshot available. Click the extension icon on a page to generate one.";
  }
}

function applySnapshot(title: string, bodyHtml: string): void {
  document.title = title;
  document.body.innerHTML = bodyHtml;
}

async function updateSnapshot(): Promise<void> {
  const { snapshotHtml } = await chrome.storage.session.get("snapshotHtml");
  if (typeof snapshotHtml === "string" && snapshotHtml.length > 0) {
    // Full-HTML fallback: parse and extract body (only used when bodyHtml
    // is not available in the message, e.g. after a service worker restart).
    const parser = new DOMParser();
    const parsed = parser.parseFromString(snapshotHtml, "text/html");
    applySnapshot(parsed.title, parsed.body.innerHTML);
  }
}

let lightboxTrigger: HTMLImageElement | null = null;

function openLightbox(img: HTMLImageElement): void {
  closeLightbox();
  lightboxTrigger = img;

  const overlay = document.createElement("div");
  overlay.id = "snapshot-lightbox";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", img.alt ? `Enlarged: ${img.alt}` : "Enlarged image");
  overlay.tabIndex = 0;
  overlay.addEventListener("click", closeLightbox);

  const enlarged = document.createElement("img");
  enlarged.src = img.src;
  enlarged.alt = img.alt;

  overlay.appendChild(enlarged);
  document.body.appendChild(overlay);
  overlay.focus();
}

function closeLightbox(): void {
  document.getElementById("snapshot-lightbox")?.remove();
  lightboxTrigger?.focus();
  lightboxTrigger = null;
}

function showLoading(): void {
  // Remove existing indicator if any
  hideLoading();
  const indicator = document.createElement("div");
  indicator.id = "snapshot-loading";
  indicator.setAttribute("role", "status");
  indicator.setAttribute("aria-live", "polite");
  indicator.textContent = "Loading new snapshot...";
  Object.assign(indicator.style, {
    position: "fixed",
    top: "0",
    left: "0",
    right: "0",
    padding: "8px",
    background: "#1a73e8",
    color: "white",
    textAlign: "center",
    zIndex: "10000",
    fontSize: "14px",
  });
  document.body?.prepend(indicator);
}

function hideLoading(): void {
  document.getElementById("snapshot-loading")?.remove();
}

function showError(message: string): void {
  const banner = document.createElement("div");
  banner.setAttribute("role", "alert");
  banner.textContent = message;
  Object.assign(banner.style, {
    position: "fixed",
    top: "0",
    left: "0",
    right: "0",
    padding: "8px",
    background: "#d93025",
    color: "white",
    textAlign: "center",
    zIndex: "10000",
    fontSize: "14px",
  });
  document.body?.prepend(banner);
  setTimeout(() => banner.remove(), 5000);
}
