# Go Codes

A Chrome extension that maps short codes to URLs and triggers them from the omnibox. Mappings sync across devices via Chrome profile.

Type `go` in the address bar, hit space (or tab), enter a short code, press Enter — the active tab navigates to the mapped URL.

## Features

- **Omnibox keyword**: `go <code>` jumps to the mapped URL.
- **Sync across devices**: stored in `chrome.storage.sync` (one key per code).
- **Manage page**: click the toolbar icon to add, edit, or delete codes.
- **500-code limit** with live counter, progress bar, and color-coded warning thresholds.
- **System theme aware**: light/dark mode follows `prefers-color-scheme`.
- **Minimal permissions**: only `storage`. No tab tracking, no host permissions.

## Install (unpacked)

1. Clone or download this repo.
2. Open `chrome://extensions`.
3. Toggle **Developer mode** (top right).
4. Click **Load unpacked** and select the `src/` directory.
5. (Optional) Pin the extension from the puzzle-piece menu so the icon appears in the toolbar.

## Usage

### Add a code
1. Click the toolbar icon — opens the manage page.
2. Enter a short code (no spaces) and a URL. URLs without a scheme get `https://` prepended automatically.
3. Click **Add**.

### Use a code
In any new tab or the address bar:

```
go <space> <code> <Enter>
```

The active tab navigates to the URL mapped to `<code>`. Modifier keys (Ctrl/Cmd+Enter, etc.) follow Chrome's standard omnibox behavior — open in new tab, background tab, etc.

### Delete a code
Click the trash icon next to the row on the manage page.

## Customizing the omnibox keyword

The keyword is hardcoded to `go` in `src/manifest.json`. Chrome does not allow runtime changes to manifest values. To change it:

1. Edit `src/manifest.json` → `omnibox.keyword`.
2. Reload the extension at `chrome://extensions`.

## File structure

```
src/
├── manifest.json       MV3 manifest, omnibox + action config
├── background.js       Service worker: omnibox handler, toolbar click handler
├── manage.html         Manage UI markup
├── manage.css          Atom One palette + cyan accent
├── manage.js           CRUD logic against chrome.storage.sync
└── icons/              16/48/128 PNGs
```

## Storage schema

Each code is stored as its own top-level key in `chrome.storage.sync` (which is scoped per-extension, so no risk of collision with other extensions):

```
key:   "<shortcode>"
value: "<url>"
```

Keys starting with `_` are reserved for future metadata (e.g., settings). User-entered codes cannot begin with `_`.

Limits (Chrome):
- 8 192 bytes per item
- 512 items total per extension
- 102 400 bytes total

The extension caps users at 500 codes, leaving headroom.

## Design notes

- **Color**: Atom One palette (`#fafafa`/`#383a42` light, `#282c34`/`#abb2bf` dark) with cyan (`#0184bc`/`#56b6c2`) accent on focus rings, link hover, and progress fill. Buttons stay neutral charcoal.
- **Font**: system UI stack (zero bytes shipped).
- **No build step**: plain HTML/CSS/JS loaded directly.

## Roadmap ideas

- Import/export JSON for backup or migration
- Omnibox suggestions while typing
- Quick add via popup
- Bulk edit / search filter on the manage page

## License

MIT
