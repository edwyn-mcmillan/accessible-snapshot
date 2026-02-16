chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "snapshot-ready" && typeof message.html === "string") {
    chrome.storage.session.set({ snapshotHtml: message.html }).then(() => {
      chrome.tabs.create({ url: chrome.runtime.getURL("snapshot.html") });
    });
    sendResponse({ ok: true });
  }
});

async function takeSnapshot(tab: chrome.tabs.Tab): Promise<void> {
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
}

chrome.action.onClicked.addListener(takeSnapshot);

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "take-snapshot") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) await takeSnapshot(tab);
  }
});
