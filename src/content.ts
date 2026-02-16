import { extractPageSnapshot } from "./extractor.js";
import { renderSnapshot } from "./renderer.js";

(() => {
  const snapshot = extractPageSnapshot(document);
  const html = renderSnapshot(snapshot);
  chrome.runtime.sendMessage({ type: "snapshot-ready", html });
})();
