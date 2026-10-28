/* Hub shell: project manifest, card grid, filters, embedded app workspaces and theming. */
(function () {
  'use strict';

  // localStorage can be unavailable (private mode, blocked storage); never let that break the hub.
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem('kt:' + key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try { localStorage.setItem('kt:' + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    },
    remove(key) {
      try { localStorage.removeItem('kt:' + key); } catch (e) { /* ignore */ }
    }
  };

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);

  /* Project manifest. Set embedUrl to your deployed app's URL to make it the default for
     every visitor; a URL connected from the card UI overrides it in that browser only. */
  const TOOLS = [
    {
      id: 'transportation',
      name: 'Transportasiyon',
      short: 'Transportation',
      category: 'transportation',
      tone: 'clay',
      image: 'assets/images/terraces.jpg',
      focus: '50% 70%',
      credit: '',
      summary: 'Track vehicles, trips, routes and deliveries. Connect your transportation app to manage dispatch and fleet records without leaving the hub.',
      embedUrl: ''
    },
    {
      id: 'data',
      name: 'Pamamahala sa Dato',
      short: 'Data Management',
      category: 'data',
      tone: 'bamboo',
      image: 'assets/images/planting.jpg',
      focus: '50% 22%',
      credit: '',
      summary: 'Store, approve and organize records in one place. Connect your data management system to review and update entries inline.',
      embedUrl: ''
    },
    {
      id: 'finance',
      name: 'Mga Kita at Gastos',
      short: 'Income and Expense',
      category: 'finance',
      tone: 'gold',
      image: 'assets/images/winnowing.jpg',
      focus: '50% 8%',
      credit: '',
      summary: 'Record earnings and spending, follow cash flow and check balances. Connect your income and expense tracker to work with it here.',
      embedUrl: '',
      downloads: [
        {
          label: 'Windows Installer',
          meta: '.exe · 22.3 MB',
          url: 'https://github.com/icecoldcoffeemachiatomixed/income-expense-system/releases/download/v1.0.0/IncomeExpenseSystem-Setup-1.0.0.exe',
          sha256: '4d8c47fe2d3a6200a623a27a6afba21d4babbddb0f7cd17aeb7056ebf9b4c473'
        },
        {
          label: 'Portable',
          meta: '.zip · 34.7 MB',
          url: 'https://github.com/icecoldcoffeemachiatomixed/income-expense-system/releases/download/v1.0.0/IncomeExpenseSystem-1.0.0-portable.zip',
          sha256: 'd97d2abb0aab260214090146fac02143bde6336bf59941ee6b7f0f3335fed0e4'
        }
      ]
    },
    {
      id: 'production',
      name: 'Pagsusuri sa Produksyon',
      short: 'Production Analysis',
      category: 'production',
      tone: 'deep',
      image: 'assets/images/harvest.jpg',
      focus: '50% 14%',
      credit: 'Alden Anderson · 360nomad.org',
      summary: 'Measure output, yields and performance over time. Connect your production analysis dashboard to review results side by side with your other apps.',
      // ?embed=true skips Streamlit's auth redirect, which fails inside a cross-site iframe.
      embedUrl: 'https://dental-management-dashboard.streamlit.app/?embed=true'
    }
  ];

  const CATS = {
    transportation: 'Transportation',
    data: 'Data Management',
    finance: 'Income and Expense',
    production: 'Production Analysis'
  };

  const ICONS = {
    transportation: '<svg viewBox="0 0 32 32"><path d="M3 8h16v14H3zM19 12h6l4 5v5H19z"/><circle cx="9" cy="24" r="2.5"/><circle cx="24" cy="24" r="2.5"/></svg>',
    data: '<svg viewBox="0 0 32 32"><ellipse cx="16" cy="8" rx="10" ry="4"/><path d="M6 8v16c0 2.2 4.5 4 10 4s10-1.8 10-4V8M6 16c0 2.2 4.5 4 10 4s10-1.8 10-4"/></svg>',
    finance: '<svg viewBox="0 0 32 32"><path d="M10 26V8M5 13l5-5 5 5M22 6v18M17 19l5 5 5-5"/></svg>',
    production: '<svg viewBox="0 0 32 32"><path d="M4 27h24M8 23v-6M14 23V11M20 23v-8M26 23V6"/><path d="M7 13l6-5 6 4 7-7"/></svg>'
  };

  const EMPTY_FRAME = '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="9" width="38" height="30" rx="4"/><path d="M5 16h38M10 12.5h2M14 12.5h2"/><path d="M19 27l-4 2 4 2M29 27l4 2-4 2M26 24l-4 10"/></svg>';

  const grid = document.getElementById('toolGrid');
  const empty = document.getElementById('emptyState');
  const catWrap = document.getElementById('catFilters');
  const search = document.getElementById('toolSearch');
  let activeCat = 'all';

  /* Free hosts whose anti-bot check sets a cookie via JavaScript before serving the site.
     Inside a cross-site iframe that cookie is third-party, browsers block it, and the app
     never loads. It works only when the hub runs on the same site as the app. */
  const COOKIE_WALL_HOSTS = ['infinityfree.me', 'infinityfreeapp.com', 'epizy.com', 'rf.gd', 'great-site.net', 'free.nf', 'wuaze.com', 'kesug.com'];
  const siteOf = (host) => COOKIE_WALL_HOSTS.find((d) => host === d || host.endsWith('.' + d));
  function cookieWallFor(url) {
    let host;
    try { host = new URL(url).hostname; } catch (e) { return null; }
    const wall = siteOf(host);
    if (!wall) return null;
    const hub = location.hostname;
    // Same host as the hub means the cookie is first-party and the embed can work.
    return hub === host ? null : wall;
  }

  const embedUrlFor = (t) => store.get('embed:' + t.id, t.embedUrl || '');
  const hostOf = (url) => { try { return new URL(url).host; } catch (e) { return url; } };
  const toolOf = (card) => TOOLS.find((t) => t.id === card.dataset.id);

  /* ---------- Cards ---------- */

  function cardHTML(t, i) {
    return `
      <article class="tool-card" id="tool-${t.id}" data-id="${t.id}" data-cat="${t.category}" data-tone="${t.tone}">
        <div class="card-photo" aria-hidden="true" style="background-image:url('${esc(t.image)}');background-position:${esc(t.focus || 'center')}"></div>
        <div class="card-media">
          ${t.credit ? `<span class="photo-credit">Photo: ${esc(t.credit)}</span>` : ''}
        </div>
        <div class="card-body">
          <div class="card-top">
            <span class="tool-icon" aria-hidden="true">${ICONS[t.id]}</span>
            <div class="title-holder">
              <span class="cat-chip">Module ${String(i + 1).padStart(2, '0')}</span>
              <h3>${esc(t.name)}</h3>
            </div>
          </div>
          <p class="summary">${esc(t.summary)}</p>
          ${t.downloads ? `
          <div class="downloads">
            <span class="downloads-title">Download for Windows · v1.0.0</span>
            ${t.downloads.map((d) => `
              <a class="download-link" href="${esc(d.url)}" rel="noopener" title="SHA-256: ${esc(d.sha256)}">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>
                <span>${esc(d.label)}<small>${esc(d.meta)}</small></span>
              </a>`).join('')}
          </div>` : ''}
          <div class="card-actions">
            <button class="btn btn-primary js-launch" type="button" aria-expanded="false" aria-controls="ws-${t.id}"></button>
            <span class="status-dot" data-status></span>
          </div>
        </div>
        <div class="workspace" id="ws-${t.id}" hidden>
          <div class="ws-bar"></div>
          <div class="ws-body"></div>
        </div>
      </article>`;
  }

  function updateCardState(card) {
    const t = toolOf(card);
    const url = embedUrlFor(t);
    const open = card.classList.contains('is-open');
    const status = card.querySelector('[data-status]');
    status.classList.toggle('on', !!url);
    status.textContent = url ? 'Connected · ' + hostOf(url) : 'Not connected';
    const btn = card.querySelector('.js-launch');
    btn.textContent = open ? 'Running' : url ? 'Launch app' : 'Connect app';
    btn.setAttribute('aria-expanded', String(open));
    renderSideModules();
  }

  /* ---------- Sidebar quick launch ---------- */

  const sideModules = document.getElementById('sideModules');

  function renderSideModules() {
    if (!sideModules) return;
    sideModules.innerHTML = TOOLS.map((t) => {
      const on = !!embedUrlFor(t);
      const state = on ? 'Connected' : 'Not connected';
      return `
        <li>
          <button type="button" class="side-module" data-open="${t.id}" data-tone="${t.tone}">
            <span class="side-icon" aria-hidden="true">${ICONS[t.id]}</span>
            <span class="side-name">${esc(t.name)}<small>${esc(t.short)}</small></span>
            <span class="side-state${on ? ' on' : ''}" title="${state}"><span class="sr-only">${state}</span></span>
          </button>
        </li>`;
    }).join('');
  }

  /* ---------- Workspace ---------- */

  function renderWorkspace(card, editing) {
    const t = toolOf(card);
    const url = embedUrlFor(t);
    const bar = card.querySelector('.ws-bar');
    const body = card.querySelector('.ws-body');
    const closeBtn = `
      <button type="button" class="icon-btn" data-act="close" aria-label="Close ${esc(t.short)}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>`;

    if (!url || editing) {
      bar.innerHTML = `<span class="ws-title">${url ? 'Change deployment' : 'Connect your deployment'}</span>${closeBtn}`;
      body.innerHTML = `
        <form class="embed-config" data-embed-form novalidate>
          <label class="field">Deployed app URL for ${esc(t.short)}
            <input type="url" name="url" required placeholder="https://your-${t.id}-app.example.com" value="${esc(url)}">
          </label>
          <button class="btn btn-primary btn-sm" type="submit">${url ? 'Save' : 'Connect'}</button>
          ${url ? '<button class="btn btn-ghost btn-sm" type="button" data-act="cancel">Cancel</button><button class="btn btn-ghost btn-sm" type="button" data-act="disconnect">Disconnect</button>' : ''}
        </form>
        <div class="embed-frame">
          <div class="embed-empty">
            ${EMPTY_FRAME}
            <p><strong>${url ? 'Enter the new URL above.' : 'No deployment connected yet.'}</strong></p>
            <p class="embed-help">Paste the URL of your hosted ${esc(t.short)} app and it will run inside this card.</p>
          </div>
        </div>
        <p class="note">The app must allow being framed by this hub. If the frame stays blank, check its <code>X-Frame-Options</code> or <code>Content-Security-Policy: frame-ancestors</code> headers.</p>`;
      const input = body.querySelector('input[name="url"]');
      if (editing || card.classList.contains('is-open')) input.focus({ preventScroll: true });
      return;
    }

    bar.innerHTML = `
      <span class="ws-title"><span class="live-dot" aria-hidden="true"></span><code>${esc(hostOf(url))}</code></span>
      <div class="ws-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-act="reload">Reload</button>
        <button type="button" class="btn btn-ghost btn-sm" data-act="fullscreen">Fullscreen</button>
        <a class="btn btn-ghost btn-sm" href="${esc(url)}" target="_blank" rel="noopener">New tab ↗</a>
        <button type="button" class="btn btn-ghost btn-sm" data-act="edit">Change URL</button>
        ${closeBtn}
      </div>`;
    const wall = cookieWallFor(url);
    body.innerHTML = `
      ${wall ? `
        <div class="note warn-note">
          <strong>This host blocks embedding on its free plan.</strong>
          ${esc(wall)} runs a cookie-based security check before showing your app. Browsers block that cookie inside another site's frame, so the frame below will likely stay blank.
          Fix it by hosting this hub on the same site as the app (e.g. upload it to a <code>/hub</code> folder there), or by moving the app to a host without the check.
          <div class="warn-actions"><a class="btn btn-primary btn-sm" href="${esc(url)}" target="_blank" rel="noopener">Open ${esc(t.short)} in a new tab ↗</a></div>
        </div>` : ''}
      <div class="embed-frame">
        <iframe src="${esc(url)}" title="${esc(t.name)}" loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals"
          allow="fullscreen; clipboard-write" referrerpolicy="strict-origin-when-cross-origin"></iframe>
      </div>`;
  }

  function openTool(id, opts) {
    const card = document.getElementById('tool-' + id);
    if (!card) return;
    if (card.hidden) resetFilters();
    if (!card.classList.contains('is-open')) {
      card.classList.add('is-open');
      card.querySelector('.workspace').hidden = false;
      renderWorkspace(card);
      updateCardState(card);
    }
    if (!opts || opts.scroll !== false) {
      requestAnimationFrame(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
    history.replaceState(null, '', '#tool-' + id);
  }

  function closeTool(card) {
    card.classList.remove('is-open');
    card.querySelector('.workspace').hidden = true;
    card.querySelector('.ws-bar').innerHTML = '';
    card.querySelector('.ws-body').innerHTML = '';
    updateCardState(card);
    card.querySelector('.js-launch').focus();
    if (location.hash === '#tool-' + card.dataset.id) history.replaceState(null, '', '#workspace');
  }

  function handleAction(card, act) {
    const t = toolOf(card);
    const iframe = card.querySelector('iframe');
    switch (act) {
      case 'close': closeTool(card); break;
      case 'edit': renderWorkspace(card, true); break;
      case 'cancel': renderWorkspace(card); break;
      case 'disconnect':
        store.remove('embed:' + t.id);
        renderWorkspace(card); updateCardState(card);
        break;
      case 'reload':
        // Reassigning src reloads cross-origin frames, where contentWindow.location is off-limits.
        if (iframe) iframe.src = iframe.src;
        break;
      case 'fullscreen': {
        const frame = card.querySelector('.embed-frame');
        if (frame && frame.requestFullscreen) frame.requestFullscreen().catch(() => {});
        break;
      }
    }
  }

  /* ---------- Filters ---------- */

  function renderChips() {
    const counts = TOOLS.reduce((a, t) => ((a[t.category] = (a[t.category] || 0) + 1), a), {});
    catWrap.innerHTML = [['all', 'All', TOOLS.length], ...Object.entries(CATS).map(([k, v]) => [k, v, counts[k] || 0])]
      .map(([k, label, n]) => `<button type="button" class="chip" data-cat="${k}" aria-pressed="${k === activeCat}">${label}<span class="count">${n}</span></button>`)
      .join('');
  }

  function applyFilters() {
    const q = search.value.trim().toLowerCase();
    let shown = 0;
    TOOLS.forEach((t) => {
      const card = document.getElementById('tool-' + t.id);
      const hay = (t.name + ' ' + t.summary + ' ' + CATS[t.category]).toLowerCase();
      const visible = (activeCat === 'all' || t.category === activeCat) && (!q || hay.includes(q));
      card.hidden = !visible;
      if (visible) shown++;
    });
    empty.hidden = shown > 0;
  }

  function resetFilters() {
    activeCat = 'all';
    search.value = '';
    renderChips();
    applyFilters();
  }

  /* ---------- Theme ---------- */

  function initTheme() {
    const btn = document.getElementById('themeToggle');
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : mq.matches;
    const sync = () => btn.setAttribute('aria-label', isDark() ? 'Switch to light mode' : 'Switch to dark mode');
    btn.addEventListener('click', () => {
      root.dataset.theme = isDark() ? 'light' : 'dark';
      store.set('theme', root.dataset.theme);
      sync();
    });
    mq.addEventListener('change', sync);
    sync();
  }

  /* ---------- Boot ---------- */

  grid.innerHTML = TOOLS.map(cardHTML).join('');
  grid.querySelectorAll('.tool-card').forEach(updateCardState);
  renderChips();
  initTheme();

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.tool-card');
    if (!card) return;
    if (e.target.closest('.js-launch')) { openTool(card.dataset.id); return; }
    const actBtn = e.target.closest('[data-act]');
    if (actBtn) handleAction(card, actBtn.dataset.act);
  });

  grid.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-embed-form]');
    if (!form) return;
    e.preventDefault();
    const card = form.closest('.tool-card');
    const input = form.elements.url;
    let parsed;
    try { parsed = new URL(input.value.trim()); } catch (err) { parsed = null; }
    if (!parsed || !/^https?:$/.test(parsed.protocol)) {
      input.setCustomValidity('Enter a full URL starting with https://');
      input.reportValidity();
      input.addEventListener('input', () => input.setCustomValidity(''), { once: true });
      return;
    }
    store.set('embed:' + card.dataset.id, parsed.href);
    renderWorkspace(card);
    updateCardState(card);
  });

  catWrap.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-cat]');
    if (!chip) return;
    activeCat = chip.dataset.cat;
    renderChips();
    applyFilters();
  });
  search.addEventListener('input', applyFilters);

  if (sideModules) sideModules.addEventListener('click', (e) => {
    const b = e.target.closest('[data-open]');
    if (b) openTool(b.dataset.open);
  });

  // Deep link: index.html#tool-fiesta opens that project on load.
  const m = /^#tool-([\w-]+)$/.exec(location.hash);
  if (m && TOOLS.some((t) => t.id === m[1])) openTool(m[1]);
})();
