# Kabayan-Tambayan Tools

A central hub that shows four project cards. Each card embeds its deployed application in an iframe, so users can work in every app without leaving the hub.

No build step: open `index.html` in a browser, or serve the folder with any static server (e.g. `npx serve .`).

## Structure

```
index.html       Layout, hero illustration (inline SVG), sections
css/styles.css   Design tokens (clay, bamboo, mango gold, molave), light/dark themes, weave patterns
js/app.js        Project manifest, card grid, filters, embedded workspaces, sidebar quick launch, theme
js/news.js       Sidebar Philippine news feed
assets/images/   Card background photos
```

## News feed

The sidebar reads the public RSS feeds of Inquirer and Rappler directly in the browser. Both send `Access-Control-Allow-Origin: *`, so no proxy or API key is needed. Topics and feed URLs are listed in `TOPICS` and `FEEDS` at the top of `js/news.js`. Results are cached for 10 minutes per tab and refresh every 15 minutes while the page is visible. Headlines link to the publisher's site; only the top story's image is loaded.

## Connecting your deployed apps

**For everyone (recommended):** set `embedUrl` on each project in the `TOOLS` manifest at the top of `js/app.js`:

```js
{ id: 'balikbayan', ..., embedUrl: 'https://balikbayan.your-domain.com' }
```

**From the UI (this browser only):** open a card, paste the URL and click **Connect**. This overrides the manifest value for that browser. Use **Change URL** or **Disconnect** to edit it.

The deployed app must allow being framed by the hub's origin. If a card stays blank, look for these headers on the app:

- `X-Frame-Options: DENY` or `SAMEORIGIN`: remove it.
- `Content-Security-Policy: frame-ancestors ...`: add the hub's origin.

**Free hosts with a cookie check (InfinityFree and its domains such as `*.infinityfree.me`, `*.rf.gd`, `*.epizy.com`):** before serving the site, these hosts run a JavaScript check that sets a `__test` cookie. Inside a cross-site iframe that cookie is third-party, browsers block it, and the frame stays blank. The hub detects these domains and shows an "Open in new tab" fallback. To embed for real, either host this hub on the same site as the app (e.g. upload it to `htdocs/hub/`) or move the app to a host without the check.

The iframe sandbox allows scripts, same-origin, forms, popups, downloads and modals. Adjust the `sandbox` attribute in `renderWorkspace()` if an app needs more.

## Adding a project

Add an entry to `TOOLS` (with `id`, `name`, `short`, `category`, `tone`, `summary`, `embedUrl`) and an icon under the same `id` in `ICONS`. A new category also needs an entry in `CATS`.

Deep links work: `index.html#tool-fiesta` opens that card on load.
