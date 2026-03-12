# Shuck

**Your browsing trail, tagged and searchable.** A Chrome extension for capturing and organising web research: cases, full capture on every visit, notes, tags, stats, todo list, attachments, highlight selectors, and report export (JSON, HTML, CSV, Word)—all on your machine. No account, no server. Named after the [Black Shuck](https://en.wikipedia.org/wiki/Black_Shuck) Cryptid.

## Requirements

- **Google Chrome** (or a Chromium-based browser that supports Manifest V3 extensions)

## No web server needed

- **Landing page** — Open `web/index.html` in your browser (double‑click or File → Open).
- **Extension** — Runs entirely in Chrome.

## Install the extension (one-time)

1. Open Chrome → `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the **`extension`** folder inside this repository.

## Open the dashboard in a new tab

From the popup, click **Open dashboard** to open the full **Shuck dashboard** in a new tab. The dashboard gives you more space to work with:

- **Sidebar:** Captures, Images, Stats, Todo, Accounts, People, Groups, Graph, **Configuration**
- **Main area:** Case selector, capture toggle, search, tag filter, export/import, and the active panel (captures list, images, stats, todo list, accounts, people, groups, graph, or configuration form).
- **Configuration** (in the dashboard): Per-case — select a case and set its **ignore list** and **highlight selectors** (each case can have its own). Global toggles: capture visits, full capture, save images in report, theme. Click **Save configuration** to apply. A **↻ Refresh** button in the topbar reloads captures, history, and stats.

You can do everything from the dashboard: view and search captures, open capture details (Info, Tech, Source, Data, Notes), export (JSON, HTML, CSV, Word), import, and change all settings. To capture a page, use the Shuck icon on that page or right‑click → Shuck: Capture.

You can also open **Options** (right‑click the Shuck icon → Options) for configuration only; the options page has a link to open the full dashboard.

## Features

- **Cases** — Create and switch between cases. Visit log and captures are scoped to the current case.
- **Capture** — Toggle "Capture visits" on to log every page. When "Full capture on every visit" is on (options), each page is saved with screenshot, HTML, hash, and extracted data (emails, IPs). Debounced so the same tab isn't captured more than once per 8 seconds.
- **Captures vs History** — **Captures** are full snapshots (screenshot + HTML) you take manually or that are taken automatically on each visit when "Full capture on every visit" is on. **History** is a lightweight log of every page you visit when "Capture visits" is on (URL, title, time); it does not store full HTML/screenshot unless full capture is enabled.
- **Captures** — Manual "Snapshot this page" or right‑click → Shuck: Capture / Take note. Each capture stores URL, title, timestamp, screenshot, HTML, content hash, extracted data, tags, notes, attachments, and image URLs from the page.
- **History** — Visit log with full date and time for each page.
- **Notes** — In the capture detail view or via "Take note" (Shift+Enter submits in the note dialog).
- **Tags** — Add tags to captures, people, accounts, and groups; filter by tag; export tags in CSV and Obsidian.
- **Attachments** — Add attachment URLs (or names) to a capture in the detail Notes tab.
- **Highlight selectors** — In Settings or options: add text or regex patterns. Matches are highlighted in the Source tab of each capture and on the live page (click **Highlight**). Regex uses JavaScript `RegExp` (ECMAScript); uncheck "Regex" for literal text. Examples: `\bword\b` (whole word), `@\w+` (mentions), `#[a-zA-Z0-9_]+` (hashtags).
- **Stats** — Visual overview: cards for captures/visits/tags, bar chart by tag, and recent captures.
- **Todo list** — Per-case checklist. In the dashboard: **Load OSINT template** for a full OSINT investigation checklist (Domain & DNS, Social Media, People & Identity, Email & Phone, Infrastructure, Documents & Leaks, Organisations, Financial, Geospatial, Legal & Records, Verification & Reporting). Progress bar shows % complete. Double-click a task to edit; use the × to delete. Add tasks with an optional section.
- **Search** — Search across URL, title, notes, and stored HTML.
- **Page technologies & server headers** — On each capture, Shuck detects technologies (e.g. React, jQuery, WordPress, Google Analytics, Bootstrap, Nginx, PHP) from script/link/meta and from `window` globals, and records relevant HTTP response headers (e.g. Server, X-Powered-By, X-Generator). Shown in the **Tech** tab of the capture detail and in report exports.
- **People, Accounts, Groups** — Track people, link them to accounts and groups; link accounts to captures. **Graph** panel shows connections between captures, people, accounts, and groups. Link captures to other captures or accounts from the detail **Links** tab.
- **Detail view** — Per capture: Info (screenshot, URL, timestamp, hash), **Tech** (detected technologies, server headers), Source (HTML with selector highlights), Data (emails, IPs), Notes (edit notes, tags, attachments, mark important), **Links** (link to other captures or accounts). Shift+Enter in the notes field saves.
- **Export** — **JSON** (full case data including configuration: per-case ignore list, highlight selectors, tag library, graph state, and global settings), **HTML** (audit report; optionally with screenshots; use browser Print → Save as PDF if you need a PDF), **CSV** (captures: URL, title, tags, notes, tech, etc.), **Word** (downloads report as .doc that Word can open), **Obsidian** (export case to an Obsidian vault: choose a folder to create a full vault with separate notes and screenshots, or get a single markdown file). Obsidian notes include **links** between captures, people, accounts, and groups (matching the Graph panel). Each note is tagged with its **type** (capture, person, account, group, index, todo) and the **case** (e.g. `case-MyCase`), plus any tags you added in the extension. Filter by `#case-CaseName` in Obsidian’s graph or Dataview to show one case.
- **Import** — Import from a previously exported JSON file (merge or replace). Configuration is restored with the case.
- **Theme** — Default colour profile is purple. In options you can choose Purple, Teal, Blue, or Slate.

Data is stored only in Chrome local storage.

## Storage and privacy (OSINT)

- **Storage** — No capture limit; the extension uses Chrome’s unlimited storage. Full capture and inlined media are on by default. You can **disable inlining** in Dashboard → Configuration → Storage & privacy to save only raw HTML and the screenshot.
- **Inline media uses first load only** — When "Inline media when capturing" is on, we do **not** re-request images or CSS. We read what's already in the page: images are taken from the rendered `<img>` elements (via canvas), and stylesheet text from `document.styleSheets`. So you get inlined, offline-friendly HTML with **no second wave of requests** (good for OPSEC). Turn the option off to save only raw HTML and the screenshot.
- **No server-side requests** — The extension does not fetch HTTP headers or send requests to third parties. Tech detection uses only in-page content (scripts, meta, link tags, and `window` globals). No analytics or external APIs.

## Project layout

```
shuck/
├── extension/
│   ├── manifest.json
│   ├── icons/
│   │   └── icon128.png          # Shuck logo (toolbar, dashboard banner, options, popup)
│   ├── background.js
│   ├── content.js
│   ├── tech-detect.js
│   ├── options.html, options.js, options.css
│   ├── popup.html, popup.js, popup.css
│   ├── dashboard.html, dashboard.js, dashboard.css
│   ├── annotation.html, annotation.js, annotation.css
│   └── ...
├── web/
│   ├── index.html
│   ├── styles.css
│   └── script.js
└── README.md
```

## License

Creative Commons Zero v1.0 Universal