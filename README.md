# accessible-snapshot

A browser extension that generates a keyboard-first structural projection of any web page.

Click the toolbar icon (or press `F2` or `Alt+S`) on any page and a new tab opens with a semantically structured snapshot.

> **Status:** Early development (v0.1.0). Not yet published to any extension store.

## Keyboard navigation in the snapshot

| Key                 | Action                                    |
| ------------------- | ----------------------------------------- |
| `Tab` / `Shift+Tab` | Move to next / previous element           |
| `Enter`             | Activate link/button, or focus form input |

## Install (development)

Requires Node.js.

```sh
git clone <repo-url>
cd accessible-snapshot
npm install
npm run build
```

**Chrome:** `chrome://extensions` → enable Developer mode → Load unpacked → select the repo root.

**Firefox:** `about:debugging` → This Firefox → Load Temporary Add-on → select `manifest.json`.

### Build scripts

| Command             | Description                         |
| ------------------- | ----------------------------------- |
| `npm run build`     | One-off production build            |
| `npm run watch`     | Incremental rebuilds on file change |
| `npm run typecheck` | Type-check only (no emit)           |

## License

MIT
