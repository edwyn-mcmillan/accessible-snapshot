import { extractPageSnapshot } from "./extractor.js";
import { renderSnapshot } from "./renderer.js";


(async () => {
  // Wait for the DOM to be parsed — DOMContentLoaded is sufficient for extraction
  // and fires well before images/fonts/scripts finish loading.
  if (document.readyState === "loading") {
    await new Promise<void>((resolve) => {
      document.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
    });
  }

  const snapshot = extractPageSnapshot(document);
  const { html, title, bodyHtml } = renderSnapshot(snapshot);
  chrome.runtime.sendMessage({ type: "snapshot-ready", html, title, bodyHtml });
})();
