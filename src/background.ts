let originalTabId: number | undefined;
let snapshotTabId: number | undefined;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "snapshot-ready" && typeof message.html === "string") {
    // Write to storage in the background — needed for fresh tab loads but
    // must not block the viewer update.
    chrome.storage.session.set({ snapshotHtml: message.html });

    // Resolve the snapshot tab ID and send the update without waiting for
    // the storage write above to complete.
    (async () => {
      let snapTabId = snapshotTabId;
      if (snapTabId === undefined) {
        const stored = await chrome.storage.session.get("snapshotTabId");
        snapTabId = stored.snapshotTabId as number | undefined;
      }

      if (snapTabId !== undefined) {
        chrome.tabs
          .sendMessage(snapTabId, {
            type: "snapshot-updated",
            title: message.title,
            bodyHtml: message.bodyHtml,
          })
          .then(() => {
            // Tab is alive — bring it into focus
            chrome.tabs.update(snapTabId!, { active: true }).catch(() => {});
          })
          .catch(async () => {
            // Snapshot tab may have been closed — open a new one
            const tab = await chrome.tabs.create({
              url: chrome.runtime.getURL("snapshot.html"),
            });
            snapshotTabId = tab.id;
            await chrome.storage.session.set({ snapshotTabId: tab.id });
          });
      } else {
        const tab = await chrome.tabs.create({
          url: chrome.runtime.getURL("snapshot.html"),
        });
        snapshotTabId = tab.id;
        await chrome.storage.session.set({ snapshotTabId: tab.id });
      }
    })();

    sendResponse({ ok: true });
  }

  if (message.type === "navigate" && typeof message.href === "string") {
    handleNavigate(message.href);
    sendResponse({ ok: true });
  }


});

async function notifyNavigateError(error: string): Promise<void> {
  let snapTabId = snapshotTabId;
  if (snapTabId === undefined) {
    const stored = await chrome.storage.session.get("snapshotTabId");
    snapTabId = stored.snapshotTabId as number | undefined;
  }
  if (snapTabId !== undefined) {
    chrome.tabs
      .sendMessage(snapTabId, { type: "navigate-error", error })
      .catch(() => {});
  }
}

async function handleNavigate(href: string): Promise<void> {
  // Read from session storage if the service worker was suspended since takeSnapshot
  let origTabId = originalTabId;
  if (origTabId === undefined) {
    const stored = await chrome.storage.session.get("originalTabId");
    origTabId = stored.originalTabId as number | undefined;
  }
  if (origTabId === undefined) return;

  // Don't attempt navigation to restricted URLs
  if (
    href.startsWith("chrome://") ||
    href.startsWith("about:") ||
    href.startsWith("chrome-extension://") ||
    href.startsWith("moz-extension://")
  ) {
    await notifyNavigateError("Cannot navigate to restricted URL: " + href);
    return;
  }

  // Capture tab ID in closure so changes to the module variable don't affect this listener
  const targetTabId = origTabId;

  // Register listener BEFORE navigating to avoid missing early loading events.
  // Inject as soon as the navigation commits (loading + URL) so the content
  // script can wait for DOMContentLoaded rather than a full page load.
  let lastInjectedUrl: string | undefined;
  const listener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
    if (tabId !== targetTabId) return;

    if (changeInfo.status === "loading" && changeInfo.url && changeInfo.url !== lastInjectedUrl) {
      lastInjectedUrl = changeInfo.url;
      chrome.scripting
        .executeScript({ target: { tabId }, files: ["dist/content.js"] })
        .catch(() => {
          // Frame not ready — will fall back to complete
          lastInjectedUrl = undefined;
        });
      return;
    }

    if (changeInfo.status === "complete") {
      chrome.tabs.onUpdated.removeListener(listener);
      if (!lastInjectedUrl) {
        // No loading+url event was captured — inject now as fallback
        chrome.scripting
          .executeScript({ target: { tabId }, files: ["dist/content.js"] })
          .catch((err) => {
            console.error("Accessible Snapshot: Failed to re-inject content script", err);
          });
      }
    }
  };

  chrome.tabs.onUpdated.addListener(listener);

  // Navigate the original tab (throws if tab no longer exists)
  try {
    await chrome.tabs.update(origTabId, { url: href });
  } catch {
    chrome.tabs.onUpdated.removeListener(listener);
    await notifyNavigateError("Original tab has been closed.");
    return;
  }
}

async function takeSnapshot(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id || !tab.url) return;

  const restricted =
    tab.url.startsWith("chrome://") ||
    tab.url.startsWith("about:") ||
    tab.url.startsWith("chrome-extension://") ||
    tab.url.startsWith("moz-extension://");

  if (restricted) return;

  originalTabId = tab.id;
  // Persist immediately so handleNavigate can recover it after a SW suspension
  await chrome.storage.session.set({ originalTabId: tab.id });

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
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab) await takeSnapshot(tab);
  }
});

// Track when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === snapshotTabId) {
    snapshotTabId = undefined;
    chrome.storage.session.remove("snapshotTabId");
  }
  if (tabId === originalTabId) {
    originalTabId = undefined;
    chrome.storage.session.remove("originalTabId");
  }
});
