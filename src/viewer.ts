(async () => {
  const { snapshotHtml } = await chrome.storage.session.get("snapshotHtml");
  if (typeof snapshotHtml === "string" && snapshotHtml.length > 0) {
    document.open();
    document.write(snapshotHtml);
    document.close();
  } else {
    document.body.textContent =
      "No snapshot available. Click the extension icon on a page to generate one.";
  }
})();
