/* Sidebar news feed about the Philippines. Reads publishers' RSS feeds directly in the
   browser; Inquirer and Rappler serve them with Access-Control-Allow-Origin: *, so no proxy
   or API key is needed. */
(function () {
  'use strict';

  const FEEDS = {
    inq: { source: 'Inquirer', url: 'https://newsinfo.inquirer.net/feed' },
    inqBiz: { source: 'Inquirer', url: 'https://business.inquirer.net/feed' },
    inqGlobal: { source: 'Inquirer', url: 'https://globalnation.inquirer.net/feed' },
    inqSports: { source: 'Inquirer', url: 'https://sports.inquirer.net/feed' },
    inqEnt: { source: 'Inquirer', url: 'https://entertainment.inquirer.net/feed' },
    inqTech: { source: 'Inquirer', url: 'https://technology.inquirer.net/feed' },
    rappler: { source: 'Rappler', url: 'https://www.rappler.com/feed/' },
    rapplerNation: { source: 'Rappler', url: 'https://www.rappler.com/nation/feed/' },
    rapplerBiz: { source: 'Rappler', url: 'https://www.rappler.com/business/feed/' }
  };

  const TOPICS = [
    { id: 'top', label: 'Top', feeds: ['inq', 'rappler'] },
    { id: 'nation', label: 'Nation', feeds: ['rapplerNation', 'inq'] },
    { id: 'business', label: 'Business', feeds: ['inqBiz', 'rapplerBiz'] },
    { id: 'global', label: 'Global Pinoy', feeds: ['inqGlobal'] },
    { id: 'sports', label: 'Sports', feeds: ['inqSports'] },
    { id: 'showbiz', label: 'Showbiz', feeds: ['inqEnt'] },
    { id: 'tech', label: 'Tech', feeds: ['inqTech'] }
  ];

  const MAX_ITEMS = 12;
  const CACHE_MS = 10 * 60 * 1000;
  const REFRESH_MS = 15 * 60 * 1000;

  const listEl = document.getElementById('newsList');
  const topicsEl = document.getElementById('newsTopics');
  const metaEl = document.getElementById('newsMeta');
  const refreshBtn = document.getElementById('newsRefresh');
  if (!listEl) return;

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  const safeUrl = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch (e) { return ''; } };

  const storage = {
    get(area, key) { try { return JSON.parse(window[area].getItem('kt:' + key)); } catch (e) { return null; } },
    set(area, key, v) { try { window[area].setItem('kt:' + key, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };

  let topic = storage.get('localStorage', 'newsTopic') || 'top';
  if (!TOPICS.some((t) => t.id === topic)) topic = 'top';
  let requestId = 0;

  /* ---------- Fetch & parse ---------- */

  const textOf = (el, tag) => {
    const n = el.getElementsByTagName(tag)[0];
    return n ? n.textContent.trim() : '';
  };

  // Strip HTML from descriptions without executing anything (DOMParser documents are inert).
  const plain = (html) => (new DOMParser().parseFromString(html, 'text/html').body.textContent || '').replace(/\s+/g, ' ').trim();

  function imageOf(item) {
    const media = item.getElementsByTagName('media:content')[0] || item.getElementsByTagName('media:thumbnail')[0];
    if (media && media.getAttribute('url')) return media.getAttribute('url');
    const enc = item.getElementsByTagName('enclosure')[0];
    if (enc && /^image\//.test(enc.getAttribute('type') || '')) return enc.getAttribute('url');
    const content = textOf(item, 'content:encoded');
    if (content) {
      const img = new DOMParser().parseFromString(content, 'text/html').querySelector('img[src]');
      if (img) return img.getAttribute('src');
    }
    return '';
  }

  // Some feeds stamp Philippine time (UTC+8) as UTC, which puts stories hours in the future
  // and skews sorting against other sources. Treat any such future date as PHT.
  const PHT_OFFSET_MS = 8 * 60 * 60 * 1000;
  function pubDate(str) {
    const t = Date.parse(str) || 0;
    return t > Date.now() + 10 * 60 * 1000 ? t - PHT_OFFSET_MS : t;
  }

  async function fetchFeed(key) {
    const feed = FEEDS[key];
    const res = await fetch(feed.url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(feed.url + ' HTTP ' + res.status);
    const xml = new DOMParser().parseFromString(await res.text(), 'text/xml');
    if (xml.getElementsByTagName('parsererror').length) throw new Error(feed.url + ' is not valid RSS');
    return [...xml.getElementsByTagName('item')].map((item) => ({
      title: plain(textOf(item, 'title')),
      link: safeUrl(textOf(item, 'link')),
      date: pubDate(textOf(item, 'pubDate')),
      summary: plain(textOf(item, 'description')).slice(0, 180),
      image: safeUrl(imageOf(item)),
      source: feed.source
    })).filter((i) => i.title && i.link);
  }

  async function loadTopic(id, force) {
    const cacheKey = 'news:' + id;
    const cached = storage.get('sessionStorage', cacheKey);
    if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached;

    const t = TOPICS.find((x) => x.id === id);
    const results = await Promise.allSettled(t.feeds.map(fetchFeed));
    const ok = results.filter((r) => r.status === 'fulfilled');
    if (!ok.length) {
      // Offline or blocked: fall back to whatever we had, even if stale.
      if (cached) return { ...cached, stale: true };
      throw results[0].reason;
    }
    const seen = new Set();
    const items = ok.flatMap((r) => r.value)
      .filter((i) => !seen.has(i.link) && seen.add(i.link))
      .sort((a, b) => b.date - a.date)
      .slice(0, MAX_ITEMS);
    const data = { at: Date.now(), items, partial: ok.length < results.length };
    storage.set('sessionStorage', cacheKey, data);
    return data;
  }

  /* ---------- Render ---------- */

  const rtf = typeof Intl !== 'undefined' && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }) : null;
  function ago(ts) {
    if (!ts) return '';
    const mins = Math.round((ts - Date.now()) / 60000);
    if (!rtf) return new Date(ts).toLocaleString();
    if (Math.abs(mins) < 60) return rtf.format(mins, 'minute');
    const hrs = Math.round(mins / 60);
    if (Math.abs(hrs) < 24) return rtf.format(hrs, 'hour');
    return rtf.format(Math.round(hrs / 24), 'day');
  }

  function renderTopics() {
    topicsEl.innerHTML = TOPICS.map((t) =>
      `<button type="button" class="news-topic" data-topic="${t.id}" aria-pressed="${t.id === topic}">${esc(t.label)}</button>`).join('');
  }

  function renderLoading() {
    listEl.setAttribute('aria-busy', 'true');
    listEl.innerHTML = '<div class="news-skeleton feature"></div>' +
      Array.from({ length: 5 }, () => '<div class="news-skeleton"><span></span><span></span></div>').join('');
  }

  function renderItems(data) {
    listEl.setAttribute('aria-busy', 'false');
    if (!data.items.length) {
      listEl.innerHTML = '<p class="news-empty">Walang balita sa ngayon. No stories right now.</p>';
      return;
    }
    const featureIdx = data.items.findIndex((i) => i.image);
    const feature = featureIdx >= 0 ? data.items[featureIdx] : null;
    const rest = data.items.filter((_, i) => i !== featureIdx);
    const link = (i, inner, cls) => `<a class="${cls}" href="${esc(i.link)}" target="_blank" rel="noopener noreferrer">${inner}</a>`;

    listEl.innerHTML = `
      ${feature ? link(feature, `
        <span class="news-img"><img src="${esc(feature.image)}" alt="" loading="lazy" referrerpolicy="no-referrer"></span>
        <span class="news-src">${esc(feature.source)} · ${esc(ago(feature.date))}</span>
        <strong class="news-headline">${esc(feature.title)}</strong>
        ${feature.summary ? `<span class="news-sum">${esc(feature.summary)}</span>` : ''}`, 'news-feature') : ''}
      <ol class="news-items">
        ${rest.map((i) => `<li>${link(i, `
          <span class="news-title">${esc(i.title)}</span>
          <span class="news-info"><span class="news-badge" data-src="${esc(i.source)}">${esc(i.source)}</span>${esc(ago(i.date))}</span>`, 'news-item')}</li>`).join('')}
      </ol>`;

    // A hotlinked image may be blocked; drop it rather than show a broken icon.
    const img = listEl.querySelector('.news-img img');
    if (img) img.addEventListener('error', () => img.parentElement.remove(), { once: true });
  }

  function renderMeta(data) {
    const sources = [...new Set(TOPICS.find((t) => t.id === topic).feeds.map((k) => FEEDS[k].source))].join(' & ');
    const when = new Date(data.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    metaEl.innerHTML = `Updated ${esc(when)} · via ${esc(sources)}` +
      (data.stale ? ' · <strong>offline, showing saved stories</strong>' : data.partial ? ' · some sources unavailable' : '');
  }

  function renderError() {
    listEl.setAttribute('aria-busy', 'false');
    listEl.innerHTML = `
      <div class="news-error">
        <p><strong>Hindi ma-load ang balita.</strong> Couldn't reach the news sources. Check your connection and try again.</p>
        <button type="button" class="btn btn-ghost btn-sm" data-retry>Try again</button>
      </div>`;
    metaEl.textContent = '';
  }

  // quiet: background refresh. Keeps current stories on screen and on failure.
  async function show(force, quiet) {
    const id = ++requestId;
    if (!quiet) renderLoading();
    refreshBtn.disabled = true;
    try {
      const data = await loadTopic(topic, force);
      if (id !== requestId) return;
      renderItems(data);
      renderMeta(data);
    } catch (e) {
      if (id !== requestId) return;
      console.warn('News feed failed:', e);
      if (!quiet) renderError();
    } finally {
      if (id === requestId) refreshBtn.disabled = false;
    }
  }

  /* ---------- Boot ---------- */

  topicsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-topic]');
    if (!b || b.dataset.topic === topic) return;
    topic = b.dataset.topic;
    storage.set('localStorage', 'newsTopic', topic);
    renderTopics();
    show(false);
  });
  listEl.addEventListener('click', (e) => { if (e.target.closest('[data-retry]')) show(true); });
  refreshBtn.addEventListener('click', () => show(true));

  // Keep headlines fresh while the page is open, but don't poll from a hidden tab.
  setInterval(() => { if (document.visibilityState === 'visible') show(true, true); }, REFRESH_MS);

  renderTopics();
  show(false);
})();
