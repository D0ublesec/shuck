// Shuck - Background Service Worker
// Cases, capture toggle, ignore list, context menu, full HTML capture, visit log per case, tech detection
// Named after the Black Shuck Cryptid.

const STORAGE_KEY = 'shuck_captures';
const CASES_KEY = 'shuck_cases';
const CURRENT_CASE_KEY = 'shuck_current_case_id';
const SETTINGS_KEY = 'shuck_settings';
const ACCOUNTS_KEY = 'shuck_accounts_by_case';
const PEOPLE_KEY = 'shuck_people_by_case';
const GROUPS_KEY = 'shuck_groups_by_case';
const UUID_MIGRATED_KEY = 'shuck_uuid_migrated';

function isUuid(id) {
  return typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function randomUuid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const SELECTORS_KEY = 'shuck_selectors';
const CASE_CONFIG_KEY = 'shuck_case_config';
const GLOBAL_TAGS_KEY = 'shuck_global_tags';
const LAST_CAPTURE_KEY = 'shuck_last_capture_by_tab';
const TROUBLESHOOT_LOG_KEY = 'shuck_troubleshoot_log';
const TODO_BY_CASE_KEY = 'shuck_todo_by_case';
const MAX_TROUBLESHOOT_ENTRIES = 200;

const DEFAULT_SETTINGS = {
  captureEnabled: false,
  fullCapture: true,
  saveImagesInReport: true,
  theme: 'purple',
  blacklist: [],
  // Inline media: when true, re-fetches same-origin images/CSS for offline HTML. User can disable in Configuration for quieter traffic.
  inlineMediaOnCapture: true,
  // Graph: border colour for important (favourite) capture nodes
  importantNodeBorderColor: '#dc2626',
  // Graph: link line colours (auto-generated links vs manual links; person/group/account connection colours)
  graphEdgeColor: '#999999',
  graphEdgeManualColor: '#22c55e',
  graphEdgePersonGroupColor: '#2563eb',
  graphEdgeGroupGroupColor: '#7c3aed',
  graphEdgeAccountPersonColor: '#ea580c',
  // Graph: show same-domain links between captures
  graphShowDomainLinks: true,
  // Graph: when a filter is active, also show nodes linked to matching nodes
  graphShowLinkedNodes: false,
  // Captures list sort: 'newest' | 'oldest' | 'favourites'
  captureSortOrder: 'newest',
  // Optional overrides (hex): accentColor, tagColor
  accentColor: '',
  tagColor: '',
  // When viewing captured HTML in the Page tab (rendered view), hide common cookie/privacy banners so they don't block content
  hidePrivacyNoticesInRenderedView: true,
  // When on, capture events (ignore-list hits, skips, captures, failures) are recorded in the Troubleshooting log
  troubleshootLogEnabled: false,
  // Graph canvas/background colour (hex)
  graphCanvasColor: '#d3d3d3',
  // Graph node background colours (groups, people, accounts)
  graphNodeGroupColor: '#4c1d95',
  graphNodePersonColor: '#db2777',
  graphNodeAccountColor: '#fbcfe8',
  // 'light' or 'dark' – overall extension UI colour scheme (default light)
  colorScheme: 'light',
};

async function getCaseConfig(caseId) {
  const [settings, { [SELECTORS_KEY]: globalSelectors }, { [CASE_CONFIG_KEY]: allCaseConfig }] = await Promise.all([
    getSettings(),
    chrome.storage.local.get(SELECTORS_KEY),
    chrome.storage.local.get(CASE_CONFIG_KEY),
  ]);
  const caseConfig = (allCaseConfig && allCaseConfig[caseId]) || {};
  return {
    blacklist: caseConfig.blacklist !== undefined ? caseConfig.blacklist : (settings.blacklist || []),
    selectors: caseConfig.selectors !== undefined ? caseConfig.selectors : (globalSelectors || []),
    tags: Array.isArray(caseConfig.tags) ? caseConfig.tags : [],
    graphLayout: caseConfig.graphLayout && typeof caseConfig.graphLayout === 'object' ? caseConfig.graphLayout : {},
    graphViewTransform: caseConfig.graphViewTransform && typeof caseConfig.graphViewTransform === 'object' ? caseConfig.graphViewTransform : null,
    graphPan: caseConfig.graphPan && typeof caseConfig.graphPan === 'object' ? caseConfig.graphPan : null,
    graphZoom: typeof caseConfig.graphZoom === 'number' ? caseConfig.graphZoom : null,
  };
}

async function setCaseConfig(caseId, data) {
  const { [CASE_CONFIG_KEY]: allCaseConfig = {} } = await chrome.storage.local.get(CASE_CONFIG_KEY);
  const prev = allCaseConfig[caseId] || {};
  allCaseConfig[caseId] = { ...prev, ...data };
  await chrome.storage.local.set({ [CASE_CONFIG_KEY]: allCaseConfig });
}

async function getGlobalTags() {
  const { [GLOBAL_TAGS_KEY]: list } = await chrome.storage.local.get(GLOBAL_TAGS_KEY);
  return Array.isArray(list) ? list : [];
}

async function setGlobalTags(tags) {
  await chrome.storage.local.set({ [GLOBAL_TAGS_KEY]: Array.isArray(tags) ? tags : [] });
}

const BADGE_COLOR_CAPTURE_ON = '#dc2626';
const BADGE_COLOR_CAPTURING = '#22c55e';

function showCapturingBadge() {
  try {
    chrome.action.setBadgeText({ text: '\u25CF' });
    chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_CAPTURING });
  } catch (_) {}
}
function clearCapturingBadge() {
  try {
    chrome.action.setBadgeText({ text: '' });
  } catch (_) {}
}

async function updateCaptureStateBadge() {
  try {
    const s = await getSettings();
    if (s.captureEnabled) {
      chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_CAPTURE_ON });
      chrome.action.setBadgeText({ text: '\u25CF' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (_) {}
}

async function getSettings() {
  const { [SETTINGS_KEY]: s } = await chrome.storage.local.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...s };
}

async function setSettings(updates) {
  const s = await getSettings();
  await chrome.storage.local.set({ [SETTINGS_KEY]: { ...s, ...updates } });
}

async function getCases() {
  const { [CASES_KEY]: list } = await chrome.storage.local.get(CASES_KEY);
  return Array.isArray(list) ? list : [];
}

async function getCurrentCaseId() {
  const { [CURRENT_CASE_KEY]: id } = await chrome.storage.local.get(CURRENT_CASE_KEY);
  const list = await getCases();
  if (!list.length) return '';
  return (id && list.some(c => c.id === id)) ? id : list[0].id;
}

async function setCurrentCaseId(id) {
  await chrome.storage.local.set({ [CURRENT_CASE_KEY]: id });
}

async function appendTroubleshootLog(entry) {
  const s = await getSettings();
  if (s.troubleshootLogEnabled === false) return;
  const { [TROUBLESHOOT_LOG_KEY]: log = [] } = await chrome.storage.local.get(TROUBLESHOOT_LOG_KEY);
  const next = [...(Array.isArray(log) ? log : []), { ...entry, time: new Date().toISOString() }].slice(-MAX_TROUBLESHOOT_ENTRIES);
  await chrome.storage.local.set({ [TROUBLESHOOT_LOG_KEY]: next });
}

function urlMatchesBlacklist(url, blacklist) {
  if (!blacklist || !blacklist.length) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    for (const entry of blacklist) {
      const e = entry.trim().toLowerCase();
      if (!e) continue;
      if (e.startsWith('http')) {
        if (url.toLowerCase().startsWith(e)) return true;
      } else if (host === e || host.endsWith('.' + e)) return true;
    }
  } catch (_) {}
  return false;
}

async function runUuidMigrationIfNeeded() {
  const { [UUID_MIGRATED_KEY]: done } = await chrome.storage.local.get(UUID_MIGRATED_KEY);
  if (done) return;
  const { [STORAGE_KEY]: captureData, [ACCOUNTS_KEY]: accountsByCase, [PEOPLE_KEY]: peopleByCase, [GROUPS_KEY]: groupsByCase } = await chrome.storage.local.get([STORAGE_KEY, ACCOUNTS_KEY, PEOPLE_KEY, GROUPS_KEY]);
  const captures = Array.isArray(captureData?.captures) ? captureData.captures : [];
  const captureIdMap = {};
  const needCaptureMigration = captures.some((c) => !isUuid(c.id));
  if (needCaptureMigration) {
    for (const c of captures) {
      if (!isUuid(c.id)) {
        captureIdMap[c.id] = randomUuid();
      }
    }
  }
  const caseIds = new Set([
    ...(captures.map((c) => c.caseId || 'default')),
    ...Object.keys(accountsByCase || {}),
    ...Object.keys(peopleByCase || {}),
    ...Object.keys(groupsByCase || {}),
  ]);
  const accountIdMapByCase = {};
  const personIdMapByCase = {};
  const groupIdMapByCase = {};
  for (const caseId of caseIds) {
    const accounts = Array.isArray(accountsByCase?.[caseId]) ? accountsByCase[caseId] : [];
    const people = Array.isArray(peopleByCase?.[caseId]) ? peopleByCase[caseId] : [];
    const groups = Array.isArray(groupsByCase?.[caseId]) ? groupsByCase[caseId] : [];
    accountIdMapByCase[caseId] = {};
    personIdMapByCase[caseId] = {};
    groupIdMapByCase[caseId] = {};
    for (const a of accounts) {
      if (!isUuid(a.id)) accountIdMapByCase[caseId][a.id] = randomUuid();
    }
    for (const p of people) {
      if (!isUuid(p.id)) personIdMapByCase[caseId][p.id] = randomUuid();
    }
    for (const g of groups) {
      if (!isUuid(g.id)) groupIdMapByCase[caseId][g.id] = randomUuid();
    }
  }
  const map = (id, m) => (id && m[id] != null ? m[id] : id);
  const mapCase = (caseId, id, mByCase) => (id && mByCase[caseId]?.[id] != null ? mByCase[caseId][id] : id);
  if (needCaptureMigration) {
    for (const c of captures) {
      if (!isUuid(c.id)) {
        c.id = captureIdMap[c.id];
      }
      if (Array.isArray(c.links)) {
        c.links = c.links.map((l) => {
          if (!l.id) return l;
          if (l.type === 'capture') return { ...l, id: map(l.id, captureIdMap) };
          if (l.type === 'account') return { ...l, id: mapCase(c.caseId || 'default', l.id, accountIdMapByCase) };
          return l;
        });
      }
    }
  }
  for (const caseId of caseIds) {
    const accounts = Array.isArray(accountsByCase?.[caseId]) ? accountsByCase[caseId] : [];
    const people = Array.isArray(peopleByCase?.[caseId]) ? peopleByCase[caseId] : [];
    const groups = Array.isArray(groupsByCase?.[caseId]) ? groupsByCase[caseId] : [];
    const aMap = accountIdMapByCase[caseId] || {};
    const pMap = personIdMapByCase[caseId] || {};
    const gMap = groupIdMapByCase[caseId] || {};
    for (const a of accounts) {
      if (!isUuid(a.id)) a.id = aMap[a.id];
      if (a.personId) a.personId = map(a.personId, pMap);
      if (Array.isArray(a.links)) {
        a.links = a.links.map((l) => {
          if (!l.id) return l;
          if (l.type === 'capture') return { ...l, id: map(l.id, captureIdMap) };
          if (l.type === 'account') return { ...l, id: map(l.id, aMap) };
          return l;
        });
      }
    }
    for (const p of people) {
      if (!isUuid(p.id)) p.id = pMap[p.id];
      if (Array.isArray(p.groupIds)) p.groupIds = p.groupIds.map((gid) => map(gid, gMap));
    }
    for (const g of groups) {
      if (!isUuid(g.id)) g.id = gMap[g.id];
      if (Array.isArray(g.personIds)) g.personIds = g.personIds.map((pid) => map(pid, pMap));
      if (Array.isArray(g.groupIds)) g.groupIds = g.groupIds.map((gid) => map(gid, gMap));
    }
  }
  const hadAccountMaps = Object.values(accountIdMapByCase).some((m) => Object.keys(m).length > 0);
  const hadPersonMaps = Object.values(personIdMapByCase).some((m) => Object.keys(m).length > 0);
  const hadGroupMaps = Object.values(groupIdMapByCase).some((m) => Object.keys(m).length > 0);
  if (needCaptureMigration) {
    await chrome.storage.local.set({ [STORAGE_KEY]: { ...captureData, captures } });
  }
  if (hadAccountMaps) await chrome.storage.local.set({ [ACCOUNTS_KEY]: accountsByCase });
  if (hadPersonMaps) await chrome.storage.local.set({ [PEOPLE_KEY]: peopleByCase });
  if (hadGroupMaps) await chrome.storage.local.set({ [GROUPS_KEY]: groupsByCase });
  await chrome.storage.local.set({ [UUID_MIGRATED_KEY]: true });
}

async function getCaptures() {
  await runUuidMigrationIfNeeded();
  const { [STORAGE_KEY]: data } = await chrome.storage.local.get(STORAGE_KEY);
  return data || { captures: [], nextId: 1 };
}

function isQuotaError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return msg.includes('quota') || msg.includes('quotaexceeded') || msg.includes('storage full') || msg.includes('no space');
}

async function saveCaptures(data) {
  if (!data || !Array.isArray(data.captures)) {
    console.warn('Shuck: saveCaptures called with invalid data — aborting to protect existing data');
    return;
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: data });
}

async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str.slice(0, 500000));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function extractDataFromHtml(html) {
  const emails = new Set();
  const ips = new Set();
  if (!html) return { emails: [], ips: [] };
  const emailRe = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const ipRe = /\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
  let m;
  while ((m = emailRe.exec(html)) !== null) emails.add(m[0]);
  while ((m = ipRe.exec(html)) !== null) ips.add(m[0]);
  return { emails: [...emails], ips: [...ips] };
}

// Page signals collector (runs in page via executeScript)
function collectPageSignals() {
  const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
  const links = Array.from(document.querySelectorAll('link[href]')).map(l => l.href);
  const meta = Array.from(document.querySelectorAll('meta[name], meta[property]')).map(m => ({
    name: (m.getAttribute('name') || m.getAttribute('property') || '').toLowerCase(),
    content: m.getAttribute('content') || ''
  }));
  const globals = [];
  ['jQuery', '$', 'React', 'ReactDOM', 'Vue', 'angular', 'ng', 'wp', 'gtag', 'ga', 'dataLayer', 'fbq', 'twq', 'grecaptcha', 'Chart', 'Stripe', 'hljs', 'moment', 'lodash', '_', 'Alpine', 'htmx'].forEach(g => {
    try { if (typeof window[g] !== 'undefined') globals.push(g); } catch (_) {}
  });
  return { scripts, links, meta, globals };
}

const TECH_DATABASE = [
  { name: 'React', patterns: [{ type: 'script', match: /react|react-dom/i }, { type: 'global', match: 'React' }, { type: 'global', match: 'ReactDOM' }] },
  { name: 'Vue.js', patterns: [{ type: 'script', match: /vue\.js|vue\.min/i }, { type: 'global', match: 'Vue' }] },
  { name: 'Angular', patterns: [{ type: 'script', match: /angular/i }, { type: 'global', match: 'angular' }] },
  { name: 'jQuery', patterns: [{ type: 'script', match: /jquery/i }, { type: 'global', match: 'jQuery' }, { type: 'global', match: '$' }] },
  { name: 'Bootstrap', patterns: [{ type: 'script', match: /bootstrap/i }, { type: 'link', match: /bootstrap/i }] },
  { name: 'WordPress', patterns: [{ type: 'meta', name: 'generator', match: /wordpress/i }, { type: 'script', match: /wp-content|wp-includes/i }, { type: 'link', match: /wp-content/i }] },
  { name: 'Drupal', patterns: [{ type: 'meta', name: 'generator', match: /drupal/i }, { type: 'header', match: /x-drupal/i }] },
  { name: 'Google Analytics', patterns: [{ type: 'script', match: /google-analytics|googletagmanager|gtag|ga\.js/i }, { type: 'global', match: 'ga' }, { type: 'global', match: 'gtag' }] },
  { name: 'Google Tag Manager', patterns: [{ type: 'script', match: /googletagmanager\.com\/gtm\.js/i }, { type: 'global', match: 'dataLayer' }] },
  { name: 'Facebook Pixel', patterns: [{ type: 'script', match: /connect\.facebook\.net|fbq/i }, { type: 'global', match: 'fbq' }] },
  { name: 'Stripe', patterns: [{ type: 'script', match: /stripe\.com\/js/i }, { type: 'global', match: 'Stripe' }] },
  { name: 'Alpine.js', patterns: [{ type: 'script', match: /alpinejs/i }, { type: 'global', match: 'Alpine' }] },
  { name: 'HTMX', patterns: [{ type: 'script', match: /htmx/i }] },
  { name: 'Moment.js', patterns: [{ type: 'script', match: /moment\.js|moment\.min/i }, { type: 'global', match: 'moment' }] },
  { name: 'Lodash', patterns: [{ type: 'script', match: /lodash/i }, { type: 'global', match: '_' }] },
  { name: 'Chart.js', patterns: [{ type: 'script', match: /chart\.js|chartjs/i }, { type: 'global', match: 'Chart' }] },
  { name: 'reCAPTCHA', patterns: [{ type: 'script', match: /recaptcha|google\.com\/recaptcha/i }, { type: 'global', match: 'grecaptcha' }] },
  { name: 'Highlight.js', patterns: [{ type: 'script', match: /highlight\.js|hljs/i }, { type: 'global', match: 'hljs' }] },
  { name: 'Next.js', patterns: [{ type: 'script', match: /_next\/static/i }] },
  { name: 'Nuxt.js', patterns: [{ type: 'script', match: /_nuxt\//i }, { type: 'meta', name: 'generator', match: /nuxt/i }] },
  { name: 'Shopify', patterns: [{ type: 'script', match: /shopify\.com|cdn\.shopify/i }, { type: 'link', match: /shopify/i }] },
  { name: 'Wix', patterns: [{ type: 'script', match: /wix\.com|parastorage/i }] },
  { name: 'Squarespace', patterns: [{ type: 'script', match: /squarespace/i }] },
  { name: 'Google Fonts', patterns: [{ type: 'link', match: /fonts\.googleapis\.com|fonts\.google\.com/i }] },
  { name: 'Cloudflare', patterns: [{ type: 'header', match: /cf-ray|cloudflare/i }] },
  { name: 'PHP', patterns: [{ type: 'header', match: /x-powered-by.*php/i }] },
  { name: 'ASP.NET', patterns: [{ type: 'header', match: /x-aspnet|x-powered-by.*aspnet/i }] },
  { name: 'Node.js', patterns: [{ type: 'header', match: /x-powered-by.*express|node/i }] },
  { name: 'Nginx', patterns: [{ type: 'header', match: /server.*nginx/i }] },
  { name: 'Apache', patterns: [{ type: 'header', match: /server.*apache/i }] },
];

function detectTechnologies(signals, headers) {
  const found = new Map();
  const scripts = (signals && signals.scripts) || [];
  const links = (signals && signals.links) || [];
  const meta = (signals && signals.meta) || [];
  const globals = (signals && signals.globals) || [];
  const headerStr = headers ? Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\n').toLowerCase() : '';
  for (const tech of TECH_DATABASE) {
    for (const p of tech.patterns) {
      if (p.type === 'script' && scripts.some(s => (typeof p.match === 'string' ? s.includes(p.match) : p.match.test(s)))) { found.set(tech.name, true); break; }
      if (p.type === 'link' && links.some(href => (typeof p.match === 'string' ? href.includes(p.match) : p.match.test(href)))) { found.set(tech.name, true); break; }
      if (p.type === 'meta') {
        const nameOk = !p.name || meta.some(m => (m.name || '').toLowerCase() === p.name.toLowerCase());
        const contentOk = !p.match || meta.some(m => (typeof p.match === 'string' ? (m.content || '').includes(p.match) : p.match.test(m.content || '')));
        if (nameOk && contentOk) { found.set(tech.name, true); break; }
      }
      if (p.type === 'global' && globals.includes(p.match)) { found.set(tech.name, true); break; }
      if (p.type === 'header' && (typeof p.match === 'string' ? headerStr.includes(p.match.toLowerCase()) : p.match.test(headerStr))) { found.set(tech.name, true); break; }
    }
  }
  return [...found.keys()];
}

function getRelevantHeaders(headersObj) {
  const names = ['server', 'x-powered-by', 'x-generator', 'x-drupal-cache', 'x-aspnet-version', 'x-aspnetmvc-version', 'x-frame-options', 'x-content-type-options', 'cf-ray', 'x-request-id', 'via'];
  const out = {};
  const lower = {};
  for (const [k, v] of Object.entries(headersObj || {})) lower[k.toLowerCase()] = v;
  for (const n of names) if (lower[n]) out[n] = lower[n];
  return out;
}

// Serialize using only already-loaded content: canvas for <img> (no fetch), styleSheets for CSS. No extra requests.
// Runs in MAIN world. Returns { html } or { error }.
async function serializePageFromLoadedContent(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const maxLen = 4 * 1024 * 1024;
        let html = document.documentElement.outerHTML;
        if (html.length > maxLen) html = html.slice(0, maxLen) + '...[truncated]';

        const dataUrlsBySrc = {};
        const imgs = document.querySelectorAll('img[src]');
        for (const img of imgs) {
          if (!img.complete || !img.naturalWidth || !img.naturalHeight) continue;
          const src = img.src || img.getAttribute('src');
          if (!src || src.startsWith('data:')) continue;
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/png');
            if (dataUrl && dataUrl.length < 5 * 1024 * 1024) dataUrlsBySrc[src] = dataUrl;
          } catch (_) {}
        }
        let out = html;
        for (const [url, dataUrl] of Object.entries(dataUrlsBySrc)) {
          const esc = url.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
          try { out = out.replace(new RegExp(esc.replace(/\\/g, '\\\\'), 'g'), dataUrl); } catch (_) {}
        }

        const cssByHref = {};
        for (const sheet of document.styleSheets) {
          try {
            const href = sheet.href || '';
            if (!href || href.startsWith('data:')) continue;
            let css = '';
            for (const rule of sheet.cssRules || []) css += rule.cssText;
            if (css.length > 500000) css = css.slice(0, 500000);
            cssByHref[href] = css;
          } catch (_) {}
        }
        for (const [href, css] of Object.entries(cssByHref)) {
          const esc = href.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
          const linkRe = new RegExp('<link[^>]+rel=["\']stylesheet["\'][^>]+href=["\']' + esc.replace(/\\/g, '\\\\') + '["\'][^>]*>', 'gi');
          out = out.replace(linkRe, '<style>' + css.replace(/<\/style/gi, '\\x3c/style') + '</style>');
        }
        return out;
      },
      world: 'MAIN',
    });
    if (results && results[0] && results[0].result) return { html: results[0].result };
    return { error: 'No result' };
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

// Serialize page with same-origin images (and stylesheets) inlined as base64 via fetch (causes second request wave).
// Runs in MAIN world so fetch() is same-origin. Returns { html } or { error }.
async function serializePageWithInlineResources(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: async () => {
        const base = document.location.href;
        const baseOrigin = document.location.origin;
        let html = document.documentElement.outerHTML;
        const maxLen = 4 * 1024 * 1024;
        if (html.length > maxLen) html = html.slice(0, maxLen) + '...[truncated]';

        const resolve = (url) => {
          try { return new URL(url, base).href; } catch (_) { return null; }
        };
        const sameOrigin = (url) => {
          try { return new URL(url).origin === baseOrigin; } catch (_) { return false; }
        };

        const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
        const urls = [];
        let m;
        while ((m = imgRegex.exec(html)) !== null) {
          const u = resolve(m[1]);
          if (u && sameOrigin(u) && !u.startsWith('data:')) urls.push(u);
        }
        const uniq = [...new Set(urls)].slice(0, 100);
        const dataUrls = {};
        for (const url of uniq) {
          try {
            const r = await fetch(url, { credentials: 'same-origin' });
            if (!r.ok) continue;
            const blob = await r.blob();
            if (blob.size > 2 * 1024 * 1024) continue;
            const buf = await blob.arrayBuffer();
            const arr = new Uint8Array(buf);
            let b64 = '';
            const chunk = 8192;
            for (let i = 0; i < arr.length; i += chunk) {
              const sub = arr.subarray(i, Math.min(i + chunk, arr.length));
              b64 += String.fromCharCode.apply(null, sub);
            }
            dataUrls[url] = 'data:' + (blob.type || 'image/png') + ';base64,' + btoa(b64);
          } catch (_) {}
        }
        let out = html;
        for (const [url, dataUrl] of Object.entries(dataUrls)) {
          const esc = url.replace(/[.*+?^${'$'}()|[\]\\]/g, '\\$&');
          out = out.replace(new RegExp(esc.replace(/\\/g, '\\\\'), 'g'), dataUrl);
        }

        const linkRegex = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi;
        const cssUrls = [];
        while ((m = linkRegex.exec(html)) !== null) {
          const u = resolve(m[1]);
          if (u && sameOrigin(u) && !u.startsWith('data:')) cssUrls.push(u);
        }
        for (const url of [...new Set(cssUrls)].slice(0, 30)) {
          try {
            const r = await fetch(url, { credentials: 'same-origin' });
            if (!r.ok) continue;
            let css = await r.text();
            if (css.length > 500000) css = css.slice(0, 500000);
            const urlInCss = /url\(["']?([^"')]+)["']?\)/g;
            let cm;
            const toInline = [];
            while ((cm = urlInCss.exec(css)) !== null) {
              const u = resolve(cm[1].trim());
              if (u && sameOrigin(u) && !u.startsWith('data:')) toInline.push({ from: cm[0], url: u });
            }
            for (const { from, url: u } of toInline) {
              try {
                const res = await fetch(u, { credentials: 'same-origin' });
                if (!res.ok) continue;
                const blob = await res.blob();
                if (blob.size > 512 * 1024) continue;
                const buf = await blob.arrayBuffer();
                const arr = new Uint8Array(buf);
                let b64 = '';
                for (let i = 0; i < arr.length; i += 8192) b64 += String.fromCharCode.apply(null, arr.subarray(i, Math.min(i + 8192, arr.length)));
                css = css.split(from).join('url("data:' + (blob.type || 'application/octet-stream') + ';base64,' + btoa(b64) + '")');
              } catch (_) {}
            }
            const escUrl = url.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
            out = out.replace(new RegExp('<link[^>]+rel=["\']stylesheet["\'][^>]+href=["\']' + escUrl.replace(/\\/g, '\\\\') + '["\'][^>]*>', 'gi'), '<style>' + css + '</style>');
          } catch (_) {}
        }
        return out;
      },
      world: 'MAIN',
    });
    if (results && results[0] && results[0].result) return { html: results[0].result };
    return { error: 'No result' };
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

// Optional full capture on every page visit (when "Capture on visit" is on)
const AUTO_CAPTURE_DELAY_MS = 600;
// Only debounce when same URL (refresh/revisit) so different URLs from same domain always capture
const AUTO_CAPTURE_DEBOUNCE_SAME_URL_MS = 600;
const PENDING_CAPTURE_MAX_AGE_MS = 60000; // capture when tab activated within 60s

const pendingCaptureByTab = {}; // tabId -> { caseId, timestamp }
// Deduplicate auto-capture: only one scheduled per tab per URL (onCompleted + onUpdated + HistoryStateUpdated can all fire)
const scheduledAutoCaptureByTab = {}; // tabId -> { urlNorm, caseId, timeoutId }

async function maybeAutoCapture(tabId) {
  if (!tabId) return;
  const settings = await getSettings();
  if (!settings.captureEnabled || !settings.fullCapture) return;
  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch (_) {
    return;
  }
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;
  const caseId = await getCurrentCaseId();
  if (!caseId) {
    await appendTroubleshootLog({ type: 'capture_skipped', reason: 'no_case', url: tab.url });
    return; // No cases: don't auto-capture until user creates a case
  }
  const caseConfig = await getCaseConfig(caseId);
  if (urlMatchesBlacklist(tab.url, caseConfig.blacklist)) {
    await appendTroubleshootLog({ type: 'ignore_list_hit', url: tab.url, caseId });
    return;
  }
  const urlNorm = normalizeUrlForCompare(tab.url);
  // Skip if we already have a capture scheduled for this tab + URL (e.g. onCompleted and onUpdated both fired)
  const scheduled = scheduledAutoCaptureByTab[tabId];
  if (scheduled && scheduled.urlNorm === urlNorm) return;
  // Skip auto-capture only if this case already has a capture for this URL (with a preview). Other cases are independent.
  const data = await getCaptures();
  const existingWithUrl = (data.captures || []).find(c => (c.caseId || 'default') === (caseId || 'default') && normalizeUrlForCompare(c.url) === urlNorm);
  if (existingWithUrl && existingWithUrl.imageDataUrl) {
    await appendTroubleshootLog({ type: 'capture_skipped', reason: 'already_captured', url: tab.url, caseId });
    return;
  }

  if (scheduled && scheduled.timeoutId) clearTimeout(scheduled.timeoutId);
  const timeoutId = setTimeout(async () => {
    delete scheduledAutoCaptureByTab[tabId];
    try {
      const tabAgain = await chrome.tabs.get(tabId);
      if (!tabAgain.url || tabAgain.url.startsWith('chrome://') || tabAgain.url.startsWith('chrome-extension://')) return;
      const caseConfigAgain = await getCaseConfig(caseId);
      if (urlMatchesBlacklist(tabAgain.url, caseConfigAgain.blacklist)) {
        await appendTroubleshootLog({ type: 'ignore_list_hit', url: tabAgain.url, caseId });
        return;
      }
      const dataAgain = await getCaptures();
      const existingAgain = (dataAgain.captures || []).find(c => (c.caseId || 'default') === (caseId || 'default') && normalizeUrlForCompare(c.url) === normalizeUrlForCompare(tabAgain.url));
      if (existingAgain && existingAgain.imageDataUrl) {
        await appendTroubleshootLog({ type: 'capture_skipped', reason: 'already_captured', url: tabAgain.url, caseId });
        return;
      }
      if (!tabAgain.active) {
        pendingCaptureByTab[tabId] = { caseId, timestamp: Date.now() };
        return;
      }
      await doCapture(tabAgain, caseId, null, null);
    } catch (err) {
      if (err?.message !== 'No tab with id: ' + tabId) {
        console.warn('Shuck auto-capture failed:', err?.message || err);
      }
    }
  }, AUTO_CAPTURE_DELAY_MS);
  scheduledAutoCaptureByTab[tabId] = { urlNorm, caseId, timeoutId };
}

function normalizeUrlForCompare(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const u = new URL(url);
    u.hash = '';
    let s = u.toString();
    if (s.endsWith('/') && s.length > 1) s = s.slice(0, -1);
    return s;
  } catch (_) {
    return url;
  }
}

async function doPendingCaptureIfAny(tabId) {
  const pending = pendingCaptureByTab[tabId];
  if (!pending) return;
  const age = Date.now() - pending.timestamp;
  if (age > PENDING_CAPTURE_MAX_AGE_MS) {
    delete pendingCaptureByTab[tabId];
    return;
  }
  const settings = await getSettings();
  if (!settings.captureEnabled || !settings.fullCapture) {
    delete pendingCaptureByTab[tabId];
    return;
  }
  delete pendingCaptureByTab[tabId];
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;
    const caseConfig = await getCaseConfig(pending.caseId);
    if (urlMatchesBlacklist(tab.url, caseConfig.blacklist)) {
      await appendTroubleshootLog({ type: 'ignore_list_hit', url: tab.url, caseId: pending.caseId });
      return;
    }
    const data = await getCaptures();
    const urlNorm = normalizeUrlForCompare(tab.url);
    const existing = (data.captures || []).find(c => (c.caseId || 'default') === (pending.caseId || 'default') && normalizeUrlForCompare(c.url) === urlNorm);
    if (existing && existing.imageDataUrl) return;
    await doCapture(tab, pending.caseId, null, null);
  } catch (_) {}
}

chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId !== 0) return;
  maybeAutoCapture(details.tabId);
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== 0) return;
  maybeAutoCapture(details.tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') maybeAutoCapture(tabId);
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await doPendingCaptureIfAny(activeInfo.tabId);
});

// Context menus + ensure default case exists on first install
chrome.runtime.onInstalled.addListener(async () => {
  const { [CASES_KEY]: list } = await chrome.storage.local.get(CASES_KEY);
  if (!list || list.length === 0) {
    await chrome.storage.local.set({ [CASES_KEY]: [{ id: 'default', name: 'Default case', createdAt: new Date().toISOString() }] });
  }
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'shuck-capture', title: 'Shuck: Capture this page', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'shuck-save-screenshot', title: 'Shuck: Save screenshot to case', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'shuck-screenshot-annotate', title: 'Shuck: Screenshot with annotation', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'shuck-note', title: 'Shuck: Take note', contexts: ['page'] });
    chrome.contextMenus.create({ id: 'shuck-annotate-image', title: 'Shuck: Annotate this image', contexts: ['image'] });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'shuck-annotate-image' && info.srcUrl) {
    let url = chrome.runtime.getURL('annotation.html') + '?src=' + encodeURIComponent(info.srcUrl);
    if (tab && tab.id) url += '&tabId=' + tab.id;
    chrome.tabs.create({ url });
    return;
  }
  if (!tab || !tab.id || !tab.url || tab.url.startsWith('chrome://')) return;
  const caseId = await getCurrentCaseId();
  if (!caseId) return; // No cases: user must create a case first (e.g. from dashboard)
  const caseConfig = await getCaseConfig(caseId);
  if (urlMatchesBlacklist(tab.url, caseConfig.blacklist)) {
    await appendTroubleshootLog({ type: 'ignore_list_hit', url: tab.url, caseId });
    return;
  }

  if (info.menuItemId === 'shuck-capture') {
    try {
      const freshTab = await chrome.tabs.get(tab.id).catch(() => tab);
      await doCapture(freshTab, caseId, null, null, true);
      try { chrome.action.setBadgeBackgroundColor({ color: '#22c55e' }); chrome.action.setBadgeText({ text: '✓' }); } catch (_) {}
      setTimeout(() => { updateCaptureStateBadge(); }, 1500);
    } catch (err) {
      try { chrome.action.setBadgeBackgroundColor({ color: '#dc2626' }); chrome.action.setBadgeText({ text: '!' }); } catch (_) {}
      setTimeout(() => { updateCaptureStateBadge(); }, 2000);
    }
  } else if (info.menuItemId === 'shuck-save-screenshot') {
    try {
      const imageDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId || null, { format: 'png' });
      if (!imageDataUrl) return;
      const data = await getCaptures();
      const id = randomUuid();
      const capture = {
        id,
        caseId: caseId || 'default',
        url: tab.url || '',
        title: (tab.title || 'Screenshot').trim() || 'Screenshot',
        timestamp: new Date().toISOString(),
        contentHash: '',
        imageDataUrl,
        imageUrls: [],
        htmlContent: null,
        extractedData: { emails: [], ips: [] },
        technologies: [],
        serverHeaders: {},
        tags: [],
        notes: '',
        important: false,
        attachments: [],
        links: [],
        inlineFailed: false,
        captureSource: 'screenshot',
      };
      data.captures.unshift(capture);
      await saveCaptures(data);
      try { chrome.action.setBadgeBackgroundColor({ color: '#22c55e' }); chrome.action.setBadgeText({ text: '✓' }); } catch (_) {}
      setTimeout(() => { updateCaptureStateBadge(); }, 1500);
    } catch (err) {
      try { chrome.action.setBadgeBackgroundColor({ color: '#dc2626' }); chrome.action.setBadgeText({ text: '!' }); } catch (_) {}
      setTimeout(() => { updateCaptureStateBadge(); }, 2000);
    }
  } else if (info.menuItemId === 'shuck-screenshot-annotate') {
    try {
      const imageDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId || null, { format: 'png' });
      if (!imageDataUrl) return;
      const pendingKey = 'shuck_pending_screenshot_' + Date.now();
      await chrome.storage.local.set({ [pendingKey]: { imageDataUrl, url: tab.url || '', title: (tab.title || 'Screenshot').trim() || 'Screenshot' } });
      const annotationUrl = chrome.runtime.getURL('annotation.html') + '?pending=' + encodeURIComponent(pendingKey);
      chrome.tabs.create({ url: annotationUrl });
      try { chrome.action.setBadgeBackgroundColor({ color: '#22c55e' }); chrome.action.setBadgeText({ text: '✓' }); } catch (_) {}
      setTimeout(() => { updateCaptureStateBadge(); }, 1500);
    } catch (err) {
      try { chrome.action.setBadgeBackgroundColor({ color: '#dc2626' }); chrome.action.setBadgeText({ text: '!' }); } catch (_) {}
      setTimeout(() => { updateCaptureStateBadge(); }, 2000);
    }
  } else if (info.menuItemId === 'shuck-note') {
    chrome.tabs.sendMessage(tab.id, { action: 'openNoteDialog' }).catch(() => {
      chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }).then(() => {
        chrome.tabs.sendMessage(tab.id, { action: 'openNoteDialog' });
      }).catch((err) => {
        console.warn('Shuck: Note dialog could not open on this page (e.g. restricted):', err?.message);
        chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') + '?from=note-failed' });
      });
    });
  }
});

async function doCapture(tab, caseId, noteText, updateId, isManual = false) {
  showCapturingBadge();
  const settings = await getSettings();
  let imageDataUrl = null;
  let htmlContent = null;
  let pageSignals = null;
  let imageUrls = [];
  let inlineFailed = false;
  const serverHeaders = {};
  const isWeb = tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'));

  try {
    if (tab.active) {
      try {
        imageDataUrl = (await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' })) || null;
      } catch (e) {
        console.warn('Shuck: Screenshot failed on this page:', e?.message);
      }
    }
    if (isWeb && settings.inlineMediaOnCapture) {
      try {
        const serialized = await serializePageFromLoadedContent(tab.id);
        if (serialized.html) {
          htmlContent = serialized.html.length > 4 * 1024 * 1024 ? serialized.html.slice(0, 4 * 1024 * 1024) + '...[truncated]' : serialized.html;
          const imgRe = /<img[^>]+src=["']([^"']+)["']/gi;
          let m;
          while ((m = imgRe.exec(serialized.html)) !== null) imageUrls.push(m[1]);
          imageUrls = [...new Set(imageUrls)].slice(0, 50);
        } else {
          inlineFailed = true;
        }
      } catch (_) {
        inlineFailed = true;
      }
    }
    if (!htmlContent && isWeb) {
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => document.documentElement.outerHTML,
        });
        if (results && results[0] && results[0].result) {
          const raw = results[0].result;
          htmlContent = raw.length > 2 * 1024 * 1024 ? raw.slice(0, 2 * 1024 * 1024) + '...[truncated]' : raw;
          const imgRe = /<img[^>]+src=["']([^"']+)["']/gi;
          let m;
          while ((m = imgRe.exec(raw)) !== null) imageUrls.push(m[1]);
          imageUrls = [...new Set(imageUrls)].slice(0, 50);
        }
      } catch (e) {
        console.warn('Shuck: Could not get page HTML (page may restrict extensions):', e?.message);
      }
    }
    try {
      const signalResults = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: collectPageSignals });
      if (signalResults && signalResults[0] && signalResults[0].result) pageSignals = signalResults[0].result;
    } catch (_) {}
  } catch (e) {
    console.warn('Shuck: Capture data collection error:', e?.message);
  }

  const technologies = detectTechnologies(pageSignals, serverHeaders);
  const contentForHash = (tab.url || '') + (tab.title || '') + (htmlContent || '').slice(0, 50000);
  let contentHash = '';
  try {
    contentHash = await hashString(contentForHash);
  } catch (_) {}
  const extractedData = htmlContent ? extractDataFromHtml(htmlContent) : { emails: [], ips: [] };

  try {
    const data = await getCaptures();
    const urlNorm = normalizeUrlForCompare(tab.url);

    const trySaveCaptures = async (captureData, captureObj) => {
      try {
        await saveCaptures(captureData);
      } catch (saveErr) {
        if (isQuotaError(saveErr) && captureObj && captureObj.imageDataUrl) {
          captureObj.imageDataUrl = null;
          const idx = captureData.captures.findIndex(c => c.id === captureObj.id);
          if (idx >= 0) captureData.captures[idx] = captureObj;
          await saveCaptures(captureData);
          return captureObj;
        }
        throw saveErr;
      }
      return captureObj;
    };

    if (updateId) {
      const idx = data.captures.findIndex(c => c.id === updateId);
      if (idx >= 0) {
        const existing = data.captures[idx];
        const updated = {
          ...existing,
          url: tab.url,
          title: tab.title || tab.url,
          timestamp: new Date().toISOString(),
          contentHash,
          imageDataUrl: imageDataUrl != null ? imageDataUrl : existing.imageDataUrl,
          imageUrls,
          htmlContent: htmlContent || null,
          extractedData,
          technologies,
          serverHeaders,
          inlineFailed: inlineFailed || false,
        };
        data.captures.splice(idx, 1);
        data.captures.unshift(updated);
        await trySaveCaptures(data, updated);
        await appendTroubleshootLog({ type: 'capture_done', url: tab.url, caseId, id: updateId });
        return { id: updateId, capture: updated };
      }
    }

    // If same URL already exists and this is not a manual capture, update it to keep the one with most data
    // Manual captures always create a new entry so multiple captures/notes per URL are allowed.
    if (!isManual) {
      const existingByUrl = data.captures.find(c => (c.caseId || 'default') === (caseId || 'default') && normalizeUrlForCompare(c.url) === urlNorm);
      if (existingByUrl) {
        const idx = data.captures.indexOf(existingByUrl);
        const updated = {
          ...existingByUrl,
          url: tab.url,
          title: tab.title || tab.url,
          timestamp: new Date().toISOString(),
          contentHash,
          imageDataUrl: imageDataUrl != null ? imageDataUrl : existingByUrl.imageDataUrl,
          imageUrls: imageUrls?.length ? imageUrls : existingByUrl.imageUrls,
          htmlContent: htmlContent || existingByUrl.htmlContent,
          extractedData: (extractedData && (extractedData.emails?.length || extractedData.ips?.length)) ? extractedData : existingByUrl.extractedData,
          technologies: (technologies && technologies.length) ? technologies : existingByUrl.technologies,
          serverHeaders: Object.keys(serverHeaders).length ? serverHeaders : existingByUrl.serverHeaders,
          inlineFailed: inlineFailed || false,
          captureSource: 'auto',
        };
        data.captures.splice(idx, 1);
        data.captures.unshift(updated);
        await trySaveCaptures(data, updated);
        await appendTroubleshootLog({ type: 'capture_done', url: tab.url, caseId, id: existingByUrl.id });
        return { id: existingByUrl.id, capture: updated };
      }
    }

    const id = randomUuid();
    const capture = {
      id,
      caseId: caseId || 'default',
      url: tab.url,
      title: tab.title || tab.url,
      timestamp: new Date().toISOString(),
      contentHash,
      imageDataUrl,
      imageUrls,
      htmlContent: htmlContent || null,
      extractedData,
      technologies,
      serverHeaders,
      tags: [],
      notes: noteText || '',
      important: false,
      attachments: [],
      links: [],
      inlineFailed: inlineFailed || false,
      captureSource: isManual ? 'manual' : 'auto',
    };
    data.captures.unshift(capture);
    await trySaveCaptures(data, capture);
    await appendTroubleshootLog({ type: 'capture_done', url: tab.url, caseId, id });
    return { id, capture };
  } catch (err) {
    console.warn('Shuck capture failed:', err?.message || err);
    throw err;
  } finally {
    setTimeout(() => {
      clearCapturingBadge();
      updateCaptureStateBadge();
    }, 1200);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'addCapture') {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return sendResponse({ error: 'No tab' });
      const caseId = await getCurrentCaseId();
      if (!caseId) return sendResponse({ error: 'Create a case first' });
      const caseConfig = await getCaseConfig(caseId);
      if (urlMatchesBlacklist(tab.url, caseConfig.blacklist)) {
        await appendTroubleshootLog({ type: 'ignore_list_hit', url: tab.url, caseId });
        return sendResponse({ error: 'URL on ignore list' });
      }
      const result = await doCapture(tab, caseId, request.noteText || null, null, true);
      return sendResponse(result);
    })();
    return true;
  }
  if (request.action === 'addCaptureFromContent') {
    (async () => {
      const tab = sender.tab ? await chrome.tabs.get(sender.tab.id) : null;
      if (!tab) return sendResponse({ error: 'No tab' });
      const caseId = await getCurrentCaseId();
      if (!caseId) return sendResponse({ error: 'Create a case first' });
      const result = await doCapture(tab, caseId, request.noteText || null, null, true);
      return sendResponse(result);
    })();
    return true;
  }
  if (request.action === 'addScreenshotOnly') {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id || !tab.url || tab.url.startsWith('chrome://')) return sendResponse({ error: 'No tab or invalid URL' });
      const caseId = await getCurrentCaseId();
      if (!caseId) return sendResponse({ error: 'Create a case first' });
      const caseConfig = await getCaseConfig(caseId);
      if (urlMatchesBlacklist(tab.url, caseConfig.blacklist)) {
        await appendTroubleshootLog({ type: 'ignore_list_hit', url: tab.url, caseId });
        return sendResponse({ error: 'URL on ignore list' });
      }
      try {
        const imageDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId || null, { format: 'png' });
        if (!imageDataUrl) return sendResponse({ error: 'Screenshot failed' });
        const data = await getCaptures();
        const id = randomUuid();
        const capture = {
          id,
          caseId: caseId || 'default',
          url: tab.url || '',
          title: (tab.title || 'Screenshot').trim() || 'Screenshot',
          timestamp: new Date().toISOString(),
          contentHash: '',
          imageDataUrl,
          imageUrls: [],
          htmlContent: null,
          extractedData: { emails: [], ips: [] },
          technologies: [],
          serverHeaders: {},
          tags: [],
          notes: '',
          important: false,
          attachments: [],
          links: [],
          inlineFailed: false,
          captureSource: 'screenshot',
        };
        data.captures.unshift(capture);
        await saveCaptures(data);
        return sendResponse({ id, capture });
      } catch (err) {
        return sendResponse({ error: String(err?.message || err) });
      }
    })();
    return true;
  }
  if (request.action === 'addScreenshotWithAnnotation') {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id || !tab.url || tab.url.startsWith('chrome://')) return sendResponse({ error: 'No tab or invalid URL' });
      try {
        const imageDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId || null, { format: 'png' });
        if (!imageDataUrl) return sendResponse({ error: 'Screenshot failed' });
        const pendingKey = 'shuck_pending_screenshot_' + Date.now();
        await chrome.storage.local.set({ [pendingKey]: { imageDataUrl, url: tab.url || '', title: (tab.title || 'Screenshot').trim() || 'Screenshot' } });
        const annotationUrl = chrome.runtime.getURL('annotation.html') + '?pending=' + encodeURIComponent(pendingKey);
        chrome.tabs.create({ url: annotationUrl });
        return sendResponse({ ok: true });
      } catch (err) {
        return sendResponse({ error: String(err?.message || err) });
      }
    })();
    return true;
  }
  if (request.action === 'addCaptureImageOnly') {
    (async () => {
      let responded = false;
      const reply = (payload) => {
        if (responded) return;
        responded = true;
        try { sendResponse(payload); } catch (_) {}
      };
      try {
        let imageDataUrl = request.imageDataUrl;
        if (!imageDataUrl && request.pendingImageKey) {
          const got = await chrome.storage.local.get(request.pendingImageKey);
          const pending = got[request.pendingImageKey];
          if (pending) {
            imageDataUrl = pending.imageDataUrl;
            await chrome.storage.local.remove(request.pendingImageKey);
          }
        }
        if (!imageDataUrl) {
          reply({ error: 'Missing imageDataUrl' });
          return;
        }
        const url = request.url != null ? request.url : '';
        const title = request.title || 'Annotated screenshot';
        const caseId = await getCurrentCaseId();
        const settings = await getSettings();
        const data = await getCaptures();
        const id = randomUuid();
        const linkToCaptureId = request.linkToCaptureId;
        const capture = {
          id,
          caseId: caseId || 'default',
          url: url || '',
          title: title || 'Annotated screenshot',
          timestamp: new Date().toISOString(),
          contentHash: '',
          imageDataUrl,
          imageUrls: [],
          htmlContent: null,
          extractedData: { emails: [], ips: [] },
          technologies: [],
          serverHeaders: {},
          tags: [],
          notes: '',
          important: false,
          attachments: [],
          links: linkToCaptureId ? [{ type: 'capture', id: linkToCaptureId }] : [],
          inlineFailed: false,
          captureSource: 'annotation',
        };
        data.captures.unshift(capture);
        try {
          await saveCaptures(data);
        } catch (saveErr) {
          if (isQuotaError(saveErr) && capture.imageDataUrl) {
            // Storage quota exceeded — retry without the screenshot to preserve the capture entry.
            const captureNoImage = { ...capture, imageDataUrl: null };
            data.captures[0] = captureNoImage;
            await saveCaptures(data);
            reply({ id, capture: captureNoImage });
            return;
          }
          throw saveErr;
        }
        if (linkToCaptureId) {
          const caseIdForLink = caseId || 'default';
          const original = data.captures.find((c) => c.id === linkToCaptureId && (c.caseId || 'default') === caseIdForLink);
          if (original) {
            const existingLinks = original.links || [];
            if (!existingLinks.some((l) => l.type === 'capture' && l.id === id)) {
              const idx = data.captures.findIndex((c) => c.id === linkToCaptureId && (c.caseId || 'default') === caseIdForLink);
              if (idx >= 0) {
                data.captures[idx] = { ...data.captures[idx], links: [...existingLinks, { type: 'capture', id }] };
                try { await saveCaptures(data); } catch (_) {}
              }
            }
          }
        }
        reply({ id, capture });
      } catch (err) {
        reply({ error: String(err?.message || err) });
      }
    })();
    return true;
  }
  if (request.action === 'getCaptures') {
    getCaptures().then(sendResponse);
    return true;
  }
  if (request.action === 'getCases') {
    getCases().then(sendResponse);
    return true;
  }
  if (request.action === 'getCurrentCaseId') {
    getCurrentCaseId().then(sendResponse);
    return true;
  }
  if (request.action === 'setCurrentCaseId') {
    setCurrentCaseId(request.id).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (request.action === 'addCase') {
    (async () => {
      const list = await getCases();
      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'case_' + Date.now();
      list.push({ id, name: request.name || 'New case', createdAt: new Date().toISOString() });
      await chrome.storage.local.set({ [CASES_KEY]: list });
      sendResponse({ id, cases: list });
    })();
    return true;
  }
  if (request.action === 'updateCase') {
    (async () => {
      const { caseId, name } = request;
      if (!caseId) return sendResponse({ error: 'Missing caseId' });
      const list = await getCases();
      const c = list.find(x => x.id === caseId);
      if (!c) return sendResponse({ error: 'Case not found' });
      c.name = (name != null && String(name).trim()) ? String(name).trim() : c.name;
      await chrome.storage.local.set({ [CASES_KEY]: list });
      sendResponse({ ok: true, cases: list });
    })();
    return true;
  }
  if (request.action === 'deleteCase') {
    (async () => {
      const caseId = request.caseId;
      if (!caseId) return sendResponse({ error: 'Missing caseId' });
      const list = await getCases();
      if (!list.some(x => x.id === caseId)) return sendResponse({ error: 'Case not found' });
      const next = list.filter(x => x.id !== caseId);

      // Delete associated data BEFORE removing the case from the list.
      // If the worker crashes mid-way the case will still appear in the UI so the user can retry.
      const captureData = await getCaptures();
      const before = (captureData.captures || []).length;
      captureData.captures = (captureData.captures || []).filter(c => (c.caseId || 'default') !== caseId);
      if (captureData.captures.length !== before) await saveCaptures(captureData);

      const { [CASE_CONFIG_KEY]: allConfig = {} } = await chrome.storage.local.get(CASE_CONFIG_KEY);
      delete allConfig[caseId];
      await chrome.storage.local.set({ [CASE_CONFIG_KEY]: allConfig });

      const { [ACCOUNTS_KEY]: accountsByCase = {} } = await chrome.storage.local.get(ACCOUNTS_KEY);
      delete accountsByCase[caseId];
      await chrome.storage.local.set({ [ACCOUNTS_KEY]: accountsByCase });

      const { [PEOPLE_KEY]: peopleByCase = {} } = await chrome.storage.local.get(PEOPLE_KEY);
      delete peopleByCase[caseId];
      await chrome.storage.local.set({ [PEOPLE_KEY]: peopleByCase });

      const { [GROUPS_KEY]: groupsByCase = {} } = await chrome.storage.local.get(GROUPS_KEY);
      delete groupsByCase[caseId];
      await chrome.storage.local.set({ [GROUPS_KEY]: groupsByCase });

      const { [TODO_BY_CASE_KEY]: todoByCase = {} } = await chrome.storage.local.get(TODO_BY_CASE_KEY);
      delete todoByCase[caseId];
      await chrome.storage.local.set({ [TODO_BY_CASE_KEY]: todoByCase });

      // Remove from cases list last — once this write completes the case is fully gone.
      await chrome.storage.local.set({ [CASES_KEY]: next });

      const current = await getCurrentCaseId();
      if (current === caseId) {
        await setCurrentCaseId(next.length ? next[0].id : '');
      }
      sendResponse({ ok: true, cases: next });
    })();
    return true;
  }
  if (request.action === 'getSettings') {
    getSettings().then(sendResponse);
    return true;
  }
  if (request.action === 'setSettings') {
    (async () => {
      try {
        await setSettings(request.settings || {});
        if (request.settings && 'captureEnabled' in request.settings) {
          await updateCaptureStateBadge();
        }
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ error: String(e?.message || e) });
      }
    })();
    return true;
  }
  if (request.action === 'getSelectors') {
    (async () => {
      const caseId = request.caseId !== undefined ? request.caseId : await getCurrentCaseId();
      const config = await getCaseConfig(caseId);
      sendResponse(config.selectors || []);
    })();
    return true;
  }
  if (request.action === 'setSelectors') {
    (async () => {
      const caseId = request.caseId !== undefined ? request.caseId : await getCurrentCaseId();
      if (caseId) await setCaseConfig(caseId, { selectors: request.selectors || [] });
      else await chrome.storage.local.set({ [SELECTORS_KEY]: request.selectors || [] });
      sendResponse({ ok: true });
    })();
    return true;
  }
  if (request.action === 'getCaseConfig') {
    (async () => {
      const caseId = request.caseId || await getCurrentCaseId();
      sendResponse(await getCaseConfig(caseId));
    })();
    return true;
  }
  if (request.action === 'setCaseConfig') {
    (async () => {
      try {
        const caseId = request.caseId || await getCurrentCaseId();
        await setCaseConfig(caseId, request.config || {});
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ error: String(e?.message || e) });
      }
    })();
    return true;
  }
  if (request.action === 'getGlobalTags') {
    getGlobalTags().then(sendResponse);
    return true;
  }
  if (request.action === 'setGlobalTags') {
    setGlobalTags(request.tags).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (request.action === 'getAccounts') {
    (async () => {
      const caseId = request.caseId !== undefined ? request.caseId : await getCurrentCaseId();
      const { [ACCOUNTS_KEY]: byCase = {} } = await chrome.storage.local.get(ACCOUNTS_KEY);
      const list = Array.isArray(byCase[caseId]) ? byCase[caseId] : [];
      sendResponse(list);
    })();
    return true;
  }
  if (request.action === 'setAccounts') {
    (async () => {
      const caseId = request.caseId !== undefined ? request.caseId : await getCurrentCaseId();
      const { [ACCOUNTS_KEY]: byCase = {} } = await chrome.storage.local.get(ACCOUNTS_KEY);
      byCase[caseId] = request.list || [];
      await chrome.storage.local.set({ [ACCOUNTS_KEY]: byCase });
      sendResponse({ ok: true });
    })();
    return true;
  }
  if (request.action === 'getPeople') {
    (async () => {
      const caseId = request.caseId !== undefined ? request.caseId : await getCurrentCaseId();
      const { [PEOPLE_KEY]: byCase = {} } = await chrome.storage.local.get(PEOPLE_KEY);
      const list = Array.isArray(byCase[caseId]) ? byCase[caseId] : [];
      sendResponse(list);
    })();
    return true;
  }
  if (request.action === 'setPeople') {
    (async () => {
      const caseId = request.caseId !== undefined ? request.caseId : await getCurrentCaseId();
      const { [PEOPLE_KEY]: byCase = {} } = await chrome.storage.local.get(PEOPLE_KEY);
      byCase[caseId] = request.list || [];
      await chrome.storage.local.set({ [PEOPLE_KEY]: byCase });
      sendResponse({ ok: true });
    })();
    return true;
  }
  if (request.action === 'getGroups') {
    (async () => {
      const caseId = request.caseId !== undefined ? request.caseId : await getCurrentCaseId();
      const { [GROUPS_KEY]: byCase = {} } = await chrome.storage.local.get(GROUPS_KEY);
      const list = Array.isArray(byCase[caseId]) ? byCase[caseId] : [];
      sendResponse(list);
    })();
    return true;
  }
  if (request.action === 'setGroups') {
    (async () => {
      const caseId = request.caseId !== undefined ? request.caseId : await getCurrentCaseId();
      const { [GROUPS_KEY]: byCase = {} } = await chrome.storage.local.get(GROUPS_KEY);
      byCase[caseId] = request.list || [];
      await chrome.storage.local.set({ [GROUPS_KEY]: byCase });
      sendResponse({ ok: true });
    })();
    return true;
  }
  if (request.action === 'getTodoList') {
    (async () => {
      const caseId = request.caseId !== undefined ? request.caseId : await getCurrentCaseId();
      const { [TODO_BY_CASE_KEY]: byCase = {}, shuck_todo: legacyTodo } = await chrome.storage.local.get([TODO_BY_CASE_KEY, 'shuck_todo']);
      let byCaseMap = byCase || {};
      if (Object.keys(byCaseMap).length === 0 && Array.isArray(legacyTodo) && legacyTodo.length > 0) {
        byCaseMap = { default: legacyTodo };
        await chrome.storage.local.set({ [TODO_BY_CASE_KEY]: byCaseMap });
      }
      const list = byCaseMap[caseId] !== undefined ? byCaseMap[caseId] : (byCaseMap['default'] || []);
      sendResponse(Array.isArray(list) ? list : []);
    })();
    return true;
  }
  if (request.action === 'setTodoList') {
    (async () => {
      const caseId = request.caseId !== undefined ? request.caseId : await getCurrentCaseId();
      const { [TODO_BY_CASE_KEY]: byCase = {} } = await chrome.storage.local.get(TODO_BY_CASE_KEY);
      const next = { ...(byCase || {}), [caseId]: request.list || [] };
      await chrome.storage.local.set({ [TODO_BY_CASE_KEY]: next });
      sendResponse({ ok: true });
    })();
    return true;
  }
  if (request.action === 'importData') {
    (async () => {
      const data = request.data || {};
      const existing = await getCaptures();
      const merge = request.merge === true;
      if (merge && data.captures && data.captures.length) {
        for (const c of data.captures) {
          existing.captures.push({ ...c, id: randomUuid(), caseId: c.caseId || 'default', attachments: c.attachments || [] });
        }
        await saveCaptures(existing);
      } else if (!merge && Array.isArray(data.captures) && data.captures.length > 0) {
        // Only allow a full replace when the import file actually contains captures;
        // an empty array would silently wipe everything, so we refuse it here.
        await saveCaptures({ captures: data.captures.map(c => ({ ...c, attachments: c.attachments || [] })), nextId: data.nextId || data.captures.length + 1 });
      } else if (!merge && Array.isArray(data.captures) && data.captures.length === 0) {
        return sendResponse({ error: 'Import file contains no captures — refusing full replace to protect existing data.' });
      }
      sendResponse({ ok: true });
    })();
    return true;
  }
  if (request.action === 'importFullCase') {
    (async () => {
      const payload = request.payload || {};
      let caseId = (payload.caseId && isUuid(payload.caseId)) ? payload.caseId : randomUuid();
      let caseName = payload.caseName != null ? String(payload.caseName).trim() : null;
      const merge = request.merge === true;
      const forceNewCase = request.forceNewCase === true;
      const list = await getCases();
      let caseExists = list.some(c => c.id === caseId);
      if (forceNewCase && caseExists) {
        caseId = randomUuid();
        caseName = caseName || (payload.caseName != null ? String(payload.caseName).trim() : null);
        list.push({ id: caseId, name: caseName || 'Imported case', createdAt: new Date().toISOString() });
        await chrome.storage.local.set({ [CASES_KEY]: list });
      } else if (!caseExists) {
        list.push({ id: caseId, name: caseName || 'Imported case', createdAt: new Date().toISOString() });
        await chrome.storage.local.set({ [CASES_KEY]: list });
      } else if (caseName) {
        const c = list.find(x => x.id === caseId);
        if (c) c.name = caseName;
        await chrome.storage.local.set({ [CASES_KEY]: list });
      }
      const data = await getCaptures();
      const otherCaptures = (data.captures || []).filter(c => (c.caseId || 'default') !== caseId);
      let importedCaptures = Array.isArray(payload.captures) ? payload.captures : [];
      const idMap = {}; // old capture id -> new capture id (so account/capture links stay valid)
      if (importedCaptures.length) {
        importedCaptures = importedCaptures.map(c => {
          const newId = randomUuid();
          idMap[c.id] = newId;
          return { ...c, id: newId, caseId, attachments: c.attachments || [] };
        });
        function remapCaptureLinks(links) {
          if (!Array.isArray(links)) return links;
          return links
            .filter(l => l.type !== 'capture' || (l.id && idMap[l.id] != null))
            .map(l => (l.type === 'capture' && l.id && idMap[l.id] != null ? { ...l, id: idMap[l.id] } : l));
        }
        importedCaptures = importedCaptures.map(c => ({ ...c, links: remapCaptureLinks(c.links) }));
      }
      importedCaptures = importedCaptures.map(c => ({ ...c, caseId, attachments: c.attachments || [] }));
      data.captures = [...otherCaptures, ...importedCaptures];
      await saveCaptures(data);
      if (Array.isArray(payload.accounts)) {
        const { [ACCOUNTS_KEY]: byCase = {} } = await chrome.storage.local.get(ACCOUNTS_KEY);
        let accountsToSet = payload.accounts;
        if (Object.keys(idMap).length > 0) {
          function remapAccountLinks(links) {
            if (!Array.isArray(links)) return links;
            return links
              .filter(l => l.type !== 'capture' || (l.id && idMap[l.id] != null))
              .map(l => (l.type === 'capture' && l.id && idMap[l.id] != null ? { ...l, id: idMap[l.id] } : l));
          }
          accountsToSet = payload.accounts.map(acc => ({ ...acc, links: remapAccountLinks(acc.links || []) }));
        }
        if (merge) {
          const existingAccounts = Array.isArray(byCase[caseId]) ? byCase[caseId] : [];
          const existingById = new Map(existingAccounts.map(a => [a.id, a]));
          const merged = [];
          for (const imp of accountsToSet) {
            const existing = existingById.get(imp.id);
            if (existing) {
              const sites = [...new Set([...(existing.sites || []), ...(imp.sites || [])])];
              const tags = [...new Set([...(existing.tags || []), ...(imp.tags || [])])];
              const linkKeys = new Set((existing.links || []).map(l => (l.type || 'capture') + ':' + (l.id || '')));
              const links = [...(existing.links || [])];
              for (const l of (imp.links || [])) {
                const key = (l.type || 'capture') + ':' + (l.id || '');
                if (!linkKeys.has(key)) {
                  linkKeys.add(key);
                  links.push(l);
                }
              }
              merged.push({ ...existing, ...imp, sites: sites.length ? sites : undefined, tags, links });
              existingById.delete(imp.id);
            } else {
              merged.push(imp);
            }
          }
          for (const a of existingById.values()) merged.push(a);
          accountsToSet = merged;
        }
        byCase[caseId] = accountsToSet;
        await chrome.storage.local.set({ [ACCOUNTS_KEY]: byCase });
      }
      if (Array.isArray(payload.people)) {
        const { [PEOPLE_KEY]: byCase = {} } = await chrome.storage.local.get(PEOPLE_KEY);
        let peopleToSet = payload.people;
        if (merge) {
          const existingPeople = Array.isArray(byCase[caseId]) ? byCase[caseId] : [];
          const existingById = new Map(existingPeople.map(p => [p.id, p]));
          const merged = [];
          for (const imp of peopleToSet) {
            const existing = existingById.get(imp.id);
            if (existing) {
              const groupIds = [...new Set([...(existing.groupIds || []), ...(imp.groupIds || [])])];
              merged.push({ ...existing, ...imp, groupIds: groupIds.length ? groupIds : undefined });
              existingById.delete(imp.id);
            } else {
              merged.push(imp);
            }
          }
          for (const p of existingById.values()) merged.push(p);
          peopleToSet = merged;
        }
        byCase[caseId] = peopleToSet;
        await chrome.storage.local.set({ [PEOPLE_KEY]: byCase });
      }
      if (Array.isArray(payload.groups)) {
        const { [GROUPS_KEY]: byCase = {} } = await chrome.storage.local.get(GROUPS_KEY);
        let groupsToSet = payload.groups;
        if (merge) {
          const existingGroups = Array.isArray(byCase[caseId]) ? byCase[caseId] : [];
          const existingById = new Map(existingGroups.map(g => [g.id, g]));
          const merged = [];
          for (const imp of groupsToSet) {
            const existing = existingById.get(imp.id);
            if (existing) {
              const personIds = [...new Set([...(existing.personIds || []), ...(imp.personIds || [])])];
              const groupIds = [...new Set([...(existing.groupIds || []), ...(imp.groupIds || [])])];
              merged.push({
                ...existing,
                ...imp,
                personIds: personIds.length ? personIds : undefined,
                groupIds: groupIds.length ? groupIds : undefined,
              });
              existingById.delete(imp.id);
            } else {
              merged.push(imp);
            }
          }
          for (const g of existingById.values()) merged.push(g);
          groupsToSet = merged;
        }
        byCase[caseId] = groupsToSet;
        await chrome.storage.local.set({ [GROUPS_KEY]: byCase });
      }
      if (Array.isArray(payload.todoItems)) {
        const { [TODO_BY_CASE_KEY]: byCase = {} } = await chrome.storage.local.get(TODO_BY_CASE_KEY);
        const next = { ...(byCase || {}), [caseId]: payload.todoItems };
        await chrome.storage.local.set({ [TODO_BY_CASE_KEY]: next });
      }
      if (payload.caseConfig && typeof payload.caseConfig === 'object') {
        await setCaseConfig(caseId, payload.caseConfig);
      }
      sendResponse({ ok: true, caseId });
    })();
    return true;
  }
  if (request.action === 'updateCapture') {
    (async () => {
      const data = await getCaptures();
      const idx = data.captures.findIndex(c => c.id === request.id);
      if (idx === -1) return sendResponse({ ok: false });
      data.captures[idx] = { ...data.captures[idx], ...request.updates };
      await saveCaptures(data);
      sendResponse({ ok: true });
    })();
    return true;
  }
  if (request.action === 'reinlineCaptureFromServer') {
    (async () => {
      const captureId = request.captureId;
      if (!captureId) return sendResponse({ error: 'Missing capture id' });
      const [data, tabs] = await Promise.all([getCaptures(), chrome.tabs.query({ active: true, currentWindow: true })]);
      const cap = data.captures.find(c => c.id === captureId);
      if (!cap) return sendResponse({ error: 'Capture not found' });
      const tab = tabs[0] || (request.tabId ? await chrome.tabs.get(request.tabId).catch(() => null) : null);
      if (!tab || !tab.url) return sendResponse({ error: 'No tab' });
      try {
        const capOrigin = new URL(cap.url || 'about:blank').origin;
        const tabOrigin = new URL(tab.url).origin;
        if (capOrigin !== tabOrigin) return sendResponse({ error: 'Open the captured page in this tab first' });
      } catch (_) {
        return sendResponse({ error: 'Open the captured page in this tab first' });
      }
      const serialized = await serializePageWithInlineResources(tab.id);
      if (!serialized.html) return sendResponse({ error: serialized.error || 'Failed to fetch from server' });
      const html = serialized.html.length > 4 * 1024 * 1024 ? serialized.html.slice(0, 4 * 1024 * 1024) + '...[truncated]' : serialized.html;
      const idx = data.captures.findIndex(c => c.id === captureId);
      if (idx === -1) return sendResponse({ error: 'Capture not found' });
      data.captures[idx] = { ...data.captures[idx], htmlContent: html, inlineFailed: false };
      await saveCaptures(data);
      sendResponse({ ok: true });
    })();
    return true;
  }
  if (request.action === 'deleteCapture') {
    (async () => {
      const data = await getCaptures();
      data.captures = data.captures.filter(c => c.id !== request.id);
      await saveCaptures(data);
      sendResponse({ ok: true });
    })();
    return true;
  }
  if (request.action === 'hashContent') {
    hashString(request.content || '').then(sendResponse);
    return true;
  }
  if (request.action === 'captureVisibleTab') {
    chrome.tabs.captureVisibleTab(request.windowId || null, { format: 'png' })
      .then(dataUrl => sendResponse({ dataUrl }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (request.action === 'getTroubleshootLog') {
    chrome.storage.local.get(TROUBLESHOOT_LOG_KEY).then(({ [TROUBLESHOOT_LOG_KEY]: log = [] }) => sendResponse(Array.isArray(log) ? log : []));
    return true;
  }
  if (request.action === 'clearTroubleshootLog') {
    chrome.storage.local.set({ [TROUBLESHOOT_LOG_KEY]: [] }).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (request.action === 'getImageDataFromTab') {
    (async () => {
      try {
        const { tabId, srcUrl } = request;
        if (!tabId || !srcUrl) return sendResponse({ error: 'Missing tabId or srcUrl' });
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          func: (url) => {
            const u = (url || '').trim();
            const img = Array.from(document.images).find(i => {
              const s = (i.src || i.currentSrc || '').trim();
              if (s === u) return true;
              try {
                if (new URL(s).href === new URL(u).href) return true;
                if (s.split('?')[0] === u.split('?')[0]) return true;
              } catch (_) {}
              return false;
            });
            if (!img || !img.naturalWidth) return null;
            const c = document.createElement('canvas');
            c.width = img.naturalWidth;
            c.height = img.naturalHeight;
            const ctx = c.getContext('2d');
            try {
              ctx.drawImage(img, 0, 0);
              return c.toDataURL('image/png');
            } catch (_) {
              return null;
            }
          },
          args: [srcUrl],
        });
        const dataUrl = results && results[0] && results[0].result;
        if (dataUrl) return sendResponse({ dataUrl });
        return sendResponse({ error: 'Could not get image from page (may be cross-origin)' });
      } catch (e) {
        return sendResponse({ error: (e && e.message) || 'Failed' });
      }
    })();
    return true;
  }
  return false;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[SETTINGS_KEY]) {
    updateCaptureStateBadge();
  }
});

updateCaptureStateBadge().catch(() => {});
