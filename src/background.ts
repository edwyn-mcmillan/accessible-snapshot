chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "snapshot-ready" && typeof message.html === "string") {
    chrome.storage.session.set({ snapshotHtml: message.html }).then(() => {
      chrome.tabs.create({ url: chrome.runtime.getURL("snapshot.html") });
    });
    sendResponse({ ok: true });
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url) return;

  const restricted =
    tab.url.startsWith("chrome://") ||
    tab.url.startsWith("about:") ||
    tab.url.startsWith("chrome-extension://") ||
    tab.url.startsWith("moz-extension://");

  if (restricted) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["dist/content.js"],
    });
  } catch (err) {
    console.error("Accessible Snapshot: Failed to inject content script", err);
  }
});
