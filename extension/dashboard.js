// Shuck Dashboard - full-page UI (same data as popup via chrome.runtime.sendMessage)

const dashboardUrl = chrome.runtime.getURL('dashboard.html');

// Read captures directly from storage to avoid the 64MiB chrome.runtime.sendMessage limit.
async function getLocalCaptures() {
  const result = await chrome.storage.local.get('shuck_captures');
  return result['shuck_captures'] || { captures: [], nextId: 1 };
}

const THEME_HEX = { purple: '#6b21a8', teal: '#0d5c4b', blue: '#1d4ed8', slate: '#475569' };

const DEFAULT_TAGS = ['Evidence', 'Source', 'Person', 'Account', 'Follow-up', 'Important', 'Lead', 'Primary source', 'Profile', 'Target', 'Contact', 'Social', 'Domain', 'IP', 'Verified', 'To review'];

const DASHBOARD_PANEL_KEY = 'shuck_dashboard_panel';
const GRAPH_FILTERS_STORAGE_KEY = 'shuck_graph_filters';

const OSINT_TEMPLATE = [
  { section: 'Domain & DNS', items: ['Whois lookup (creation, expiry, registrar)', 'DNS records (A, AAAA, MX, NS, TXT, CAA, SPF, DKIM, DMARC)', 'Subdomain enumeration (cert transparency, bruteforce, wordlists)', 'Historical DNS / passive DNS (SecurityTrails, RiskIQ, etc.)', 'SSL/TLS certificate check and CT logs (crt.sh)', 'Domain ownership and registration history', 'Reverse whois and bulk lookups', 'Zone transfer attempt (AXFR)', 'DNS over HTTPS (DoH) and resolver checks', 'Favicon and asset hashing (Shodan, Censys)', 'Domain typo-squatting and homograph variants', 'Parked domain and redirect chains', 'Email-related records (MX, SPF alignment)'] },
  { section: 'Usernames & Handles', items: ['Username search across platforms (Namechk, KnowEm, Sherlock)', 'Handle consistency and variations (underscores, numbers)', 'Claimed vs unclaimed usernames', 'Username in breach/leak databases', 'Cross-platform profile discovery by handle', 'Reserved and squatted handles', 'Username in code repos and commits'] },
  { section: 'Social Media', items: ['Profile discovery (usernames, emails, phone)', 'Social media tags and @mentions (handles, hashtags)', 'Posts and timeline review (date range, keywords)', 'Connections and network mapping (followers, following)', 'LinkedIn and professional profiles (employment, skills)', 'Twitter/X: tweets, hashtags, lists, spaces', 'Facebook: pages, groups, events, marketplace', 'Instagram, TikTok, Snapchat content and metadata', 'Reddit: posts, comments, subreddits, karma', 'Discord, Telegram groups and channels', 'Forums and niche communities (vBulletin, phpBB)', 'Paste and code sites (GitHub, GitLab, Pastebin, Gists)', 'YouTube and video platforms (channels, descriptions)', 'Comments and engagement patterns', 'Deleted content and archives (Wayback, archive.today)', 'Influencer and verification badges', 'Ad libraries (Meta, Google, TikTok)'] },
  { section: 'People & Identity', items: ['Name variations, aliases, maiden names, nicknames', 'Username search across platforms (Namechk, KnowEm)', 'Photo and face reverse search (PimEyes, Yandex, Google)', 'Professional licenses and memberships', 'Family, associates, and household members', 'Address and location history', 'Education and employment history', 'Social graph and influence mapping', 'Voter and property records (where public)', 'Obituaries and family trees', 'Date and place of birth (DOB/ POB)', 'Passport and ID patterns (format only)', 'Hobbies and interest signals', 'Language and writing style', 'Photos in uniform or workplace (OSINT context)'] },
  { section: 'Email & Phone', items: ['Email format and common variations', 'Breach and leak check (HIBP, DeHashed, etc.)', 'Phone number lookup and carrier (CNAM, LRN)', 'VOIP and disposable number detection', 'Communication patterns and timing analysis', 'Email headers and delivery path (Received, SPF, DKIM)', 'Domain-based email reputation (MXToolbox, etc.)', 'Email in code, commits, and public configs', 'Phone in social profiles and ads', 'SMS and 2FA recovery options (where visible)', 'Email-to-username mapping'] },
  { section: 'Infrastructure & Tech', items: ['IP and ASN lookup (RIPEstat, BGPView)', 'Hosting provider and datacenter (IP range)', 'Open ports and services (Shodan, Censys, ZoomEye)', 'Technologies and frameworks', 'CDN, WAF, and proxy detection', 'Related domains and IPs (same host, same ASN)', 'BGP and routing data', 'Historical IP and hosting changes', 'Exposed panels (admin, phpMyAdmin, .git)', 'Default creds and weak configs', 'SSL/TLS config and cipher strength', 'HTTP headers and server fingerprint', 'Subdomain takeover and dangling DNS'] },
  { section: 'Documents & Leaks', items: ['Document metadata (EXIF, author, revision, printer)', 'Leaked databases and dumps (breach forums, paste sites)', 'Leaked credentials and password dumps (breach check, paste sites)', 'Public filings and court records', 'Archive.org and cached versions', 'Archive.today and other snapshots', 'Google dorks and advanced search (filetype, site, inurl)', 'File sharing and cloud links (Drive, Dropbox, WeTransfer)', 'PDF and Office metadata (author, company, timestamps)', 'Deleted or edited content (archive, cache)', 'Leaked credentials and API keys in repos', 'Data broker and people-search sites (where legal)'] },
  { section: 'Organisations', items: ['Company registration and filings (Companies House, SEC)', 'Leadership and key persons (LinkedIn, press)', 'Subsidiaries and group structure', 'Financials and ownership (EDGAR, Orbis)', 'Partners and suppliers', 'Company network and domains', 'Job postings and hiring (tech stack, locations)', 'Press releases and news', 'Corporate social accounts and verified pages', 'Mergers, acquisitions, and name changes', 'Industry and SIC/NAICS codes', 'UBO and beneficial ownership registers'] },
  { section: 'Financial', items: ['Company financials and filings (SEC, annual reports)', 'Cryptocurrency addresses and transactions (chain explorers)', 'Payment and donation links (PayPal, Patreon, Ko-fi)', 'Salary and funding data (Crunchbase, LinkedIn)', 'Crypto mixers and tumblers (usage patterns)', 'Wallet clustering and flow analysis', 'Bank and payment references in leaks', 'Invoices and payment metadata (where public)'] },
  { section: 'Geospatial', items: ['Location from photos and metadata (EXIF GPS)', 'Maps and satellite imagery (Google, Bing, Sentinel)', 'Check-ins and location history (Foursquare, etc.)', 'Geolocation from IP (MaxMind, IP2Location)', 'Street view and time-based imagery', 'Flight and maritime tracking (ADS-B, AIS, MarineTraffic)', 'Cell tower and coverage data', 'Landmarks and background in photos', 'Timezone and language as location signals'] },
  { section: 'Legal & Records', items: ['Court cases and litigation (PACER, national databases)', 'Patents and trademarks (USPTO, WIPO)', 'Licenses and permits (professional, business)', 'Sanctions and PEP lists (OFAC, UN, World-Check)', 'International registries and Interpol', 'Corporate and UBO registers', 'Bankruptcy and insolvency records', 'Criminal records (where public and legal)', 'Marriage and divorce records (where public)'] },
  { section: 'Threat & IOCs', items: ['Malware hashes and samples (VirusTotal, Hybrid Analysis)', 'C2 and phishing infrastructure (URL, IP, domain)', 'Threat actor TTPs and reports (MITRE, vendor blogs)', 'IOC feeds and blocklists (Abuse.ch, etc.)', 'VirusTotal and hybrid analysis', 'Sandbox and detonation results', 'YARA and Sigma rules', 'Phishing kit and lure analysis'] },
  { section: 'Dark Web & Tor', items: ['Onion service discovery (directories, search)', 'Market and forum presence (where legal)', 'Paste and leak sites on Tor', 'Cryptocurrency usage and wallet clues', 'Language and operational security (OPSEC) signals', 'Mirrors and invite channels'] },
  { section: 'Media & Verification', items: ['Image and video verification (Bellingcat-style)', 'Deepfake and manipulation checks', 'Metadata and provenance (EXIF, creation tool)', 'Cross-reference with known events (date, place)', 'Reverse image search (Yandex, Google, TinEye)', 'Video frame extraction and thumbnails', 'Audio and speaker identification (where applicable)', 'Consistency of lighting and shadows'] },
  { section: 'Verification & Reporting', items: ['Cross-check key facts with multiple sources', 'Cite and save evidence with timestamps and URLs', 'Timeline and narrative construction', 'Assumptions and confidence levels (high/medium/low)', 'Final report and recommendations', 'Source hierarchy (primary vs secondary)', 'Chain of custody for evidence', 'Disclaimer and legal/ethical scope'] },
];
function themeToHex(name) {
  return THEME_HEX[name] || '#6b21a8';
}
function lightenHex(hex, factor) {
  const n = hex.slice(1).match(/.{2}/g).map(x => parseInt(x, 16));
  const out = n.map(c => Math.min(255, Math.round(c * factor)));
  return '#' + out.map(c => c.toString(16).padStart(2, '0')).join('');
}
function mixWithWhite(hex, whiteRatio) {
  const n = hex.slice(1).match(/.{2}/g).map(x => parseInt(x, 16));
  const out = n.map(c => Math.round(c * (1 - whiteRatio) + 255 * whiteRatio));
  return '#' + out.map(c => Math.min(255, c).toString(16).padStart(2, '0')).join('');
}
function applyDashboardTheme(theme, overrides = {}) {
  const body = document.getElementById('dashboardBody');
  const accent = overrides.accentColor && overrides.accentColor.trim() ? overrides.accentColor.replace(/^#?/, '#') : null;
  const tag = overrides.tagColor && overrides.tagColor.trim() ? overrides.tagColor.replace(/^#?/, '#') : null;
  const importantBorder = (overrides.importantNodeBorderColor && overrides.importantNodeBorderColor.trim())
    ? overrides.importantNodeBorderColor.replace(/^#?/, '#') : null;
  if (importantBorder) body.style.setProperty('--important-node-border', importantBorder);
  const base = accent || (theme.startsWith('#') ? theme : null);
  if (base) {
    body.removeAttribute('data-theme');
    body.style.setProperty('--accent', base);
    body.style.setProperty('--accent-hover', lightenHex(base, 1.12));
    body.style.setProperty('--accent-muted', mixWithWhite(base, 0.88));
    body.style.setProperty('--accent-tag', tag ? mixWithWhite(tag, 0.88) : mixWithWhite(base, 0.88));
    body.style.setProperty('--accent-tag-text', tag || base);
  } else {
    body.style.removeProperty('--accent');
    body.style.removeProperty('--accent-hover');
    body.style.removeProperty('--accent-muted');
    body.style.removeProperty('--accent-tag');
    body.style.removeProperty('--accent-tag-text');
    body.setAttribute('data-theme', theme);
    if (tag) {
      body.style.setProperty('--accent-tag', mixWithWhite(tag, 0.88));
      body.style.setProperty('--accent-tag-text', tag);
    }
  }
}

function applyColorSchemeAndCanvas(colorScheme, graphCanvasColor) {
  const body = document.getElementById('dashboardBody');
  if (!body) return;
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  body.setAttribute('data-color-scheme', scheme);
  const canvasHex = (graphCanvasColor && String(graphCanvasColor).trim()) ? String(graphCanvasColor).replace(/^#?/, '#') : '#d3d3d3';
  body.style.setProperty('--graph-canvas-bg', canvasHex);
}

function setGraphNodeColorVariables() {
  const body = document.getElementById('dashboardBody');
  if (!body) return;
  const group = (settings && settings.graphNodeGroupColor) ? String(settings.graphNodeGroupColor).replace(/^#?/, '#') : '#4c1d95';
  const person = (settings && settings.graphNodePersonColor) ? String(settings.graphNodePersonColor).replace(/^#?/, '#') : '#db2777';
  const account = (settings && settings.graphNodeAccountColor) ? String(settings.graphNodeAccountColor).replace(/^#?/, '#') : '#fbcfe8';
  body.style.setProperty('--graph-node-group-bg', group);
  body.style.setProperty('--graph-node-person-bg', person);
  body.style.setProperty('--graph-node-account-bg', account);
}

function setGraphNodeColorVariablesFromForm() {
  const body = document.getElementById('dashboardBody');
  if (!body) return;
  const get = (id, fallback) => {
    const el = document.getElementById(id);
    return (el && el.value) ? String(el.value).replace(/^#?/, '#') : fallback;
  };
  body.style.setProperty('--graph-node-group-bg', get('configGraphNodeGroupColor', '#4c1d95'));
  body.style.setProperty('--graph-node-person-bg', get('configGraphNodePersonColor', '#db2777'));
  body.style.setProperty('--graph-node-account-bg', get('configGraphNodeAccountColor', '#fbcfe8'));
}

function previewAppearanceFromConfigForm() {
  const theme = configTheme.value === 'custom' ? configThemeColorPicker.value : configTheme.value;
  const overrides = getThemeOverrides();
  const configImportantNodeColor = document.getElementById('configImportantNodeColor');
  if (configImportantNodeColor && configImportantNodeColor.value) {
    overrides.importantNodeBorderColor = configImportantNodeColor.value.replace(/^#?/, '#');
  }
  applyDashboardTheme(theme, overrides);
  const body = document.getElementById('dashboardBody');
  if (body && configImportantNodeColor) {
    body.style.setProperty('--important-node-border', (configImportantNodeColor.value || '#dc2626').replace(/^#?/, '#'));
  }
  const configColorScheme = document.getElementById('configColorScheme');
  const colorScheme = (configColorScheme && configColorScheme.value === 'dark') ? 'dark' : 'light';
  const configGraphCanvasColor = document.getElementById('configGraphCanvasColor');
  const graphCanvasColor = (configGraphCanvasColor && configGraphCanvasColor.value) ? configGraphCanvasColor.value.replace(/^#?/, '#') : '#d3d3d3';
  applyColorSchemeAndCanvas(colorScheme, graphCanvasColor);
  setGraphNodeColorVariablesFromForm();
  if (document.getElementById('panel-graph')?.classList.contains('active')) renderGraph();
}

function updateColorSchemeToggleLabel() {
  const btn = document.getElementById('colorSchemeToggle');
  const icon = document.getElementById('colorSchemeToggleIcon');
  if (!btn) return;
  const isDark = (settings && settings.colorScheme === 'dark');
  if (icon) icon.textContent = isDark ? '☀' : '☽';
  btn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
}

document.getElementById('colorSchemeToggle')?.addEventListener('click', async () => {
  const nextScheme = (settings && settings.colorScheme === 'dark') ? 'light' : 'dark';
  await chrome.runtime.sendMessage({ action: 'setSettings', settings: { colorScheme: nextScheme } });
  settings = { ...settings, colorScheme: nextScheme };
  applyColorSchemeAndCanvas(nextScheme, settings.graphCanvasColor || '#d3d3d3');
  updateColorSchemeToggleLabel();
});

const caseSelect = document.getElementById('caseSelect');
const addCaseBtn = document.getElementById('addCaseBtn');
const captureToggle = document.getElementById('captureToggle');
const searchEl = document.getElementById('search');
const tagFilterEl = document.getElementById('tagFilter');
const capturesList = document.getElementById('capturesList');
const capturesEmpty = document.getElementById('capturesEmpty');
const showPreviewsEl = document.getElementById('showPreviews');
const statsSummary = document.getElementById('statsSummary');
const statsContent = document.getElementById('statsContent');
const todoSections = document.getElementById('todoSections');
const todoProgress = document.getElementById('todoProgress');
const todoProgressBar = document.getElementById('todoProgressBar');
const todoProgressText = document.getElementById('todoProgressText');
const todoLoadTemplate = document.getElementById('todoLoadTemplate');
const todoSectionSelect = document.getElementById('todoSectionSelect');
const todoInput = document.getElementById('todoInput');
const todoAddBtn = document.getElementById('todoAdd');
const importFile = document.getElementById('importFile');
const importBtn = document.getElementById('importBtn');
const configCaseSelect = document.getElementById('configCaseSelect');
const configAddCase = document.getElementById('configAddCase');
const configCaptureToggle = document.getElementById('configCaptureToggle');
const configSaveImages = document.getElementById('configSaveImages');
const configTheme = document.getElementById('configTheme');
const configThemeColorPicker = document.getElementById('configThemeColorPicker');
const configIgnoreList = document.getElementById('configIgnoreList');
const configSelectorsList = document.getElementById('configSelectorsList');
const configAddSelector = document.getElementById('configAddSelector');
const messageModal = document.getElementById('messageModal');
const messageModalTitle = document.getElementById('messageModalTitle');
const messageModalBody = document.getElementById('messageModalBody');
const messageModalOk = document.getElementById('messageModalOk');
const promptModal = document.getElementById('promptModal');
const promptModalTitle = document.getElementById('promptModalTitle');
const promptModalLabel = document.getElementById('promptModalLabel');
const promptModalInput = document.getElementById('promptModalInput');
const promptModalOk = document.getElementById('promptModalOk');
const promptModalCancel = document.getElementById('promptModalCancel');
const confirmModal = document.getElementById('confirmModal');
const confirmModalTitle = document.getElementById('confirmModalTitle');
const confirmModalBody = document.getElementById('confirmModalBody');
const confirmModalOk = document.getElementById('confirmModalOk');
const confirmModalCancel = document.getElementById('confirmModalCancel');
const importDuplicateModal = document.getElementById('importDuplicateModal');
const importDuplicateModalTitle = document.getElementById('importDuplicateModalTitle');
const importDuplicateModalBody = document.getElementById('importDuplicateModalBody');
const importDuplicateMerge = document.getElementById('importDuplicateMerge');
const importDuplicateCancel = document.getElementById('importDuplicateCancel');
const importDuplicateNewCase = document.getElementById('importDuplicateNewCase');
const newCaseModal = document.getElementById('newCaseModal');
const newCaseName = document.getElementById('newCaseName');
const newCaseOk = document.getElementById('newCaseOk');
const newCaseCancel = document.getElementById('newCaseCancel');
const detailModal = document.getElementById('detailModal');
const detailClose = document.getElementById('detailClose');
const detailTitle = document.getElementById('detailTitle');
const detailUrl = document.getElementById('detailUrl');
const detailMeta = document.getElementById('detailMeta');
const detailPreview = document.getElementById('detailPreview');
const detailSourceContent = document.getElementById('detailSourceContent');
const detailTechnologies = document.getElementById('detailTechnologies');
const detailHeaders = document.getElementById('detailHeaders');
const detailEmails = document.getElementById('detailEmails');
const detailIps = document.getElementById('detailIps');
const detailNotesInput = document.getElementById('detailNotesInput');
const detailTags = document.getElementById('detailTags');
const detailImportant = document.getElementById('detailImportant');
const detailSave = document.getElementById('detailSave');

let allCaptures = [];
let captures = [];
let cases = [];
let currentCaseId = 'default';
let settings = { captureEnabled: true, blacklist: [], graphShowDomainLinks: true };
let accounts = [];
let people = [];
let groups = [];
let graphLayout = {};
let graphPan = { x: 0, y: 0 };
let graphZoom = 1;
const graphZoomMin = 0.02;
const graphZoomMax = 4;
let graphViewTransform = { minX: 0, minY: 0, scale: 1 };
let graphViewTransformRestored = false; // true when we restored view from case config (don't re-fit on render)
let graphLinkFromId = null;
let graphLinkFromType = null;
/** @type {Set<string>|null} when set, link all selected nodes to the next clicked node */
let graphLinkFromIds = null;
let graphUnlinkFromId = null;
let graphUnlinkFromType = null;
/** @type {Set<string>|null} when set, unlink all selected nodes from the next clicked node */
let graphUnlinkFromIds = null;
let graphIsDraggingNode = false;
let graphDidMoveWhileDrag = false;
let graphIsPanning = false;
/** @type {Set<string>} selected node ids for multi-move */
let graphSelectedNodeIds = new Set();
/** Index for "Next node" cycle (0-based, wraps) */
let graphNextNodeIndex = -1;
let searchQuery = '';
let selectedTagFilter = '';
/** @type {{ includeKeywords: string, excludeKeywords: string, includeTags: string[], excludeTags: string[] }} */
let graphFilter = { includeKeywords: '', excludeKeywords: '', includeTags: [], excludeTags: [] };
let savedGraphFilters = [];
let detailCaptureId = null;
let selectors = [];
let todoItems = [];
let caseTagList = [];
let globalTagList = [];
let dashboardHasUnsavedChanges = false;

function randomUuid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function setDashboardUnsavedChanges(value) {
  dashboardHasUnsavedChanges = !!value;
}

function showMessageModal(title, body) {
  if (messageModalTitle) messageModalTitle.textContent = title || 'Notice';
  if (messageModalBody) messageModalBody.textContent = body || '';
  messageModal.classList.remove('hidden');
  return new Promise(resolve => {
    const done = () => {
      messageModalOk.removeEventListener('click', done);
      messageModal.querySelector('.modal-backdrop').removeEventListener('click', done);
      messageModal.classList.add('hidden');
      resolve();
    };
    messageModalOk.addEventListener('click', done);
    messageModal.querySelector('.modal-backdrop').addEventListener('click', done);
  });
}

function showConfirmModal(title, body) {
  if (confirmModalTitle) confirmModalTitle.textContent = title || 'Confirm';
  if (confirmModalBody) confirmModalBody.textContent = body || '';
  confirmModal.classList.remove('hidden');
  return new Promise(resolve => {
    const onOk = () => {
      confirmModalOk.removeEventListener('click', onOk);
      confirmModalCancel.removeEventListener('click', onCancel);
      confirmModal.querySelector('.modal-backdrop').removeEventListener('click', onCancel);
      confirmModal.classList.add('hidden');
      resolve(true);
    };
    const onCancel = () => {
      confirmModalOk.removeEventListener('click', onOk);
      confirmModalCancel.removeEventListener('click', onCancel);
      confirmModal.querySelector('.modal-backdrop').removeEventListener('click', onCancel);
      confirmModal.classList.add('hidden');
      resolve(false);
    };
    confirmModalOk.addEventListener('click', onOk);
    confirmModalCancel.addEventListener('click', onCancel);
    confirmModal.querySelector('.modal-backdrop').addEventListener('click', onCancel);
  });
}

/** Returns 'merge' | 'cancel' | 'newCase'. Use when importing and a case with the same ID already exists. */
function showImportDuplicateModal(title, body) {
  if (importDuplicateModalTitle) importDuplicateModalTitle.textContent = title || 'Import';
  if (importDuplicateModalBody) importDuplicateModalBody.textContent = body || 'A case with the same ID already exists. How do you want to proceed?';
  importDuplicateModal.classList.remove('hidden');
  return new Promise(resolve => {
    const cleanup = () => {
      importDuplicateMerge.removeEventListener('click', onMerge);
      importDuplicateCancel.removeEventListener('click', onCancel);
      importDuplicateNewCase.removeEventListener('click', onNewCase);
      importDuplicateModal.querySelector('.modal-backdrop').removeEventListener('click', onCancel);
      importDuplicateModal.classList.add('hidden');
    };
    const onMerge = () => { cleanup(); resolve('merge'); };
    const onCancel = () => { cleanup(); resolve('cancel'); };
    const onNewCase = () => { cleanup(); resolve('newCase'); };
    importDuplicateMerge.addEventListener('click', onMerge);
    importDuplicateCancel.addEventListener('click', onCancel);
    importDuplicateNewCase.addEventListener('click', onNewCase);
    importDuplicateModal.querySelector('.modal-backdrop').addEventListener('click', onCancel);
  });
}

function showPromptModal(title, label, defaultValue) {
  if (promptModalTitle) promptModalTitle.textContent = title || 'Input';
  if (promptModalLabel) promptModalLabel.textContent = label || '';
  if (promptModalInput) {
    promptModalInput.value = defaultValue != null ? String(defaultValue) : '';
    promptModalInput.focus();
  }
  promptModal.classList.remove('hidden');
  return new Promise(resolve => {
    const finish = (value) => {
      promptModalOk.removeEventListener('click', onOk);
      promptModalCancel.removeEventListener('click', onCancel);
      promptModal.querySelector('.modal-backdrop').removeEventListener('click', onCancel);
      promptModalInput.removeEventListener('keydown', onKey);
      promptModal.classList.add('hidden');
      resolve(value);
    };
    const onOk = () => finish(promptModalInput ? promptModalInput.value : '');
    const onCancel = () => finish(null);
    const onKey = (e) => { if (e.key === 'Enter') onOk(); if (e.key === 'Escape') onCancel(); };
    promptModalOk.addEventListener('click', onOk);
    promptModalCancel.addEventListener('click', onCancel);
    promptModal.querySelector('.modal-backdrop').addEventListener('click', onCancel);
    promptModalInput.addEventListener('keydown', onKey);
  });
}

const panels = document.querySelectorAll('.panel');
const navItems = document.querySelectorAll('.nav-item');

function setActivePanel(panelId) {
  navItems.forEach(n => n.classList.remove('active'));
  panels.forEach(p => p.classList.remove('active'));
  const item = [...navItems].find(n => n.dataset.panel === panelId) || navItems[0];
  item.classList.add('active');
  const panel = document.getElementById(`panel-${item.dataset.panel}`);
  if (panel) panel.classList.add('active');
  if (item.dataset.panel !== 'graph') {
    const graphSvg = document.getElementById('graphSvg');
    if (graphSvg) graphSvg.innerHTML = '';
  }
  if (item.dataset.panel === 'captures') renderCaptures();
  if (item.dataset.panel === 'stats') { renderStats(); renderSites(); }
  if (item.dataset.panel === 'todo') renderTodo();
  if (item.dataset.panel === 'accounts') renderAccounts();
  if (item.dataset.panel === 'people') renderPeople();
  if (item.dataset.panel === 'groups') renderGroups();
  if (item.dataset.panel === 'images') renderImages();
  if (item.dataset.panel === 'graph') {
    syncGraphFilterFromUI();
    syncGraphFilterToUI();
    renderGraph();
  }
  if (item.dataset.panel === 'config') loadConfigForm();
  try { chrome.storage.local.set({ [DASHBOARD_PANEL_KEY]: item.dataset.panel }); } catch (_) {}
}

navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const targetPanel = item.dataset.panel;
    const currentPanel = [...navItems].find(n => n.classList.contains('active'))?.dataset.panel;
    if (currentPanel === 'config' && targetPanel !== 'config' && dashboardHasUnsavedChanges) {
      showConfirmModal('Unsaved changes', 'You have unsaved changes in Configuration. Leave without saving?')
        .then(async (leave) => {
          if (leave) {
            setDashboardUnsavedChanges(false);
            await loadConfigForm();
            const theme = settings.theme || 'purple';
            applyDashboardTheme(theme, { accentColor: settings.accentColor || '', tagColor: settings.tagColor || '' });
            setGraphNodeColorVariables();
            applyColorSchemeAndCanvas(settings.colorScheme || 'light', settings.graphCanvasColor || '#d3d3d3');
            const ib = (settings.importantNodeBorderColor || '#dc2626').replace(/^#?/, '#');
            document.body.style.setProperty('--important-node-border', ib);
            updateColorSchemeToggleLabel();
            if (document.getElementById('panel-graph')?.classList.contains('active')) renderGraph();
            setActivePanel(targetPanel);
          }
        });
      return;
    }
    setActivePanel(targetPanel);
  });
});

const INFO_MODAL_CONTENT = `
  <p class="info-intro">Shuck saves your browsing trail and research in cases—captures (screenshot + HTML), tags, notes, and reports. Everything stays on your machine.</p>
  <div class="info-section">
    <h4>Capturing</h4>
    <ul>
      <li>To capture a page: click the <strong>Shuck icon</strong> on that page, or right‑click the page → <strong>Shuck: Capture this page</strong>.</li>
      <li>With <strong>Capture on visit</strong> on (topbar), every page you visit is captured automatically.</li>
      <li>Right‑click an image → <strong>Shuck: Annotate this image</strong> to highlight or number areas, then save to the current case.</li>
    </ul>
  </div>
  <div class="info-section">
    <h4>Cases</h4>
    <ul>
      <li>Switch cases with the <strong>Case</strong> dropdown.</li>
      <li>Each case has its own captures, visit log, todo list, and configuration (ignore list, highlight selectors, tag library).</li>
      <li>Create or rename cases in <strong>Configuration</strong>.</li>
    </ul>
  </div>
  <div class="info-section">
    <h4>Captures list & detail</h4>
    <p>Click a capture to open its detail. Tabs:</p>
    <ul>
      <li><strong>Info</strong> — screenshot, URL, hash</li>
      <li><strong>Tech</strong> — detected technologies and server headers</li>
      <li><strong>Source</strong> — HTML with selector highlights</li>
      <li><strong>Data</strong> — emails, IPs</li>
      <li><strong>Notes</strong> — edit notes, tags, attachments, mark important</li>
      <li><strong>Page</strong> — rendered HTML</li>
      <li><strong>Links</strong> — link to other captures or accounts</li>
    </ul>
    <p>Use the <strong>Graph</strong> panel to see links between captures, people, accounts, and groups.</p>
  </div>
  <div class="info-section">
    <h4>Tags & search</h4>
    <ul>
      <li>Add tags in the capture detail or from the tag library (Configuration).</li>
      <li>Filter the list with the <strong>Tag</strong> dropdown.</li>
      <li>Use the search box to search URL, title, notes, and stored HTML.</li>
    </ul>
  </div>
  <div class="info-section">
    <h4>Export & import</h4>
    <ul>
      <li><strong>Export ▾</strong> → <strong>JSON</strong> (full case data including configuration), <strong>HTML</strong> (audit report; use Print → Save as PDF if needed), <strong>CSV</strong> (captures table), <strong>Word</strong> (.doc), <strong>Obsidian</strong> (vault folder or single .md for use in Obsidian).</li>
      <li><strong>Obsidian</strong> — Each note is tagged with its <strong>type</strong> (<code>capture</code>, <code>person</code>, <code>account</code>, <code>group</code>, <code>index</code>, <code>todo</code>) and the <strong>case</strong> (<code>case-CaseName</code>). Any tags you add in the extension (on a capture, person, account, or group) are included. Links between captures, people, accounts, and groups are exported as wiki-links so the Obsidian graph matches the extension graph. Filter by tag (e.g. <code>#case-MyCase</code>) to show one case in the graph or in Dataview.</li>
      <li><strong>Import</strong> restores from a previously exported JSON file. If a case with the same ID exists, you can merge into it, cancel the import, or create a new case from the import.</li>
    </ul>
  </div>
  <div class="info-section">
    <h4>Configuration</h4>
    <p>In <strong>Configuration</strong>, choose a case and set:</p>
    <ul>
      <li><strong>Ignore list</strong> — URLs not to capture</li>
      <li><strong>Highlights</strong> — text or regex patterns highlighted in the Source tab and on the live page via <strong>Highlight</strong></li>
      <li><strong>Tag library</strong> — tags available when tagging captures</li>
    </ul>
    <p>Global options: capture on visit, full capture, inline media, save images in report, hide privacy notices, theme, troubleshooting log.</p>
    <ul>
      <li>No changes are applied until you click <strong>Save configuration</strong>. Use <strong>Cancel</strong> to discard edits and reload from storage.</li>
      <li>Dates and times are in your local timezone; exports use <strong>YYYY-MM-DD</strong> (ISO 8601).</li>
    </ul>
  </div>
  <div class="info-section">
    <h4>Options page</h4>
    <ul>
      <li>Right‑click the Shuck icon → <strong>Options</strong> for a quick settings page (ignore list, highlight selectors, theme).</li>
      <li>Use the dashboard for full control.</li>
    </ul>
  </div>
`;

function openInfoModal() {
  const modal = document.getElementById('infoModal');
  const body = document.getElementById('infoModalBody');
  if (body) body.innerHTML = INFO_MODAL_CONTENT;
  if (modal) modal.classList.remove('hidden');
}
function closeInfoModal() {
  document.getElementById('infoModal')?.classList.add('hidden');
}

document.getElementById('infoBtn')?.addEventListener('click', openInfoModal);
document.getElementById('sidebarInfoBtn')?.addEventListener('click', openInfoModal);
document.getElementById('infoModalClose')?.addEventListener('click', closeInfoModal);
document.getElementById('infoModalCloseBtn')?.addEventListener('click', closeInfoModal);
document.getElementById('infoModal')?.querySelector('.modal-backdrop')?.addEventListener('click', closeInfoModal);

document.getElementById('graphArrangeBtn')?.addEventListener('click', () => {
  if (document.getElementById('panel-graph')?.classList.contains('active')) renderGraph({ arrange: true });
});
document.getElementById('graphNextNodeBtn')?.addEventListener('click', () => {
  const panel = document.getElementById('panel-graph');
  const container = document.getElementById('graphContainer');
  if (!panel?.classList.contains('active') || !container?.graphOrderedNodeIds?.length) return;
  const ids = container.graphOrderedNodeIds;
  graphNextNodeIndex = (graphNextNodeIndex + 1) % ids.length;
  const id = ids[graphNextNodeIndex];
  graphSelectedNodeIds.clear();
  graphSelectedNodeIds.add(id);
  const layout = graphLayout[id];
  const state = container.graphMinimapState;
  if (state && layout && typeof layout.x === 'number' && typeof layout.y === 'number') {
    const pad = state.pad;
    const t = state.t;
    const vx = pad + (layout.x - t.minX) * t.scale;
    const vy = pad + (layout.y - t.minY) * t.scale;
    const w = state.w;
    const h = state.h;
    graphPan.x = w / 2 - vx * graphZoom;
    graphPan.y = h / 2 - vy * graphZoom;
    chrome.runtime.sendMessage({ action: 'setCaseConfig', caseId: currentCaseId, config: { graphPan, graphZoom, graphViewTransform } }).catch(() => {});
  }
  requestAnimationFrame(() => renderGraph({ skipTransformUpdate: true }));
});

document.getElementById('refreshBtn').addEventListener('click', async () => {
  const btn = document.getElementById('refreshBtn');
  if (btn.classList.contains('refreshing')) return;
  btn.classList.add('refreshing');
  try {
    await load();
  } catch (err) {
    console.error('Refresh failed', err);
  } finally {
    setTimeout(() => btn.classList.remove('refreshing'), 600);
  }
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local') return;
  if (changes.shuck_captures) load().catch(() => {});
  if (changes.shuck_settings) {
    const newSettings = await new Promise(r => chrome.runtime.sendMessage({ action: 'getSettings' }, r));
    if (newSettings) {
      settings = newSettings;
      const theme = settings.theme || 'purple';
      applyDashboardTheme(theme, { accentColor: settings.accentColor || '', tagColor: settings.tagColor || '' });
      if (captureToggle) captureToggle.checked = settings.captureEnabled !== false;
      const statusEl = document.getElementById('captureToggleStatus');
      if (statusEl) statusEl.textContent = (settings.captureEnabled !== false) ? 'On' : 'Off';
      const configCaptureToggle = document.getElementById('configCaptureToggle');
      if (configCaptureToggle) configCaptureToggle.checked = settings.captureEnabled !== false;
      const graphSequentialFlowEl = document.getElementById('graphSequentialFlow');
      if (graphSequentialFlowEl) graphSequentialFlowEl.checked = settings.graphSequentialFlow !== false;
      const graphDomainLinksEl = document.getElementById('graphDomainLinks');
      if (graphDomainLinksEl) graphDomainLinksEl.checked = settings.graphShowDomainLinks !== false;
      const graphShowLinkedNodesEl = document.getElementById('graphShowLinkedNodes');
      if (graphShowLinkedNodesEl) graphShowLinkedNodesEl.checked = settings.graphShowLinkedNodes === true;
      if (document.getElementById('panel-graph')?.classList.contains('active')) renderGraph();
    }
  }
});

document.getElementById('graphSequentialFlow')?.addEventListener('change', async function () {
  const on = this.checked;
  await chrome.runtime.sendMessage({ action: 'setSettings', settings: { graphSequentialFlow: on } });
  settings = { ...settings, graphSequentialFlow: on };
  if (document.getElementById('panel-graph')?.classList.contains('active')) renderGraph();
});

document.getElementById('graphDomainLinks')?.addEventListener('change', async function () {
  const on = this.checked;
  await chrome.runtime.sendMessage({ action: 'setSettings', settings: { graphShowDomainLinks: on } });
  settings = { ...settings, graphShowDomainLinks: on };
  if (document.getElementById('panel-graph')?.classList.contains('active')) renderGraph();
});

document.getElementById('graphShowLinkedNodes')?.addEventListener('change', async function () {
  const on = this.checked;
  await chrome.runtime.sendMessage({ action: 'setSettings', settings: { graphShowLinkedNodes: on } });
  settings = { ...settings, graphShowLinkedNodes: on };
  if (document.getElementById('panel-graph')?.classList.contains('active')) renderGraph();
});

searchEl.addEventListener('input', () => {
  searchQuery = searchEl.value.trim().toLowerCase();
  renderCaptures();
});
tagFilterEl.addEventListener('change', () => {
  selectedTagFilter = tagFilterEl.value;
  renderCaptures();
});
if (showPreviewsEl) showPreviewsEl.addEventListener('change', () => renderCaptures());
document.getElementById('captureSort')?.addEventListener('change', async () => {
  const el = document.getElementById('captureSort');
  const value = (el && el.value) || 'newest';
  await chrome.runtime.sendMessage({ action: 'setSettings', settings: { captureSortOrder: value } });
  settings = { ...settings, captureSortOrder: value };
  renderCaptures();
});

function nodeSearchText(item, type) {
  if (type === 'capture') {
    return [item.title, item.url, item.notes || ''].filter(Boolean).join(' ').toLowerCase();
  }
  if (type === 'person') {
    return [item.name, item.notes || ''].filter(Boolean).join(' ').toLowerCase();
  }
  if (type === 'group') {
    return [item.name, item.description || ''].filter(Boolean).join(' ').toLowerCase();
  }
  const sites = Array.isArray(item.sites) ? item.sites.join(' ') : '';
  return [item.label, item.username, item.email, sites].filter(Boolean).join(' ').toLowerCase();
}

function nodeMatchesGraphFilter(item, filter, type) {
  const hasIncludeKw = filter.includeKeywords.trim().length > 0;
  const hasExcludeKw = filter.excludeKeywords.trim().length > 0;
  const hasIncludeTags = filter.includeTags && filter.includeTags.length > 0;
  const hasExcludeTags = filter.excludeTags && filter.excludeTags.length > 0;
  if (!hasIncludeKw && !hasExcludeKw && !hasIncludeTags && !hasExcludeTags) return true;

  const itemTags = (item.tags || []).map(t => String(t).trim());
  const text = nodeSearchText(item, type);

  if (hasIncludeKw) {
    const kws = filter.includeKeywords.toLowerCase().split(/[\s,]+/).filter(Boolean);
    if (!kws.some(kw => text.includes(kw) || itemTags.some(t => t.toLowerCase().includes(kw)))) return false;
  }
  if (hasExcludeKw) {
    const kws = filter.excludeKeywords.toLowerCase().split(/[\s,]+/).filter(Boolean);
    if (kws.some(kw => text.includes(kw) || itemTags.some(t => t.toLowerCase().includes(kw)))) return false;
  }
  if (hasIncludeTags) {
    const inc = filter.includeTags.map(t => String(t).trim().toLowerCase());
    if (!itemTags.some(t => inc.includes(t.toLowerCase()))) return false;
  }
  if (hasExcludeTags) {
    const exc = filter.excludeTags.map(t => String(t).trim().toLowerCase());
    if (itemTags.some(t => exc.includes(t.toLowerCase()))) return false;
  }
  return true;
}

function isGraphFilterActive() {
  return (graphFilter.includeKeywords || graphFilter.excludeKeywords || (graphFilter.includeTags && graphFilter.includeTags.length) || (graphFilter.excludeTags && graphFilter.excludeTags.length));
}

function renderGraphFilterChips() {
  const container = document.getElementById('graphFilterChips');
  if (!container) return;
  const chips = [];
  const incKws = (graphFilter.includeKeywords || '').trim().split(/[\s,]+/).filter(Boolean);
  incKws.forEach(kw => {
    chips.push({ kind: 'includeKeyword', value: kw, label: kw, include: true });
  });
  const excKws = (graphFilter.excludeKeywords || '').trim().split(/[\s,]+/).filter(Boolean);
  excKws.forEach(kw => {
    chips.push({ kind: 'excludeKeyword', value: kw, label: kw, include: false });
  });
  (graphFilter.includeTags || []).forEach(tag => {
    chips.push({ kind: 'includeTag', value: tag, label: tag, include: true });
  });
  (graphFilter.excludeTags || []).forEach(tag => {
    chips.push({ kind: 'excludeTag', value: tag, label: tag, include: false });
  });
  function removeChip(chip) {
    if (chip.kind === 'includeKeyword') {
      const arr = (graphFilter.includeKeywords || '').trim().split(/[\s,]+/).filter(Boolean);
      graphFilter.includeKeywords = arr.filter(x => x !== chip.value).join(' ');
    } else if (chip.kind === 'excludeKeyword') {
      const arr = (graphFilter.excludeKeywords || '').trim().split(/[\s,]+/).filter(Boolean);
      graphFilter.excludeKeywords = arr.filter(x => x !== chip.value).join(' ');
    } else if (chip.kind === 'includeTag') {
      graphFilter.includeTags = (graphFilter.includeTags || []).filter(t => t !== chip.value);
    } else if (chip.kind === 'excludeTag') {
      graphFilter.excludeTags = (graphFilter.excludeTags || []).filter(t => t !== chip.value);
    }
    syncGraphFilterToUI();
    renderGraph();
  }
  container.innerHTML = chips.map(chip => {
    const cls = chip.include ? 'graph-filter-chip-include' : 'graph-filter-chip-exclude';
    const sign = chip.include ? '+' : '−';
    return `<span class="graph-filter-chip ${cls}" title="${chip.include ? 'Include' : 'Exclude'}: ${escapeHtml(chip.label)}">
      <span aria-hidden="true">${sign}</span>
      <span>${escapeHtml(chip.label)}</span>
      <button type="button" class="graph-filter-chip-remove" data-kind="${escapeHtml(chip.kind)}" data-value="${escapeHtml(chip.value)}" aria-label="Remove filter">×</button>
    </span>`;
  }).join('');
  container.querySelectorAll('.graph-filter-chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const chip = chips.find(c => c.kind === btn.dataset.kind && c.value === btn.dataset.value);
      if (chip) removeChip(chip);
    });
  });
}

function applyGraphFilterUI() {
  const active = isGraphFilterActive();
  const clearBtn = document.getElementById('graphFilterClear');
  const badge = document.getElementById('graphFilterBadge');
  const section = document.getElementById('graphFilterSection');
  if (clearBtn) clearBtn.classList.toggle('hidden', !active);
  if (badge) badge.classList.toggle('hidden', !active);
  if (section) section.classList.toggle('graph-filter-active', !!active);
  renderGraphFilterChips();
  const hasIncKw = (graphFilter.includeKeywords || '').trim().length > 0;
  const hasExcKw = (graphFilter.excludeKeywords || '').trim().length > 0;
  const hasIncTags = graphFilter.includeTags && graphFilter.includeTags.length > 0;
  const hasExcTags = graphFilter.excludeTags && graphFilter.excludeTags.length > 0;
  document.getElementById('graphFilterRowKeywords')?.classList.toggle('graph-filter-row-active', !!(hasIncKw || hasExcKw));
  document.getElementById('graphFilterRowTags')?.classList.toggle('graph-filter-row-active', !!(hasIncTags || hasExcTags));
}

function syncGraphFilterFromUI() {
  const incKw = document.getElementById('graphFilterIncludeKeywords');
  const excKw = document.getElementById('graphFilterExcludeKeywords');
  if (incKw) graphFilter.includeKeywords = (incKw.value || '').trim();
  if (excKw) graphFilter.excludeKeywords = (excKw.value || '').trim();
}

function syncGraphFilterToUI() {
  const incKw = document.getElementById('graphFilterIncludeKeywords');
  const excKw = document.getElementById('graphFilterExcludeKeywords');
  if (incKw) incKw.value = graphFilter.includeKeywords || '';
  if (excKw) excKw.value = graphFilter.excludeKeywords || '';
  const incList = document.getElementById('graphFilterIncludeTagsList');
  const excList = document.getElementById('graphFilterExcludeTagsList');
  const incTags = graphFilter.includeTags || [];
  const excTags = graphFilter.excludeTags || [];
  if (incList) {
    incList.innerHTML = incTags.map(tag => `<span class="graph-filter-tag-pill graph-filter-tag-pill-include" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}<button type="button" class="graph-filter-tag-pill-remove" aria-label="Remove">×</button></span>`).join('');
    incList.querySelectorAll('.graph-filter-tag-pill-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.closest('.graph-filter-tag-pill')?.dataset.tag;
        if (tag) { graphFilter.includeTags = (graphFilter.includeTags || []).filter(t => t !== tag); syncGraphFilterToUI(); applyGraphFilterUI(); renderGraph(); }
      });
    });
  }
  if (excList) {
    excList.innerHTML = excTags.map(tag => `<span class="graph-filter-tag-pill graph-filter-tag-pill-exclude" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}<button type="button" class="graph-filter-tag-pill-remove" aria-label="Remove">×</button></span>`).join('');
    excList.querySelectorAll('.graph-filter-tag-pill-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.closest('.graph-filter-tag-pill')?.dataset.tag;
        if (tag) { graphFilter.excludeTags = (graphFilter.excludeTags || []).filter(t => t !== tag); syncGraphFilterToUI(); applyGraphFilterUI(); renderGraph(); }
      });
    });
  }
  populateGraphFilterTagOptions();
  applyGraphFilterUI();
}

function populateGraphFilterTagOptions() {
  const allTags = [...new Set([...captures.flatMap(c => c.tags || []), ...accounts.flatMap(a => a.tags || [])])].filter(Boolean).sort();
  const incAdd = document.getElementById('graphFilterIncludeTagAdd');
  const excAdd = document.getElementById('graphFilterExcludeTagAdd');
  const incSet = new Set(graphFilter.includeTags || []);
  const excSet = new Set(graphFilter.excludeTags || []);
  if (incAdd) {
    const cur = incAdd.value;
    incAdd.innerHTML = '<option value="">+ Add</option>' + allTags.map(t => `<option value="${escapeHtml(t)}" ${incSet.has(t) ? 'disabled' : ''}>${escapeHtml(t)}</option>`).join('');
    if (cur && !incSet.has(cur)) incAdd.value = cur;
    else incAdd.value = '';
  }
  if (excAdd) {
    const cur = excAdd.value;
    excAdd.innerHTML = '<option value="">+ Add</option>' + allTags.map(t => `<option value="${escapeHtml(t)}" ${excSet.has(t) ? 'disabled' : ''}>${escapeHtml(t)}</option>`).join('');
    if (cur && !excSet.has(cur)) excAdd.value = cur;
    else excAdd.value = '';
  }
}

function populateGraphFilterSavedDropdown() {
  const sel = document.getElementById('graphFilterSaved');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— No saved filter —</option>' +
    (savedGraphFilters || []).map(f => `<option value="${escapeHtml(f.id)}">${escapeHtml(f.name)}</option>`).join('');
  if (cur && (savedGraphFilters || []).some(f => f.id === cur)) sel.value = cur;
}

async function loadSavedGraphFilters() {
  const raw = await chrome.storage.local.get(GRAPH_FILTERS_STORAGE_KEY);
  const list = raw[GRAPH_FILTERS_STORAGE_KEY];
  savedGraphFilters = Array.isArray(list) ? list : [];
  populateGraphFilterSavedDropdown();
}

async function saveSavedGraphFilters() {
  await chrome.storage.local.set({ [GRAPH_FILTERS_STORAGE_KEY]: savedGraphFilters });
  populateGraphFilterSavedDropdown();
}

function bindGraphFilterListeners() {
  const run = () => { syncGraphFilterFromUI(); applyGraphFilterUI(); renderGraph(); };
  const incKw = document.getElementById('graphFilterIncludeKeywords');
  const excKw = document.getElementById('graphFilterExcludeKeywords');
  const incAdd = document.getElementById('graphFilterIncludeTagAdd');
  const excAdd = document.getElementById('graphFilterExcludeTagAdd');
  const loadBtn = document.getElementById('graphFilterLoad');
  const saveBtn = document.getElementById('graphFilterSave');
  const editBtn = document.getElementById('graphFilterEdit');
  const deleteBtn = document.getElementById('graphFilterDelete');
  const clearBtn = document.getElementById('graphFilterClear');
  const savedSel = document.getElementById('graphFilterSaved');
  if (incKw) { incKw.addEventListener('input', run); incKw.addEventListener('change', run); }
  if (excKw) { excKw.addEventListener('input', run); excKw.addEventListener('change', run); }
  if (incAdd) {
    incAdd.addEventListener('change', () => {
      const tag = incAdd.value;
      if (!tag) return;
      if (!graphFilter.includeTags) graphFilter.includeTags = [];
      if (!graphFilter.includeTags.includes(tag)) graphFilter.includeTags.push(tag);
      incAdd.value = '';
      syncGraphFilterToUI();
      run();
    });
  }
  if (excAdd) {
    excAdd.addEventListener('change', () => {
      const tag = excAdd.value;
      if (!tag) return;
      if (!graphFilter.excludeTags) graphFilter.excludeTags = [];
      if (!graphFilter.excludeTags.includes(tag)) graphFilter.excludeTags.push(tag);
      excAdd.value = '';
      syncGraphFilterToUI();
      run();
    });
  }
  if (loadBtn) loadBtn.addEventListener('click', () => {
    const id = savedSel?.value;
    if (!id) return;
    const f = (savedGraphFilters || []).find(x => x.id === id);
    if (!f || !f.filter) return;
    graphFilter = { includeKeywords: f.filter.includeKeywords || '', excludeKeywords: f.filter.excludeKeywords || '', includeTags: Array.isArray(f.filter.includeTags) ? f.filter.includeTags.slice() : [], excludeTags: Array.isArray(f.filter.excludeTags) ? f.filter.excludeTags.slice() : [] };
    syncGraphFilterToUI();
    renderGraph();
  });
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    syncGraphFilterFromUI();
    const id = savedSel?.value;
    const existing = id ? (savedGraphFilters || []).find(x => x.id === id) : null;
    if (existing) {
      existing.filter = { includeKeywords: graphFilter.includeKeywords, excludeKeywords: graphFilter.excludeKeywords, includeTags: (graphFilter.includeTags || []).slice(), excludeTags: (graphFilter.excludeTags || []).slice() };
      await saveSavedGraphFilters();
      return;
    }
    const name = await showPromptModal('Save filter', 'Filter name', 'My filter');
    if (name == null || !String(name).trim()) return;
    const newId = 'f' + Date.now();
    savedGraphFilters = savedGraphFilters || [];
    savedGraphFilters.push({
      id: newId,
      name: String(name).trim(),
      filter: { includeKeywords: graphFilter.includeKeywords, excludeKeywords: graphFilter.excludeKeywords, includeTags: (graphFilter.includeTags || []).slice(), excludeTags: (graphFilter.excludeTags || []).slice() },
    });
    await saveSavedGraphFilters();
    if (savedSel) savedSel.value = newId;
  });
  if (editBtn) editBtn.addEventListener('click', async () => {
    const id = savedSel?.value;
    if (!id) return;
    const f = (savedGraphFilters || []).find(x => x.id === id);
    if (!f) return;
    syncGraphFilterFromUI();
    f.filter = { includeKeywords: graphFilter.includeKeywords, excludeKeywords: graphFilter.excludeKeywords, includeTags: (graphFilter.includeTags || []).slice(), excludeTags: (graphFilter.excludeTags || []).slice() };
    const newName = await showPromptModal('Edit filter', 'Filter name', f.name || '');
    if (newName != null && String(newName).trim()) f.name = String(newName).trim();
    await saveSavedGraphFilters();
  });
  if (deleteBtn) deleteBtn.addEventListener('click', async () => {
    const id = savedSel?.value;
    if (!id) return;
    const f = (savedGraphFilters || []).find(x => x.id === id);
    if (!f) return;
    const ok = await showConfirmModal('Delete filter', `Delete saved filter "${f.name}"?`);
    if (!ok) return;
    savedGraphFilters = (savedGraphFilters || []).filter(x => x.id !== id);
    await saveSavedGraphFilters();
    if (savedSel) savedSel.value = '';
  });
  if (clearBtn) clearBtn.addEventListener('click', () => {
    graphFilter = { includeKeywords: '', excludeKeywords: '', includeTags: [], excludeTags: [] };
    syncGraphFilterToUI();
    if (savedSel) savedSel.value = '';
    applyGraphFilterUI();
    renderGraph();
  });
}

async function load() {
  const curCase = await new Promise(r => chrome.runtime.sendMessage({ action: 'getCurrentCaseId' }, r));
  const caseId = curCase || 'default';
  const [data, caseList, sets, selList, todoListResp, accountsResp, peopleResp, groupsResp, caseConfig, globalTags] = await Promise.all([
    getLocalCaptures(),
    new Promise(r => chrome.runtime.sendMessage({ action: 'getCases' }, r)),
    new Promise(r => chrome.runtime.sendMessage({ action: 'getSettings' }, r)),
    new Promise(r => chrome.runtime.sendMessage({ action: 'getSelectors', caseId }, r)),
    new Promise(r => chrome.runtime.sendMessage({ action: 'getTodoList', caseId }, r)),
    new Promise(r => chrome.runtime.sendMessage({ action: 'getAccounts', caseId }, r)),
    new Promise(r => chrome.runtime.sendMessage({ action: 'getPeople', caseId }, r)),
    new Promise(r => chrome.runtime.sendMessage({ action: 'getGroups', caseId }, r)),
    new Promise(r => chrome.runtime.sendMessage({ action: 'getCaseConfig', caseId }, r)),
    new Promise(r => chrome.runtime.sendMessage({ action: 'getGlobalTags' }, r)),
  ]);
  allCaptures = (data && data.captures) ? data.captures : [];
  cases = Array.isArray(caseList) ? caseList : [];
  currentCaseId = (caseId && cases.some(c => c.id === caseId)) ? caseId : (cases[0] ? cases[0].id : '');
  settings = sets || settings;
  selectors = Array.isArray(selList) ? selList : [];
  globalTagList = Array.isArray(globalTags) ? globalTags : [];
  caseTagList = Array.isArray(caseConfig?.tags) ? caseConfig.tags : [];
  const caseCaptures = allCaptures.filter(c => (c.caseId || 'default') === currentCaseId);
  captures = caseCaptures; // Show all captures (multiple per URL allowed for manual captures)
  todoItems = Array.isArray(todoListResp) ? todoListResp : [];
  accounts = Array.isArray(accountsResp) ? accountsResp : [];
  people = Array.isArray(peopleResp) ? peopleResp : [];
  groups = Array.isArray(groupsResp) ? groupsResp : [];
  graphLayout = (caseConfig && caseConfig.graphLayout && typeof caseConfig.graphLayout === 'object') ? caseConfig.graphLayout : {};
  graphViewTransformRestored = false;
  if (caseConfig && caseConfig.graphViewTransform && typeof caseConfig.graphViewTransform === 'object') {
    graphViewTransform = { minX: caseConfig.graphViewTransform.minX, minY: caseConfig.graphViewTransform.minY, scale: caseConfig.graphViewTransform.scale };
    graphViewTransformRestored = true;
  }
  if (caseConfig && caseConfig.graphPan && typeof caseConfig.graphPan === 'object') {
    graphPan = { x: caseConfig.graphPan.x, y: caseConfig.graphPan.y };
  }
  if (caseConfig && typeof caseConfig.graphZoom === 'number') {
    graphZoom = Math.max(graphZoomMin, Math.min(graphZoomMax, caseConfig.graphZoom));
  }

  const theme = settings.theme || 'purple';
  applyDashboardTheme(theme, {
    accentColor: settings.accentColor || '',
    tagColor: settings.tagColor || '',
    importantNodeBorderColor: settings.importantNodeBorderColor || '#dc2626',
  });
  applyColorSchemeAndCanvas(settings.colorScheme || 'light', settings.graphCanvasColor || '#d3d3d3');
  setGraphNodeColorVariables();
  updateColorSchemeToggleLabel();

  captureToggle.checked = settings.captureEnabled;
  updateCaptureToggleStatus();
  const captureSortEl = document.getElementById('captureSort');
  if (captureSortEl) captureSortEl.value = (settings.captureSortOrder || 'newest');
  const graphSequentialFlowEl = document.getElementById('graphSequentialFlow');
  if (graphSequentialFlowEl) graphSequentialFlowEl.checked = settings.graphSequentialFlow !== false;
  const graphDomainLinksEl = document.getElementById('graphDomainLinks');
  if (graphDomainLinksEl) graphDomainLinksEl.checked = settings.graphShowDomainLinks !== false;
  const graphShowLinkedNodesEl = document.getElementById('graphShowLinkedNodes');
  if (graphShowLinkedNodesEl) graphShowLinkedNodesEl.checked = settings.graphShowLinkedNodes === true;
  const caseOpts = cases.map(c => `<option value="${escapeHtml(c.id)}" ${c.id === currentCaseId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');
  caseSelect.innerHTML = caseOpts;
  if (configCaseSelect) configCaseSelect.innerHTML = caseOpts;
  const allTags = [...new Set(captures.flatMap(c => c.tags || []))].sort();
  tagFilterEl.innerHTML = '<option value="">All tags</option>' + allTags.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');

  await loadSavedGraphFilters();
  syncGraphFilterFromUI();
  syncGraphFilterToUI();

  renderCaptures();
  renderStats();
  renderSites();
  renderTodo();
  renderAccounts();
  renderPeople();
  renderGroups();
  renderImages();
  renderGraph();
  updateStats();
  updateDashboardHighlightButton();
  setDashboardUnsavedChanges(false);
  const stored = await chrome.storage.local.get(DASHBOARD_PANEL_KEY);
  const savedPanel = stored[DASHBOARD_PANEL_KEY];
  if (savedPanel && [...navItems].some(n => n.dataset.panel === savedPanel)) setActivePanel(savedPanel);
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

function captureRichnessScore(c) {
  return (c.imageDataUrl ? 2 : 0) + ((c.htmlContent && c.htmlContent.length) ? 1 : 0) + ((c.technologies && c.technologies.length) ? 0.5 : 0);
}
/** For each URL keep the capture with the most data (preview preferred); so we never show a duplicate without preview if another had one. */
function pickBestCapturePerUrl(captureList) {
  const byUrl = new Map();
  for (const c of captureList) {
    const urlNorm = normalizeUrlForCompare(c.url);
    const score = captureRichnessScore(c);
    const existing = byUrl.get(urlNorm);
    const existingScore = existing ? captureRichnessScore(existing) : -1;
    if (!existing || score > existingScore || (score === existingScore && new Date(c.timestamp || 0) > new Date(existing.timestamp || 0))) {
      byUrl.set(urlNorm, c);
    }
  }
  return [...byUrl.values()];
}

function filterCaptures() {
  // Exclude image-only captures (screenshot only / annotate); those appear only in Images section
  let out = captures.filter(c => !isImageOnlyCapture(c));
  if (selectedTagFilter) out = out.filter(c => (c.tags || []).includes(selectedTagFilter));
  if (searchQuery) {
    const q = searchQuery;
    out = out.filter(c => `${c.title || ''} ${c.url || ''} ${(c.notes || '')} ${(c.tags || []).join(' ')} ${(c.htmlContent || '').slice(0, 5000)}`.toLowerCase().includes(q));
  }
  const sortOrder = (settings && settings.captureSortOrder) || 'newest';
  const ta = (c) => (c.timestamp ? new Date(c.timestamp).getTime() : 0);
  if (sortOrder === 'oldest') {
    out = [...out].sort((a, b) => ta(a) - ta(b));
  } else if (sortOrder === 'favourites') {
    out = [...out].sort((a, b) => (b.important ? 1 : 0) - (a.important ? 1 : 0) || ta(b) - ta(a));
  } else {
    out = [...out].sort((a, b) => ta(b) - ta(a));
  }
  return out;
}
function renderCaptures() {
  const filtered = filterCaptures();
  const showThumbs = showPreviewsEl && showPreviewsEl.checked;
  capturesList.innerHTML = '';
  capturesEmpty.classList.toggle('hidden', filtered.length > 0);
  const urlNormCount = {};
  filtered.forEach(c => {
    const u = normalizeUrlForCompare(c.url);
    urlNormCount[u] = (urlNormCount[u] || 0) + 1;
  });
  filtered.forEach(c => {
    const li = document.createElement('li');
    li.dataset.id = c.id;
    if (c.important) li.classList.add('item-important');
    const time = formatTime(c.timestamp);
    const hasScreenshot = !!(c.imageDataUrl);
    const hasHtml = !!(c.htmlContent);
    const thumbFallbackText = hasHtml ? 'HTML' : '—';
    const thumbPlaceholder = '<div class="capture-thumb capture-thumb-fallback" title="Preview in Details"><span class="capture-thumb-fallback-text">' + thumbFallbackText + '</span></div>';
    const thumb = showThumbs
      ? (hasScreenshot
          ? `<div class="capture-thumb"><img src="${c.imageDataUrl}" alt="" /></div>`
          : thumbPlaceholder)
      : '';
    const hasNotes = !!(c.notes && String(c.notes).trim());
    const noteLabel = hasNotes ? '<span class="capture-icon-label" title="Has notes">Has notes</span>' : '';
    const sourceLabel = getCaptureSourceLabel(c);
    const sameUrlNorm = normalizeUrlForCompare(c.url);
    const hasSameUrlOthers = (urlNormCount[sameUrlNorm] || 0) > 1;
    const sameUrlLabel = hasSameUrlOthers ? '<span class="capture-icon-label" title="Multiple captures from this URL">Same URL</span>' : '';
    const captureIconsRow = (noteLabel || sameUrlLabel) ? `<div class="capture-icons-row">${noteLabel}${sameUrlLabel}</div>` : '';
    li.innerHTML = `
      ${thumb}
      <div class="item-body">
        <div class="item-title">${c.important ? '★ ' : ''}${escapeHtml(c.title || c.url)}</div>
        <div class="item-url">${escapeHtml(c.url)}</div>
        <div class="item-meta">${time} · <span class="capture-source-badge">${escapeHtml(sourceLabel)}</span>${c.contentHash ? ' · ' + (c.contentHash || '').slice(0, 12) + '…' : ''}</div>
        ${(c.tags && c.tags.length) ? `<div class="item-tags">${c.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        <div class="capture-actions">
          ${c.inlineFailed ? `<button type="button" class="request-from-server btn btn-secondary" data-id="${c.id}" title="Fetch inlined content from server">Request from server</button>` : ''}
          <button type="button" class="important-capture" data-id="${c.id}" title="Mark important">${c.important ? '★' : '☆'}</button>
          <button type="button" class="add-tag" data-id="${c.id}">+ Tag</button>
          <button type="button" class="view-detail" data-id="${c.id}">Details</button>
          <button type="button" class="delete-capture" data-id="${c.id}">Delete</button>
        </div>
        ${captureIconsRow}
      </div>
    `;
    const thumbEl = li.querySelector('.capture-thumb img');
    if (thumbEl) {
      thumbEl.addEventListener('error', () => {
        const wrap = thumbEl.closest('.capture-thumb');
        if (wrap && !wrap.querySelector('.capture-thumb-fallback-text')) {
          wrap.innerHTML = '<span class="capture-thumb-fallback-text" title="Preview in Details">' + (c.htmlContent ? 'HTML' : '—') + '</span>';
          wrap.classList.add('capture-thumb-fallback');
        }
      });
    }
    li.querySelectorAll('.request-from-server').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); requestReinlineFromList(c.id, c.url); }));
    li.querySelector('.important-capture').addEventListener('click', e => { e.stopPropagation(); markImportant(c.id); });
    li.querySelector('.add-tag').addEventListener('click', e => { e.stopPropagation(); addTag(c.id); });
    li.querySelector('.view-detail').addEventListener('click', e => { e.stopPropagation(); openDetail(c.id); });
    li.querySelector('.delete-capture').addEventListener('click', e => { e.stopPropagation(); deleteCapture(c.id); });
    li.addEventListener('click', e => { if (!e.target.closest('button')) openDetail(c.id); });
    capturesList.appendChild(li);
  });
}

async function requestReinlineFromList(captureId, captureUrl) {
  const res = await chrome.runtime.sendMessage({ action: 'reinlineCaptureFromServer', captureId });
  if (res && res.error) {
    if (captureUrl && (res.error.includes('Open the captured page') || res.error.includes('No tab'))) {
      chrome.tabs.create({ url: captureUrl });
      showMessageModal('Notice', 'Page opened in a new tab. Switch to that tab, open the Shuck popup, and click "Request from server" on this capture.');
    } else showMessageModal('Error', res.error);
  } else load();
}

async function markImportant(id) {
  const c = allCaptures.find(x => x.id === id);
  if (!c) return;
  await chrome.runtime.sendMessage({ action: 'updateCapture', id, updates: { important: !c.important } });
  load();
}

const accountsList = document.getElementById('accountsList');
const accountsEmpty = document.getElementById('accountsEmpty');

function renderAccounts() {
  if (!accountsList) return;
  accountsList.innerHTML = '';
  if (accountsEmpty) accountsEmpty.classList.toggle('hidden', accounts.length > 0);
  accounts.forEach((acc, i) => {
    const li = document.createElement('li');
    const label = acc.label || acc.username || acc.email || 'Account';
    const parts = [acc.username, acc.email].filter(Boolean).map(p => escapeHtml(p));
    const sites = (acc.sites || []).filter(Boolean);
    const sitesHtml = sites.length ? `<div class="item-sites">${sites.map(s => `<span class="site-pill">${escapeHtml(s)}</span>`).join('')}</div>` : '';
    const tags = (acc.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
    li.innerHTML = `
      <div class="item-body">
        <div class="item-title">${escapeHtml(label)}</div>
        ${parts.length ? `<div class="item-url">${parts.join(' · ')}</div>` : ''}
        ${sitesHtml}
        ${acc.password ? '<div class="item-meta">••••••••</div>' : ''}
        ${tags ? `<div class="item-tags">${tags}</div>` : ''}
        <div class="capture-actions">
          <button type="button" class="account-edit" data-i="${i}">Edit</button>
          <button type="button" class="account-delete" data-i="${i}">Delete</button>
        </div>
      </div>
    `;
    li.querySelector('.account-edit').addEventListener('click', (e) => { e.stopPropagation(); openAccountModal(i); });
    li.querySelector('.account-delete').addEventListener('click', (e) => { e.stopPropagation(); deleteAccount(i); });
    accountsList.appendChild(li);
  });
}

const peopleList = document.getElementById('peopleList');
const peopleEmpty = document.getElementById('peopleEmpty');

function renderPeople() {
  if (!peopleList) return;
  peopleList.innerHTML = '';
  if (peopleEmpty) peopleEmpty.classList.toggle('hidden', people.length > 0);
  people.forEach((p, i) => {
    const li = document.createElement('li');
    const name = p.name || 'Unnamed';
    const notes = (p.notes || '').trim();
    const linkedAccounts = accounts.filter(a => (a.personId || '') === p.id);
    const linkedGroups = groups.filter(g => (g.personIds || []).includes(p.id));
    li.innerHTML = `
      <div class="item-body">
        <div class="item-title">${escapeHtml(name)}</div>
        ${notes ? `<div class="item-meta">${escapeHtml(notes.slice(0, 100))}${notes.length > 100 ? '…' : ''}</div>` : ''}
        ${linkedAccounts.length ? `<div class="item-meta">${linkedAccounts.length} account(s) linked</div>` : ''}
        ${linkedGroups.length ? `<div class="item-meta">${linkedGroups.length} group(s)</div>` : ''}
        <div class="capture-actions">
          <button type="button" class="person-edit" data-i="${i}">Edit</button>
          <button type="button" class="person-delete" data-i="${i}">Delete</button>
        </div>
      </div>
    `;
    li.querySelector('.person-edit').addEventListener('click', (e) => { e.stopPropagation(); openPersonModal(i); });
    li.querySelector('.person-delete').addEventListener('click', (e) => { e.stopPropagation(); deletePerson(i); });
    peopleList.appendChild(li);
  });
}

function openPersonModal(editIndex) {
  const modal = document.getElementById('personModal');
  const titleEl = document.getElementById('personModalTitle');
  const nameEl = document.getElementById('personName');
  const notesEl = document.getElementById('personNotes');
  const personGroupsList = document.getElementById('personGroupsList');
  const personGroupAdd = document.getElementById('personGroupAdd');
  if (personGroupAdd) {
    personGroupAdd.innerHTML = '<option value="">— Add group —</option>' + groups.map(g => `<option value="${escapeHtml(g.id)}">${escapeHtml(g.name || g.id)}</option>`).join('');
  }
  if (editIndex !== undefined && people[editIndex]) {
    const p = people[editIndex];
    modal.dataset.editIndex = String(editIndex);
    titleEl.textContent = 'Edit person';
    nameEl.value = p.name || '';
    notesEl.value = p.notes || '';
    const groupIds = p.groupIds || [];
    if (personGroupsList) {
      personGroupsList.innerHTML = groupIds.map(gid => {
        const g = groups.find(x => x.id === gid);
        return `<li class="detail-link-row" data-group-id="${escapeHtml(gid)}"><div class="detail-link-row-head"><span>${escapeHtml(g ? g.name || gid : gid)}</span><button type="button" class="btn-remove-att person-group-remove" data-group-id="${escapeHtml(gid)}">×</button></div></li>`;
      }).join('');
      personGroupsList.querySelectorAll('.person-group-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          const gid = btn.dataset.groupId;
          const li = personGroupsList.querySelector(`[data-group-id="${escapeHtml(gid)}"]`);
          if (li) li.remove();
        });
      });
    }
  } else {
    modal.dataset.editIndex = '';
    titleEl.textContent = 'Add person';
    nameEl.value = '';
    notesEl.value = '';
    if (personGroupsList) personGroupsList.innerHTML = '';
  }
  if (personGroupAdd) {
    personGroupAdd.onchange = () => {
      const gid = personGroupAdd.value;
      if (!gid) return;
      const g = groups.find(x => x.id === gid);
      if (!personGroupsList.querySelector(`[data-group-id="${escapeHtml(gid)}"]`)) {
        const li = document.createElement('li');
        li.className = 'detail-link-row';
        li.dataset.groupId = gid;
        li.innerHTML = `<div class="detail-link-row-head"><span>${escapeHtml(g ? g.name || gid : gid)}</span><button type="button" class="person-group-remove" data-group-id="${escapeHtml(gid)}">×</button></div>`;
        li.querySelector('.person-group-remove').addEventListener('click', () => li.remove());
        personGroupsList.appendChild(li);
      }
      personGroupAdd.value = '';
    };
  }
  modal.classList.remove('hidden');
}

function closePersonModal() {
  document.getElementById('personModal').classList.add('hidden');
}

async function savePerson() {
  const nameEl = document.getElementById('personName');
  const notesEl = document.getElementById('personNotes');
  const personGroupsList = document.getElementById('personGroupsList');
  const name = (nameEl?.value || '').trim();
  if (!name) {
    showMessageModal('Required', 'Enter a name.');
    return;
  }
  const editIndex = document.getElementById('personModal').dataset.editIndex;
  const next = [...people];
  const existing = editIndex !== '' && people[parseInt(editIndex, 10)] ? people[parseInt(editIndex, 10)] : null;
  const groupIds = personGroupsList ? [...new Set([...personGroupsList.querySelectorAll('[data-group-id]')].map(li => li.dataset.groupId).filter(Boolean))] : [];
  const record = {
    id: existing ? existing.id : randomUuid(),
    name,
    notes: (notesEl?.value || '').trim() || undefined,
    groupIds: groupIds.length ? groupIds : undefined,
  };
  if (editIndex !== '' && existing) {
    next[parseInt(editIndex, 10)] = record;
  } else {
    next.push(record);
  }
  await chrome.runtime.sendMessage({ action: 'setPeople', caseId: currentCaseId, list: next });
  syncGroupPersonIdsFromPeople(next);
  await chrome.runtime.sendMessage({ action: 'setGroups', caseId: currentCaseId, list: groups });
  closePersonModal();
  load();
}

function syncGroupPersonIdsFromPeople(peopleList) {
  const list = peopleList || people;
  groups.forEach(g => {
    g.personIds = [...new Set(list.filter(p => (p.groupIds || []).includes(g.id)).map(p => p.id))];
  });
}

function syncPersonGroupIdsFromGroups() {
  people.forEach(p => {
    p.groupIds = [...new Set(groups.filter(g => (g.personIds || []).includes(p.id)).map(g => g.id))];
  });
}

async function deletePerson(index) {
  const ok = await showConfirmModal('Delete person', 'Delete this person? Linked accounts and group memberships will be removed.');
  if (!ok) return;
  const p = people[index];
  const nextPeople = people.filter((_, i) => i !== index);
  const nextAccounts = accounts.map(a => (a.personId === p.id ? { ...a, personId: undefined } : a));
  const nextGroups = groups.map(g => ({
    ...g,
    personIds: (g.personIds || []).filter(pid => pid !== p.id),
  }));
  await chrome.runtime.sendMessage({ action: 'setPeople', caseId: currentCaseId, list: nextPeople });
  await chrome.runtime.sendMessage({ action: 'setAccounts', caseId: currentCaseId, list: nextAccounts });
  await chrome.runtime.sendMessage({ action: 'setGroups', caseId: currentCaseId, list: nextGroups });
  load();
}

document.getElementById('addPersonBtn')?.addEventListener('click', () => openPersonModal());
document.getElementById('personCancel')?.addEventListener('click', closePersonModal);
document.getElementById('personSave')?.addEventListener('click', savePerson);
document.getElementById('personModal')?.querySelector('.modal-backdrop')?.addEventListener('click', closePersonModal);

const groupsList = document.getElementById('groupsList');
const groupsEmpty = document.getElementById('groupsEmpty');

function renderGroups() {
  if (!groupsList) return;
  groupsList.innerHTML = '';
  if (groupsEmpty) groupsEmpty.classList.toggle('hidden', groups.length > 0);
  groups.forEach((g, i) => {
    const li = document.createElement('li');
    const name = g.name || 'Unnamed group';
    const desc = (g.description || '').trim();
    const personCount = (g.personIds || []).length;
    const groupCount = (g.groupIds || []).length;
    li.innerHTML = `
      <div class="item-body">
        <div class="item-title">${escapeHtml(name)}</div>
        ${desc ? `<div class="item-meta">${escapeHtml(desc.slice(0, 100))}${desc.length > 100 ? '…' : ''}</div>` : ''}
        <div class="item-meta">${personCount} person(s), ${groupCount} linked group(s)</div>
        <div class="capture-actions">
          <button type="button" class="group-edit" data-i="${i}">Edit</button>
          <button type="button" class="group-delete" data-i="${i}">Delete</button>
        </div>
      </div>
    `;
    li.querySelector('.group-edit').addEventListener('click', (e) => { e.stopPropagation(); openGroupModal(i); });
    li.querySelector('.group-delete').addEventListener('click', (e) => { e.stopPropagation(); deleteGroup(i); });
    groupsList.appendChild(li);
  });
}

function openGroupModal(editIndex) {
  const modal = document.getElementById('groupModal');
  const titleEl = document.getElementById('groupModalTitle');
  const nameEl = document.getElementById('groupName');
  const descEl = document.getElementById('groupDescription');
  const groupPeopleList = document.getElementById('groupPeopleList');
  const groupPersonAdd = document.getElementById('groupPersonAdd');
  const groupGroupsList = document.getElementById('groupGroupsList');
  const groupGroupAdd = document.getElementById('groupGroupAdd');
  if (groupPersonAdd) {
    groupPersonAdd.innerHTML = '<option value="">— Add person —</option>' + people.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name || p.id)}</option>`).join('');
  }
  if (groupGroupAdd) {
    groupGroupAdd.innerHTML = '<option value="">— Add group —</option>' + groups.filter(g => g.id !== (groups[editIndex]?.id)).map(g => `<option value="${escapeHtml(g.id)}">${escapeHtml(g.name || g.id)}</option>`).join('');
  }
  if (editIndex !== undefined && groups[editIndex]) {
    const g = groups[editIndex];
    modal.dataset.editIndex = String(editIndex);
    titleEl.textContent = 'Edit group';
    nameEl.value = g.name || '';
    descEl.value = g.description || '';
    const personIds = [...new Set(g.personIds || [])];
    const groupIds = [...new Set(g.groupIds || [])];
    if (groupPeopleList) {
      groupPeopleList.innerHTML = personIds.map(pid => {
        const p = people.find(x => x.id === pid);
        return `<li class="detail-link-row" data-person-id="${escapeHtml(pid)}"><div class="detail-link-row-head"><span>${escapeHtml(p ? p.name || pid : pid)}</span><button type="button" class="btn-remove-att group-person-remove" data-person-id="${escapeHtml(pid)}">×</button></div></li>`;
      }).join('');
      groupPeopleList.querySelectorAll('.group-person-remove').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('li')?.remove());
      });
    }
    if (groupGroupsList) {
      groupGroupsList.innerHTML = groupIds.map(gid => {
        const other = groups.find(x => x.id === gid);
        return `<li class="detail-link-row" data-linked-group-id="${escapeHtml(gid)}"><div class="detail-link-row-head"><span>${escapeHtml(other ? other.name || gid : gid)}</span><button type="button" class="btn-remove-att group-group-remove" data-linked-group-id="${escapeHtml(gid)}">×</button></div></li>`;
      }).join('');
      groupGroupsList.querySelectorAll('.group-group-remove').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('li')?.remove());
      });
    }
  } else {
    modal.dataset.editIndex = '';
    titleEl.textContent = 'Add group';
    nameEl.value = '';
    descEl.value = '';
    if (groupPeopleList) groupPeopleList.innerHTML = '';
    if (groupGroupsList) groupGroupsList.innerHTML = '';
  }
  if (groupPersonAdd) {
    groupPersonAdd.onchange = () => {
      const pid = groupPersonAdd.value;
      if (!pid) return;
      const p = people.find(x => x.id === pid);
      if (!groupPeopleList.querySelector(`[data-person-id="${escapeHtml(pid)}"]`)) {
        const li = document.createElement('li');
        li.className = 'detail-link-row';
        li.dataset.personId = pid;
        li.innerHTML = `<div class="detail-link-row-head"><span>${escapeHtml(p ? p.name || pid : pid)}</span><button type="button" class="group-person-remove" data-person-id="${escapeHtml(pid)}">×</button></div>`;
        li.querySelector('.group-person-remove').addEventListener('click', () => li.remove());
        groupPeopleList.appendChild(li);
      }
      groupPersonAdd.value = '';
    };
  }
  if (groupGroupAdd) {
    groupGroupAdd.onchange = () => {
      const gid = groupGroupAdd.value;
      if (!gid) return;
      const other = groups.find(x => x.id === gid);
      if (!groupGroupsList.querySelector(`[data-linked-group-id="${escapeHtml(gid)}"]`)) {
        const li = document.createElement('li');
        li.className = 'detail-link-row';
        li.dataset.linkedGroupId = gid;
        li.innerHTML = `<div class="detail-link-row-head"><span>${escapeHtml(other ? other.name || gid : gid)}</span><button type="button" class="group-group-remove" data-linked-group-id="${escapeHtml(gid)}">×</button></div>`;
        li.querySelector('.group-group-remove').addEventListener('click', () => li.remove());
        groupGroupsList.appendChild(li);
      }
      groupGroupAdd.value = '';
    };
  }
  modal.classList.remove('hidden');
}

function closeGroupModal() {
  document.getElementById('groupModal').classList.add('hidden');
}

async function saveGroup() {
  const nameEl = document.getElementById('groupName');
  const descEl = document.getElementById('groupDescription');
  const groupPeopleList = document.getElementById('groupPeopleList');
  const groupGroupsList = document.getElementById('groupGroupsList');
  const name = (nameEl?.value || '').trim();
  if (!name) {
    showMessageModal('Required', 'Enter a group name.');
    return;
  }
  const editIndex = document.getElementById('groupModal').dataset.editIndex;
  const next = [...groups];
  const existing = editIndex !== '' && groups[parseInt(editIndex, 10)] ? groups[parseInt(editIndex, 10)] : null;
  const personIds = groupPeopleList ? [...new Set([...groupPeopleList.querySelectorAll('[data-person-id]')].map(li => li.dataset.personId).filter(Boolean))] : [];
  const groupIds = groupGroupsList ? [...new Set([...groupGroupsList.querySelectorAll('[data-linked-group-id]')].map(li => li.dataset.linkedGroupId).filter(Boolean))] : [];
  const record = {
    id: existing ? existing.id : randomUuid(),
    name,
    description: (descEl?.value || '').trim() || undefined,
    personIds: personIds.length ? personIds : undefined,
    groupIds: groupIds.length ? groupIds : undefined,
  };
  if (editIndex !== '' && existing) {
    next[parseInt(editIndex, 10)] = record;
  } else {
    next.push(record);
  }
  await chrome.runtime.sendMessage({ action: 'setGroups', caseId: currentCaseId, list: next });
  groups = next;
  syncPersonGroupIdsFromGroups();
  await chrome.runtime.sendMessage({ action: 'setPeople', caseId: currentCaseId, list: people });
  closeGroupModal();
  load();
}

async function deleteGroup(index) {
  const g = groups[index];
  const ok = await showConfirmModal('Delete group', `Delete "${g?.name || g?.id || 'this group'}"? People will be unlinked and links from other groups removed.`);
  if (!ok) return;
  const deletedId = g.id;
  const next = groups.filter((_, i) => i !== index).map(grp => ({
    ...grp,
    groupIds: (grp.groupIds || []).filter(gid => gid !== deletedId),
  }));
  const nextPeople = people.map(p => ({
    ...p,
    groupIds: (p.groupIds || []).filter(gid => gid !== deletedId),
  }));
  await chrome.runtime.sendMessage({ action: 'setGroups', caseId: currentCaseId, list: next });
  await chrome.runtime.sendMessage({ action: 'setPeople', caseId: currentCaseId, list: nextPeople });
  load();
}

document.getElementById('addGroupBtn')?.addEventListener('click', () => openGroupModal());
document.getElementById('groupCancel')?.addEventListener('click', closeGroupModal);
document.getElementById('groupSave')?.addEventListener('click', saveGroup);
document.getElementById('groupModal')?.querySelector('.modal-backdrop')?.addEventListener('click', closeGroupModal);

const imagesList = document.getElementById('imagesList');
const imagesEmpty = document.getElementById('imagesEmpty');

function getCaptureSourceLabel(c) {
  const src = c.captureSource;
  if (src === 'auto') return 'Automatic';
  if (src === 'manual') return 'Manual';
  if (src === 'screenshot') return 'Manual screenshot';
  if (src === 'annotation') return 'Image annotation';
  if (!src && /^Annotated/i.test(String(c.title || ''))) return 'Image annotation';
  return 'Manual';
}

function isImageOnlyCapture(c) {
  if (!c.imageDataUrl) return false;
  const src = c.captureSource;
  if (src === 'annotation' || src === 'screenshot') return true;
  if (!src && /^Annotated/i.test(String(c.title || ''))) return true;
  return false;
}

function renderImages() {
  if (!imagesList) return;
  const withImages = captures.filter(c => isImageOnlyCapture(c));
  imagesList.innerHTML = '';
  if (imagesEmpty) imagesEmpty.classList.toggle('hidden', withImages.length > 0);
  const imagesUrlCount = {};
  withImages.forEach(c => {
    const u = normalizeUrlForCompare(c.url);
    imagesUrlCount[u] = (imagesUrlCount[u] || 0) + 1;
  });
  withImages.forEach(c => {
    const li = document.createElement('li');
    li.dataset.id = c.id;
    if (c.important) li.classList.add('item-important');
    const time = formatTime(c.timestamp);
    const sourceLabel = getCaptureSourceLabel(c);
    const sameUrlNorm = normalizeUrlForCompare(c.url);
    const hasSameUrlOthers = (imagesUrlCount[sameUrlNorm] || 0) > 1;
    const sameUrlLabel = hasSameUrlOthers ? '<span class="capture-icon-label" title="Multiple captures from this URL">Same URL</span>' : '';
    const hasNotes = !!(c.notes && String(c.notes).trim());
    const noteLabel = hasNotes ? '<span class="capture-icon-label" title="Has notes">Has notes</span>' : '';
    const captureIconsRow = (noteLabel || sameUrlLabel) ? `<div class="capture-icons-row">${noteLabel}${sameUrlLabel}</div>` : '';
    li.innerHTML = `
      <div class="capture-thumb"><img src="${c.imageDataUrl}" alt="" /></div>
      <div class="item-body">
        <div class="item-title">${c.important ? '★ ' : ''}${escapeHtml(c.title || c.url)}</div>
        <div class="item-url">${escapeHtml(c.url)}</div>
        <div class="item-meta">${time} · <span class="capture-source-badge">${escapeHtml(sourceLabel)}</span></div>
        ${(c.tags && c.tags.length) ? `<div class="item-tags">${c.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        <div class="capture-actions">
          <button type="button" class="important-capture" data-id="${c.id}" title="Mark important">${c.important ? '★' : '☆'}</button>
          <button type="button" class="add-tag" data-id="${c.id}">+ Tag</button>
          <button type="button" class="view-detail" data-id="${c.id}">Details</button>
          <button type="button" class="delete-capture" data-id="${c.id}">Delete</button>
        </div>
        ${captureIconsRow}
      </div>
    `;
    li.querySelector('.important-capture').addEventListener('click', e => { e.stopPropagation(); markImportant(c.id); });
    li.querySelector('.add-tag').addEventListener('click', e => { e.stopPropagation(); addTag(c.id); });
    li.querySelector('.view-detail').addEventListener('click', e => { e.stopPropagation(); openDetail(c.id); });
    li.querySelector('.delete-capture').addEventListener('click', e => { e.stopPropagation(); deleteCapture(c.id); });
    li.addEventListener('click', e => { if (!e.target.closest('button')) openDetail(c.id); });
    imagesList.appendChild(li);
  });
}

function getDomain(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    return new URL(url).hostname || '';
  } catch (_) {
    return '';
  }
}

function renderSites() {
  const sitesList = document.getElementById('sitesList');
  const sitesEmpty = document.getElementById('sitesEmpty');
  if (!sitesList) return;
  sitesList.innerHTML = '';
  const byDomain = {};
  captures.forEach(c => {
    const d = getDomain(c.url);
    if (d) byDomain[d] = (byDomain[d] || 0) + 1;
  });
  const entries = Object.entries(byDomain).sort((a, b) => b[1] - a[1]);
  if (sitesEmpty) sitesEmpty.classList.toggle('hidden', entries.length > 0);
  entries.forEach(([domain, count]) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="item-body">
        <div class="item-title">${escapeHtml(domain)}</div>
        <div class="item-meta">${count} URL${count !== 1 ? 's' : ''} captured</div>
      </div>
    `;
    sitesList.appendChild(li);
  });
}

function openAccountModal(editIndex) {
  const modal = document.getElementById('accountModal');
  const titleEl = document.getElementById('accountModalTitle');
  const labelEl = document.getElementById('accountLabel');
  const sitesEl = document.getElementById('accountSites');
  const usernameEl = document.getElementById('accountUsername');
  const emailEl = document.getElementById('accountEmail');
  const passwordEl = document.getElementById('accountPassword');
  const tagsEl = document.getElementById('accountTags');
  const personEl = document.getElementById('accountPerson');
  if (personEl) {
    personEl.innerHTML = '<option value="">— No person —</option>' + people.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name || p.id)}</option>`).join('');
  }
  if (editIndex !== undefined && accounts[editIndex]) {
    const a = accounts[editIndex];
    modal.dataset.editIndex = String(editIndex);
    titleEl.textContent = 'Edit account';
    labelEl.value = a.label || '';
    if (sitesEl) sitesEl.value = Array.isArray(a.sites) ? a.sites.join('\n') : (a.sites || '');
    usernameEl.value = a.username || '';
    emailEl.value = a.email || '';
    passwordEl.value = a.password || '';
    tagsEl.value = Array.isArray(a.tags) ? a.tags.join(', ') : (a.tags || '');
    if (personEl) personEl.value = a.personId || '';
  } else {
    modal.dataset.editIndex = '';
    titleEl.textContent = 'Add account';
    labelEl.value = '';
    if (sitesEl) sitesEl.value = '';
    usernameEl.value = '';
    emailEl.value = '';
    passwordEl.value = '';
    tagsEl.value = '';
    if (personEl) personEl.value = '';
  }
  document.getElementById('accountShowPassword').checked = false;
  passwordEl.type = 'password';
  const accountLinksListEl = document.getElementById('accountLinksList');
  const accountLinkTargetEl = document.getElementById('accountLinkTarget');
  const accountLinksBlock = document.querySelector('.account-links-block');
  const isEdit = editIndex !== undefined && editIndex !== '' && accounts[parseInt(editIndex, 10)];
  if (accountLinksBlock) accountLinksBlock.classList.toggle('hidden', !isEdit);
  if (isEdit && accountLinksListEl && accountLinkTargetEl) {
    const a = accounts[parseInt(editIndex, 10)];
    const linkList = a.links || [];
    const linkedSet = new Set(linkList.map(l => (l.type || 'capture') + ':' + l.id));
    const accId = a.id;
    const incomingAccount = [];
    [...allCaptures.filter(x => (x.links || []).some(l => l.id === accId)), ...accounts.filter(x => x.id !== accId && (x.links || []).some(l => l.id === accId))].forEach(src => {
      const link = (src.links || []).find(l => l.id === accId);
      const title = src.title || src.url || src.label || src.username || src.email || src.id;
      const type = src.username !== undefined ? 'account' : 'capture';
      incomingAccount.push({ type, id: src.id, title, note: link && link.note });
    });
    const outgoingAccountHtml = linkList.length
      ? '<p class="detail-links-section-label">Linked to (outgoing)</p>' + linkList.map((link, i) => {
          const type = link.type || 'capture';
          const id = link.id;
          let title = id;
          if (type === 'capture') {
            const target = allCaptures.find(x => x.id === id);
            title = target ? (target.title || target.url || id) : id;
          } else {
            const acc = accounts.find(x => x.id === id);
            title = acc ? (acc.label || acc.username || acc.email || id) : id;
          }
          const noteBlock = link.note ? `<div class="detail-link-note"><span class="detail-link-note-label">Note:</span>${escapeHtml(link.note)}</div>` : '';
          return `<li class="detail-link-row" data-i="${i}"><div class="detail-link-row-head"><a href="#" class="account-link-open" data-type="${escapeHtml(type)}" data-id="${escapeHtml(id)}">${type === 'account' ? '👤 ' : ''}${escapeHtml(String(title).slice(0, 60))}</a><button type="button" class="btn-remove-att" data-i="${i}">×</button></div>${noteBlock}</li>`;
        }).join('')
      : '<p class="detail-links-section-label">Linked to (outgoing)</p><li class="muted">None</li>';
    const fromAccountHtml = incomingAccount.length
      ? '<p class="detail-links-section-label">Linked from (incoming)</p>' + incomingAccount.map(({ type, id, title, note }) => {
          const noteBlock = note ? `<div class="detail-link-note"><span class="detail-link-note-label">Note:</span>${escapeHtml(note)}</div>` : '';
          return `<li class="detail-link-row"><div class="detail-link-row-head"><a href="#" class="account-link-open" data-type="${escapeHtml(type)}" data-id="${escapeHtml(id)}">${type === 'account' ? '👤 ' : ''}${escapeHtml(String(title).slice(0, 60))}</a></div>${noteBlock}</li>`;
        }).join('')
      : '<p class="detail-links-section-label">Linked from (incoming)</p><li class="muted">None</li>';
    accountLinksListEl.innerHTML = outgoingAccountHtml + fromAccountHtml;
    accountLinksListEl.querySelectorAll('.btn-remove-att').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.i, 10);
        const next = [...linkList];
        next.splice(i, 1);
        const nextAccounts = [...accounts];
        nextAccounts[parseInt(editIndex, 10)] = { ...a, links: next };
        chrome.runtime.sendMessage({ action: 'setAccounts', caseId: currentCaseId, list: nextAccounts }, () => { load().then(() => openAccountModal(parseInt(editIndex, 10))); });
      });
    });
    accountLinksListEl.querySelectorAll('.account-link-open').forEach(linkEl => {
      linkEl.addEventListener('click', (e) => {
        e.preventDefault();
        const type = linkEl.dataset.type;
        const id = linkEl.dataset.id;
        if (type === 'account') {
          const idx = accounts.findIndex(x => x.id === id);
          if (idx >= 0) { closeAccountModal(); openAccountModal(idx); }
        } else openDetail(id);
      });
    });
    const othersCapture = captures.filter(x => !linkedSet.has('capture:' + x.id));
    const othersAccount = accounts.filter(x => x.id !== a.id && !linkedSet.has('account:' + x.id));
    accountLinkTargetEl.innerHTML = '<option value="">— Select capture or account —</option>' +
      (othersCapture.length ? '<optgroup label="Captures">' + othersCapture.map(o => `<option value="capture:${escapeHtml(o.id)}">${escapeHtml((o.title || o.url || o.id).slice(0, 50))}</option>`).join('') + '</optgroup>' : '') +
      (othersAccount.length ? '<optgroup label="Accounts">' + othersAccount.map(o => `<option value="account:${escapeHtml(o.id)}">${escapeHtml((o.label || o.username || o.email || o.id).slice(0, 50))}</option>`).join('') + '</optgroup>' : '');
  }
  modal.classList.remove('hidden');
}

function closeAccountModal() {
  document.getElementById('accountModal').classList.add('hidden');
}

async function saveAccount() {
  const labelEl = document.getElementById('accountLabel');
  const sitesEl = document.getElementById('accountSites');
  const usernameEl = document.getElementById('accountUsername');
  const emailEl = document.getElementById('accountEmail');
  const passwordEl = document.getElementById('accountPassword');
  const tagsEl = document.getElementById('accountTags');
  const label = (labelEl?.value || '').trim();
  const sitesStr = (sitesEl?.value || '').trim();
  const sites = sitesStr ? sitesStr.split(/\r?\n/).map(s => s.trim()).filter(Boolean) : [];
  const username = (usernameEl?.value || '').trim();
  const email = (emailEl?.value || '').trim();
  const password = (passwordEl?.value || '').trim();
  const tagsStr = (tagsEl?.value || '').trim();
  const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];
  if (!username && !email && !password && !label && sites.length === 0) {
    showMessageModal('Required', 'Enter at least one of: label, sites, username, email, or password.');
    return;
  }
  const editIndex = document.getElementById('accountModal').dataset.editIndex;
  const next = [...accounts];
  const existing = editIndex !== '' && accounts[parseInt(editIndex, 10)] ? accounts[parseInt(editIndex, 10)] : null;
  const existingLinks = existing && Array.isArray(existing.links) ? existing.links : [];
  const personIdEl = document.getElementById('accountPerson');
  const personId = (personIdEl?.value || '').trim() || undefined;
  const record = {
    id: existing ? existing.id : randomUuid(),
    label: label || undefined,
    sites: sites.length ? sites : undefined,
    username: username || undefined,
    email: email || undefined,
    password: password || undefined,
    tags,
    links: [...existingLinks],
    personId,
  };
  function urlMatchesSite(captureUrl, siteStr) {
    if (!captureUrl || !siteStr) return false;
    const s = siteStr.trim().toLowerCase();
    try {
      const u = new URL(captureUrl);
      const host = u.hostname.toLowerCase();
      if (host === s || host.endsWith('.' + s)) return true;
      if (s.startsWith('http') && captureUrl.toLowerCase().startsWith(s)) return true;
      if (captureUrl.toLowerCase().includes(s)) return true;
    } catch (_) {}
    return false;
  }
  if (sites.length) {
    const linkedIds = new Set((record.links || []).filter(l => l.type === 'capture').map(l => l.id));
    captures.forEach(c => {
      if (linkedIds.has(c.id)) return;
      const matches = sites.some(site => urlMatchesSite(c.url, site));
      if (matches) {
        record.links.push({ type: 'capture', id: c.id });
        linkedIds.add(c.id);
      }
    });
  }
  // When sites change, drop auto (site-matched) capture links that no longer match; always keep manual links
  if (sites.length) {
    record.links = (record.links || []).filter(l => {
      if (l.type !== 'capture' || !l.id) return true;
      if (l.manual) return true; // keep manually added account→capture links
      const cap = captures.find(c => c.id === l.id);
      if (!cap || !cap.url) return true;
      return sites.some(site => urlMatchesSite(cap.url, site));
    });
  } else {
    record.links = (record.links || []).filter(l => l.type !== 'capture' || l.manual);
  }
  if (editIndex !== '' && existing) {
    next[parseInt(editIndex, 10)] = record;
  } else {
    next.push(record);
  }
  await chrome.runtime.sendMessage({ action: 'setAccounts', caseId: currentCaseId, list: next });
  closeAccountModal();
  load();
}

async function deleteAccount(index) {
  const ok = await showConfirmModal('Delete account', 'Delete this account?');
  if (!ok) return;
  const next = accounts.filter((_, i) => i !== index);
  chrome.runtime.sendMessage({ action: 'setAccounts', caseId: currentCaseId, list: next }, () => load());
}

document.getElementById('addAccountBtn')?.addEventListener('click', () => openAccountModal());
document.getElementById('accountCancel')?.addEventListener('click', closeAccountModal);
document.getElementById('accountSave')?.addEventListener('click', saveAccount);
document.getElementById('accountModal')?.querySelector('.modal-backdrop')?.addEventListener('click', closeAccountModal);
document.getElementById('accountShowPassword')?.addEventListener('change', function () {
  document.getElementById('accountPassword').type = this.checked ? 'text' : 'password';
});
document.getElementById('accountLinkAdd')?.addEventListener('click', () => {
  const sel = document.getElementById('accountLinkTarget');
  const val = sel?.value;
  if (!val) return;
  const editIndex = document.getElementById('accountModal').dataset.editIndex;
  if (editIndex === '' || !accounts[parseInt(editIndex, 10)]) return;
  const [type, id] = val.indexOf(':') >= 0 ? val.split(':', 2) : ['capture', val];
  const a = accounts[parseInt(editIndex, 10)];
  const links = [...(a.links || []), { type: type || 'capture', id, manual: true }];
  const next = [...accounts];
  next[parseInt(editIndex, 10)] = { ...a, links };
  chrome.runtime.sendMessage({ action: 'setAccounts', caseId: currentCaseId, list: next }, () => { load().then(() => openAccountModal(parseInt(editIndex, 10))); });
});

function renderStats() {
  if (!statsContent) return;
  const byTag = {};
  captures.forEach(c => { (c.tags || []).forEach(t => { byTag[t] = (byTag[t] || 0) + 1; }); });
  const tagEntries = Object.entries(byTag).sort((a, b) => b[1] - a[1]);
  const maxTagCount = tagEntries.length ? Math.max(...tagEntries.map(([, n]) => n), 1) : 1;
  const tagBars = tagEntries.map(([tag, n]) => {
    const pct = Math.round((n / maxTagCount) * 100);
    return `<div class="stat-bar-row">
      <span class="stat-bar-label">${escapeHtml(tag)}</span>
      <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${pct}%"></div></div>
      <span class="stat-bar-value">${n}</span>
    </div>`;
  }).join('');
  const recent = captures.slice(0, 10).map(c => `<div class="stat-row"><span>${escapeHtml((c.title || c.url || '').slice(0, 50))}</span><span>${formatTime(c.timestamp)}</span></div>`).join('');
  const annotatedCount = captures.filter(c => /^Annotated/i.test(String(c.title || ''))).length;
  const byDomain = {};
  captures.forEach(c => {
    const d = getDomain(c.url);
    if (d) byDomain[d] = (byDomain[d] || 0) + 1;
  });
  const sitesCount = Object.keys(byDomain).length;
  statsContent.innerHTML = `
    <div class="stats-cards">
      <div class="stats-card">
        <span class="stats-card-value">${captures.length}</span>
        <span class="stats-card-label">Captures</span>
      </div>
      <div class="stats-card">
        <span class="stats-card-value">${tagEntries.length}</span>
        <span class="stats-card-label">Tags used</span>
      </div>
      <div class="stats-card">
        <span class="stats-card-value">${sitesCount}</span>
        <span class="stats-card-label">Sites</span>
      </div>
      <div class="stats-card">
        <span class="stats-card-value">${annotatedCount}</span>
        <span class="stats-card-label">Annotated images</span>
      </div>
      <div class="stats-card">
        <span class="stats-card-value">${accounts.length}</span>
        <span class="stats-card-label">Accounts</span>
      </div>
      <div class="stats-card">
        <span class="stats-card-value">${people.length}</span>
        <span class="stats-card-label">People</span>
      </div>
      <div class="stats-card">
        <span class="stats-card-value">${groups.length}</span>
        <span class="stats-card-label">Groups</span>
      </div>
    </div>
    <h3>By tag</h3>
    <div class="stat-bars">${tagBars || '<p class="muted">No tags yet</p>'}</div>
    <h3>Recent captures</h3>
    <div class="stat-rows">${recent || '<p class="muted">None</p>'}</div>
  `;
}

function saveTodoList() {
  chrome.runtime.sendMessage({ action: 'setTodoList', caseId: currentCaseId, list: todoItems });
}

function renderTodo() {
  if (!todoSections) return;
  const total = todoItems.length;
  const done = todoItems.filter(i => i.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  if (todoProgress) {
    todoProgress.classList.toggle('hidden', total === 0);
    if (todoProgressBar) todoProgressBar.style.width = pct + '%';
    if (todoProgressText) todoProgressText.textContent = total ? `${pct}% (${done}/${total})` : '0%';
  }
  const sectionOrder = [...new Set(todoItems.map(i => i.section || '').filter(Boolean))];
  const noSection = todoItems.filter(i => !i.section || i.section === '');
  const bySection = {};
  todoItems.forEach((item, i) => {
    const s = item.section || '';
    if (!bySection[s]) bySection[s] = [];
    bySection[s].push({ item, i });
  });
  const sectionIds = [...new Set([...sectionOrder, ...(noSection.length ? [''] : [])])];
  todoSections.innerHTML = sectionIds.map(sectionId => {
    const entries = bySection[sectionId] || [];
    const title = sectionId || 'Other';
    return `
      <div class="todo-section" data-section="${escapeHtml(sectionId)}">
        <h4 class="todo-section-title">${escapeHtml(title)}</h4>
        <ul class="list todo-list">${entries.map(({ item, i }) => `
          <li class="${item.done ? 'done' : ''}" data-i="${i}">
            <input type="checkbox" class="todo-check" ${item.done ? 'checked' : ''} />
            <span class="todo-text" title="Double-click to edit">${escapeHtml(item.text)}</span>
            <button type="button" class="btn-remove-selector todo-remove" title="Delete">×</button>
          </li>
        `).join('')}</ul>
      </div>
    `;
  }).join('');
  todoSections.querySelectorAll('.todo-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const i = parseInt(cb.closest('li').dataset.i, 10);
      todoItems[i].done = cb.checked;
      saveTodoList();
      renderTodo();
    });
  });
  todoSections.querySelectorAll('.todo-list li').forEach(li => {
    li.addEventListener('click', (e) => {
      if (e.target.closest('.todo-remove')) return;
      if (e.target.closest('.todo-check')) return; /* let checkbox handle it */
      const i = parseInt(li.dataset.i, 10);
      if (Number.isNaN(i) || i < 0 || i >= todoItems.length) return;
      todoItems[i].done = !todoItems[i].done;
      saveTodoList();
      renderTodo();
    });
  });
  todoSections.querySelectorAll('.todo-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.closest('li').dataset.i, 10);
      todoItems.splice(i, 1);
      saveTodoList();
      renderTodo();
    });
  });
  todoSections.querySelectorAll('.todo-text').forEach(span => {
    span.addEventListener('dblclick', async () => {
      const i = parseInt(span.closest('li').dataset.i, 10);
      const newText = await showPromptModal('Edit task', 'Task text:', todoItems[i].text);
      if (newText != null && newText.trim() !== '') {
        todoItems[i].text = newText.trim();
        saveTodoList();
        renderTodo();
      }
    });
  });
  if (todoSectionSelect) {
    const allSections = [...new Set([...todoItems.map(i => i.section).filter(Boolean), ...OSINT_TEMPLATE.map(t => t.section)])].sort();
    const cur = todoSectionSelect.value;
    todoSectionSelect.innerHTML = '<option value="">Other</option>' + allSections.map(s => `<option value="${escapeHtml(s)}" ${s === cur ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('');
  }
}

function updateStats() {
  if (statsSummary) statsSummary.textContent = `${filterCaptures().length} full captures`;
}

function renderGraph(options = {}) {
  const graphPanel = document.getElementById('panel-graph');
  if (!graphPanel?.classList.contains('active')) return;
  const svg = document.getElementById('graphSvg');
  const emptyEl = document.getElementById('graphEmpty');
  const container = document.getElementById('graphContainer');
  const linkHintEl = document.getElementById('graphLinkHint');
  if (!svg) return;
  const skipTransformUpdate = options.skipTransformUpdate || graphIsPanning;
  const filterActive = isGraphFilterActive();
  const baseCaptures = filterActive ? captures.filter(c => nodeMatchesGraphFilter(c, graphFilter, 'capture')) : captures;
  const graphCaptures = baseCaptures.filter(c => c.imageDataUrl || c.htmlContent);
  const graphAccounts = filterActive ? accounts.filter(a => nodeMatchesGraphFilter(a, graphFilter, 'account')) : accounts;
  const graphPeople = filterActive ? people.filter(p => nodeMatchesGraphFilter(p, graphFilter, 'person')) : people;
  const graphGroups = filterActive ? groups.filter(g => nodeMatchesGraphFilter(g, graphFilter, 'group')) : groups;
  const nodeIds = new Set();
  let edges = [];
  const manualEdgeKeys = new Set();
  graphCaptures.forEach(c => {
    nodeIds.add(c.id);
    (c.links || []).forEach(l => {
      if (!l.id) return;
      nodeIds.add(l.id);
      const manual = l.manual !== false;
      edges.push({ from: c.id, to: l.id, note: l.note || '', manual, edgeType: manual ? 'manual' : 'auto' });
      if (manual) manualEdgeKeys.add(c.id + '\0' + l.id);
    });
  });
  graphAccounts.forEach(acc => {
    nodeIds.add(acc.id);
    (acc.links || []).forEach(l => {
      if (!l.id) return;
      nodeIds.add(l.id);
      const manual = l.manual !== false;
      edges.push({ from: acc.id, to: l.id, note: l.note || '', manual, edgeType: manual ? 'manual' : 'auto' });
      if (manual) manualEdgeKeys.add(acc.id + '\0' + l.id);
    });
  });
  // All people and groups appear in the graph automatically
  graphPeople.forEach(p => {
    nodeIds.add(p.id);
    (p.groupIds || []).forEach(gid => {
      if (!gid) return;
      nodeIds.add(gid);
      edges.push({ from: p.id, to: gid, note: '', manual: true, edgeType: 'personGroup' });
    });
  });
  graphGroups.forEach(g => {
    nodeIds.add(g.id);
    (g.groupIds || []).forEach(gid => {
      if (!gid) return;
      nodeIds.add(gid);
      edges.push({ from: g.id, to: gid, note: '', manual: true, edgeType: 'groupGroup' });
    });
  });
  // Person–account edges (account linked to person)
  graphAccounts.forEach(acc => {
    if (acc.personId && graphPeople.some(p => p.id === acc.personId)) {
      nodeIds.add(acc.personId);
      edges.push({ from: acc.id, to: acc.personId, note: '', manual: true, edgeType: 'accountPerson' });
    }
  });
  // When filtering, only show nodes that match; restrict edges to those between matching nodes
  if (filterActive) {
    const primaryNodeIds = new Set([
      ...graphCaptures.map(c => c.id),
      ...graphAccounts.map(a => a.id),
      ...graphPeople.map(p => p.id),
      ...graphGroups.map(g => g.id),
    ]);
    let allowedNodeIds = primaryNodeIds;

    if (settings && settings.graphShowLinkedNodes) {
      // Expand to include nodes directly connected to any primary node (1-hop neighbours).
      const adjacentIds = new Set();

      // From edges already built (primary → target or target → primary)
      edges.forEach(e => {
        if (primaryNodeIds.has(e.from) && !primaryNodeIds.has(e.to)) adjacentIds.add(e.to);
        if (primaryNodeIds.has(e.to) && !primaryNodeIds.has(e.from)) adjacentIds.add(e.from);
      });

      // Non-primary captures that explicitly link to a primary node (those edges aren't in the
      // list yet because the source wasn't in graphCaptures).
      for (const c of captures) {
        if (primaryNodeIds.has(c.id) || (!c.imageDataUrl && !c.htmlContent)) continue;
        for (const l of (c.links || [])) {
          if (l.id && primaryNodeIds.has(l.id)) {
            adjacentIds.add(c.id);
            const man = l.manual !== false;
            edges.push({ from: c.id, to: l.id, note: l.note || '', manual: man, edgeType: man ? 'manual' : 'auto' });
          }
        }
      }

      // Non-primary accounts that link to a primary node or are linked to a primary person
      for (const acc of accounts) {
        if (primaryNodeIds.has(acc.id)) continue;
        let isAdjacent = false;
        for (const l of (acc.links || [])) {
          if (l.id && primaryNodeIds.has(l.id)) {
            isAdjacent = true;
            const man = l.manual !== false;
            edges.push({ from: acc.id, to: l.id, note: l.note || '', manual: man, edgeType: man ? 'manual' : 'auto' });
          }
        }
        if (acc.personId && primaryNodeIds.has(acc.personId)) {
          isAdjacent = true;
          edges.push({ from: acc.id, to: acc.personId, note: '', manual: true, edgeType: 'accountPerson' });
        }
        if (isAdjacent) adjacentIds.add(acc.id);
      }

      // Non-primary people who belong to a primary group
      for (const p of people) {
        if (primaryNodeIds.has(p.id)) continue;
        for (const gid of (p.groupIds || [])) {
          if (primaryNodeIds.has(gid)) {
            adjacentIds.add(p.id);
            edges.push({ from: p.id, to: gid, note: '', manual: true, edgeType: 'personGroup' });
          }
        }
      }

      // Non-primary groups that link to a primary group
      for (const g of groups) {
        if (primaryNodeIds.has(g.id)) continue;
        for (const gid of (g.groupIds || [])) {
          if (primaryNodeIds.has(gid)) {
            adjacentIds.add(g.id);
            edges.push({ from: g.id, to: gid, note: '', manual: true, edgeType: 'groupGroup' });
          }
        }
      }

      allowedNodeIds = new Set([...primaryNodeIds, ...adjacentIds]);
    }

    nodeIds.clear();
    allowedNodeIds.forEach(id => nodeIds.add(id));
    edges = edges.filter(e => allowedNodeIds.has(e.from) && allowedNodeIds.has(e.to));
  }
  // Auto-link same-domain captures by timestamp (oldest -> newest); only among filtered captures
  if (!settings || settings.graphShowDomainLinks !== false) {
    try {
      const byDomain = new Map();
      graphCaptures.forEach(c => {
        if (!c.url || !c.timestamp) return;
        const host = new URL(c.url).hostname;
        if (!byDomain.has(host)) byDomain.set(host, []);
        byDomain.get(host).push(c);
      });
      byDomain.forEach((list) => {
        list.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        for (let i = 0; i < list.length - 1; i++) {
          const fromId = list[i].id;
          const toId = list[i + 1].id;
          if (manualEdgeKeys.has(fromId + '\0' + toId)) continue;
          if (!nodeIds.has(fromId) || !nodeIds.has(toId)) continue;
          edges.push({ from: fromId, to: toId, note: '', manual: false, edgeType: 'domain' });
        }
      });
    } catch (_) {}
  }
  // Sequential flow: connect all captures in chronological order (oldest -> newest) so full flow is visible
  if ((settings && settings.graphSequentialFlow !== false) && graphCaptures.length >= 2) {
    const ordered = [...graphCaptures].sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return ta - tb;
    });
    for (let i = 0; i < ordered.length - 1; i++) {
      const fromId = ordered[i].id;
      const toId = ordered[i + 1].id;
      if (manualEdgeKeys.has(fromId + '\0' + toId)) continue;
      if (!nodeIds.has(fromId) || !nodeIds.has(toId)) continue;
      edges.push({ from: fromId, to: toId, note: '', manual: false, edgeType: 'auto' });
    }
  }
  // Drop stale link refs (e.g. from before import remapping): only show nodes that exist as capture/account/person/group
  const validNodeIds = new Set(
    [...nodeIds].filter(id =>
      allCaptures.some(c => c.id === id) || accounts.some(a => a.id === id) || people.some(p => p.id === id) || groups.some(g => g.id === id)
    )
  );
  nodeIds.clear();
  validNodeIds.forEach(id => nodeIds.add(id));
  edges = edges.filter(e => validNodeIds.has(e.from) && validNodeIds.has(e.to));
  const nodeMap = {};
  const nodes = [...nodeIds].map(id => {
    const c = allCaptures.find(x => x.id === id);
    const acc = accounts.find(x => x.id === id);
    const pers = people.find(x => x.id === id);
    const grp = groups.find(x => x.id === id);
    const layout = graphLayout[id];
    let type = 'capture';
    let title = id;
    let tags = [];
    let imageDataUrl = null;
    let important = false;
    if (acc) {
      type = 'account';
      title = acc.label || acc.username || acc.email || id;
      tags = acc.tags || [];
    } else if (pers) {
      type = 'person';
      title = pers.name || id;
    } else if (grp) {
      type = 'group';
      title = grp.name || id;
    } else if (c) {
      title = (c.title || c.url) || id;
      tags = c.tags || [];
      imageDataUrl = c.imageDataUrl ? c.imageDataUrl : null;
      important = !!c.important;
    }
    let url = '';
    if (c && c.url) url = c.url;
    nodeMap[id] = {
      id,
      type,
      title,
      tags,
      imageDataUrl,
      important,
      url,
      x: layout && typeof layout.x === 'number' ? layout.x : 0,
      y: layout && typeof layout.y === 'number' ? layout.y : 0,
    };
    return nodeMap[id];
  });
  if (nodes.length === 0) {
    svg.innerHTML = '';
    const minimapEl = document.getElementById('graphMinimap');
    if (minimapEl) minimapEl.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('hidden');
    if (linkHintEl) linkHintEl.classList.add('hidden');
    return;
  }
  if (emptyEl) emptyEl.classList.add('hidden');
  const rect = container ? container.getBoundingClientRect() : { width: 800, height: 500 };
  const w = Math.max(100, Math.floor(rect.width));
  const h = Math.max(100, Math.floor(rect.height));
  const nodeRadius = 28;
  const arrowSize = 10;
  const centerX = w / 2;
  const centerY = h / 2;
  const LAYOUT_BOUND = 1e7;
  const minDist = nodeRadius * 3.2;
  function clampLayout(x, y) {
    return {
      x: Math.max(-LAYOUT_BOUND, Math.min(LAYOUT_BOUND, x)),
      y: Math.max(-LAYOUT_BOUND, Math.min(LAYOUT_BOUND, y)),
    };
  }
  function isPlaced(n) {
    const layout = graphLayout[n.id];
    return layout && typeof layout.x === 'number' && typeof layout.y === 'number';
  }
  function getLargestGroupCenter(placedNodes, edgeList) {
    if (placedNodes.length === 0) return null;
    const idToNode = new Map(placedNodes.map(n => [n.id, n]));
    const placedIds = new Set(placedNodes.map(n => n.id));
    const adj = new Map();
    placedNodes.forEach(n => adj.set(n.id, []));
    edgeList.forEach(({ from, to }) => {
      if (placedIds.has(from) && placedIds.has(to)) {
        adj.get(from).push(to);
        adj.get(to).push(from);
      }
    });
    const visited = new Set();
    let largest = [];
    placedNodes.forEach(n => {
      if (visited.has(n.id)) return;
      const comp = [];
      const stack = [n.id];
      while (stack.length) {
        const id = stack.pop();
        if (visited.has(id)) continue;
        visited.add(id);
        comp.push(idToNode.get(id));
        adj.get(id).forEach(neigh => { if (!visited.has(neigh)) stack.push(neigh); });
      }
      if (comp.length > largest.length) largest = comp;
    });
    if (largest.length === 0) largest = placedNodes;
    return {
      x: largest.reduce((s, n) => s + n.x, 0) / largest.length,
      y: largest.reduce((s, n) => s + n.y, 0) / largest.length,
    };
  }
  function findEmptyPosition(placedNodes, minD, centerHint) {
    const cx = centerHint ? centerHint.x : (placedNodes.length ? placedNodes.reduce((s, n) => s + n.x, 0) / placedNodes.length : 0);
    const cy = centerHint ? centerHint.y : (placedNodes.length ? placedNodes.reduce((s, n) => s + n.y, 0) / placedNodes.length : 0);
    const step = minD * 1.2;
    for (let ring = 0; ring < 200; ring++) {
      const r = ring * step;
      const count = ring === 0 ? 1 : Math.max(6, ring * 6);
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * 2 * Math.PI + (ring * 0.7);
        const x = clampLayout(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r).x;
        const y = clampLayout(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r).y;
        const ok = placedNodes.every(p => Math.hypot(p.x - x, p.y - y) >= minD);
        if (ok) return { x, y };
      }
    }
    return { x: cx + (Math.random() - 0.5) * 400, y: cy + (Math.random() - 0.5) * 400 };
  }
  function separateOverlaps() {
    for (let iter = 0; iter < 120; iter++) {
      let moved = false;
      nodes.forEach((a, i) => {
        nodes.forEach((b, j) => {
          if (i >= j) return;
          const dx = a.x - b.x; const dy = a.y - b.y;
          const d = Math.hypot(dx, dy) || 0.01;
          if (d < minDist) {
            const push = (minDist - d) * 1.1;
            const u = dx / d; const v = dy / d;
            a.x += u * push; a.y += v * push;
            b.x -= u * push; b.y -= v * push;
            moved = true;
          }
        });
      });
      nodes.forEach(n => {
        const c = clampLayout(n.x, n.y);
        n.x = c.x; n.y = c.y;
      });
      if (!moved) break;
    }
  }
  const doArrange = options.arrange === true;
  if (doArrange) {
    graphViewTransformRestored = false; // so view is re-fitted to the new layout below
    const spacingX = 100;
    const spacingY = 120;
    const zigzagY = 22; // vertical offset: nodes in a row alternate up/down so links overlap less
    const groupsList = nodes.filter(n => n.type === 'group');
    const peopleList = nodes.filter(n => n.type === 'person');
    const accountsList = nodes.filter(n => n.type === 'account');
    const capturesList = nodes.filter(n => n.type === 'capture' || !n.type);
    let y = 0;
    [...groupsList].reverse().forEach((n, i) => {
      n.x = i * spacingX;
      n.y = y + (i % 2 === 0 ? -zigzagY : zigzagY);
      graphLayout[n.id] = { x: n.x, y: n.y };
    });
    if (groupsList.length) y += spacingY;
    [...peopleList].reverse().forEach((n, i) => {
      n.x = i * spacingX;
      n.y = y + (i % 2 === 0 ? -zigzagY : zigzagY);
      graphLayout[n.id] = { x: n.x, y: n.y };
    });
    if (peopleList.length) y += spacingY;
    [...accountsList].reverse().forEach((n, i) => {
      n.x = i * spacingX;
      n.y = y + (i % 2 === 0 ? -zigzagY : zigzagY);
      graphLayout[n.id] = { x: n.x, y: n.y };
    });
    if (accountsList.length) y += spacingY;
    const captureById = new Map(captures.map(c => [c.id, c]));
    const captureTime = (n) => {
      const cap = captureById.get(n.id);
      return (cap && cap.timestamp) ? new Date(cap.timestamp).getTime() : 0;
    };
    const capturesByDate = [...capturesList].sort((a, b) => captureTime(a) - captureTime(b));
    const maxCapturesPerRow = 16;
    const rowHeight = spacingY + zigzagY * 2; // each row spans two vertical bands
    capturesByDate.forEach((n, i) => {
      const row = Math.floor(i / maxCapturesPerRow);
      const col = i % maxCapturesPerRow;
      n.x = col * spacingX;
      n.y = y + row * rowHeight + (col % 2 === 0 ? -zigzagY : zigzagY);
      graphLayout[n.id] = { x: n.x, y: n.y };
    });
    if (capturesByDate.length) y += rowHeight * Math.ceil(capturesByDate.length / maxCapturesPerRow);
    chrome.runtime.sendMessage({ action: 'setCaseConfig', caseId: currentCaseId, config: { graphLayout } }).catch(() => {});
  }
  const hasStoredLayout = nodes.some(n => graphLayout[n.id] && typeof graphLayout[n.id].x === 'number');
  if (!hasStoredLayout && !doArrange) {
    nodes.forEach((n, i) => {
      const angle = (i / nodes.length) * 2 * Math.PI;
      const r = Math.min(w, h) * 0.35;
      n.x = centerX + Math.cos(angle) * r;
      n.y = centerY + Math.sin(angle) * r;
    });
    for (let iter = 0; iter < 45; iter++) {
      edges.forEach(({ from, to }) => {
        const a = nodes.find(n => n.id === from);
        const b = nodes.find(n => n.id === to);
        if (!a || !b) return;
        const dx = b.x - a.x; const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const f = Math.min(d * 0.02, 4);
        a.x += (dx / d) * f; a.y += (dy / d) * f;
        b.x -= (dx / d) * f; b.y -= (dy / d) * f;
      });
      nodes.forEach((a, i) => {
        nodes.forEach((b, j) => {
          if (i >= j) return;
          const dx = a.x - b.x; const dy = a.y - b.y;
          const d = Math.hypot(dx, dy) || 0.01;
          const repel = 800 / (d * d);
          const f = Math.min(repel * 0.5, 8);
          a.x += (dx / d) * f; a.y += (dy / d) * f;
          b.x -= (dx / d) * f; b.y -= (dy / d) * f;
        });
      });
      nodes.forEach(n => {
        const c = clampLayout(n.x, n.y);
        n.x = c.x; n.y = c.y;
      });
    }
    separateOverlaps();
    // Small deterministic zig-zag per node so edges overlap less (stable from node id)
    const staggerMag = 8;
    nodes.forEach((n, i) => {
      const sid = String(n.id);
      const h = (sid.split('').reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0) >>> 0) % 100;
      n.x += (h % 7 - 3) * staggerMag * 0.5;
      n.y += (Math.floor(h / 7) % 5 - 2) * staggerMag * 0.5;
      const c = clampLayout(n.x, n.y);
      n.x = c.x; n.y = c.y;
    });
  } else {
    const placed = nodes.filter(n => isPlaced(n));
    const unplaced = nodes.filter(n => !isPlaced(n));
    const centerHint = getLargestGroupCenter(placed, edges);
    unplaced.forEach(n => {
      const pos = findEmptyPosition(placed, minDist, centerHint);
      n.x = pos.x;
      n.y = pos.y;
      placed.push(n);
    });
    if (unplaced.length) {
      nodes.forEach(n => { graphLayout[n.id] = { x: n.x, y: n.y }; });
    }
    nodes.forEach(n => { graphLayout[n.id] = { x: n.x, y: n.y }; });
    chrome.runtime.sendMessage({ action: 'setCaseConfig', caseId: currentCaseId, config: { graphLayout } }).catch(() => {});
  }
  const pad = 80;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(n => { minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y); });
  const graphBounds = { minX, minY, maxX, maxY };
  if (!skipTransformUpdate && !graphViewTransformRestored) {
    const scale = Math.min((w - 2 * pad) / (maxX - minX || 1), (h - 2 * pad) / (maxY - minY || 1));
    graphViewTransform = { minX, minY, scale };
    chrome.runtime.sendMessage({ action: 'setCaseConfig', caseId: currentCaseId, config: { graphViewTransform, graphPan, graphZoom } }).catch(() => {});
  }
  const t = graphViewTransform;
  const tx = (n) => pad + (n.x - t.minX) * t.scale;
  const ty = (n) => pad + (n.y - t.minY) * t.scale;

  const edgePath = (a, b) => {
    const x1 = tx(a); const y1 = ty(a);
    const x2 = tx(b); const y2 = ty(b);
    const dx = x2 - x1; const dy = y2 - y1;
    const d = Math.hypot(dx, dy) || 0.01;
    const back = (nodeRadius + arrowSize) / d;
    const ex = x2 - dx * back;
    const ey = y2 - dy * back;
    return `M ${x1} ${y1} L ${ex} ${ey}`;
  };
  const arrowPoints = (a, b) => {
    const x1 = tx(a); const y1 = ty(a);
    const x2 = tx(b); const y2 = ty(b);
    const dx = x2 - x1; const dy = y2 - y1;
    const d = Math.hypot(dx, dy) || 0.01;
    const u = dx / d; const v = dy / d;
    const ex = tx(b) - u * (nodeRadius + 2);
    const ey = ty(b) - v * (nodeRadius + 2);
    const lx = ex - u * arrowSize - v * (arrowSize * 0.6);
    const ly = ey - v * arrowSize + u * (arrowSize * 0.6);
    const rx = ex - u * arrowSize + v * (arrowSize * 0.6);
    const ry = ey - v * arrowSize - u * (arrowSize * 0.6);
    return `${ex},${ey} ${lx},${ly} ${rx},${ry}`;
  };

  const edgeColorAuto = (settings && settings.graphEdgeColor) || '#999999';
  const edgeColorDomain = (settings && settings.graphEdgeDomainColor) || '#00E5FF';
  const edgeColorManual = (settings && settings.graphEdgeManualColor) || '#22c55e';
  const edgeColorPersonGroup = (settings && settings.graphEdgePersonGroupColor) || '#2563eb';
  const edgeColorGroupGroup = (settings && settings.graphEdgeGroupGroupColor) || '#7c3aed';
  const edgeColorAccountPerson = (settings && settings.graphEdgeAccountPersonColor) || '#ea580c';
  // Expose for graph link key (theme-dynamic)
  if (graphPanel) {
    graphPanel.style.setProperty('--graph-edge-auto', edgeColorAuto);
    graphPanel.style.setProperty('--graph-edge-domain', edgeColorDomain);
    graphPanel.style.setProperty('--graph-edge-manual', edgeColorManual);
    graphPanel.style.setProperty('--graph-edge-person-group', edgeColorPersonGroup);
    graphPanel.style.setProperty('--graph-edge-group-group', edgeColorGroupGroup);
    graphPanel.style.setProperty('--graph-edge-account-person', edgeColorAccountPerson);
  }
  function edgeColorForType(edgeType) {
    switch (edgeType) {
      case 'domain': return edgeColorDomain;
      case 'personGroup': return edgeColorPersonGroup;
      case 'groupGroup': return edgeColorGroupGroup;
      case 'accountPerson': return edgeColorAccountPerson;
      case 'manual': return edgeColorManual;
      default: return edgeColorAuto;
    }
  }
  const edgesMarkup = edges.map(({ from, to, note, manual, edgeType }) => {
    const a = nodes.find(n => n.id === from);
    const b = nodes.find(n => n.id === to);
    if (!a || !b) return '';
    const titleEl = note ? `<title>${escapeHtml(note)}</title>` : '';
    const strokeColor = edgeColorForType(edgeType || (manual ? 'manual' : 'auto'));
    const edgeClass = 'graph-edge graph-edge-' + (edgeType || (manual ? 'manual' : 'auto'));
    const markerId = 'graph-arrow-' + (edgeType || (manual ? 'manual' : 'auto'));
    const fromType = a.type || 'capture';
    const toType = b.type || 'capture';
    return `<g class="${edgeClass}" data-from="${escapeHtml(from)}" data-to="${escapeHtml(to)}" data-from-type="${escapeHtml(fromType)}" data-to-type="${escapeHtml(toType)}">${titleEl}
      <path class="graph-edge-hit" fill="none" stroke="transparent" stroke-width="12" d="${edgePath(a, b)}" cursor="pointer" pointer-events="stroke"/>
      <path fill="none" stroke="${strokeColor}" stroke-width="1.5" d="${edgePath(a, b)}" marker-end="url(#${markerId})" pointer-events="none"/>
    </g>`;
  }).join('');

  // Person: minimalist silhouette — circle head + curved shoulders/torso with neck gap
  const personIconSvg = '<g class="graph-node-person-icon" fill="#fff" transform="scale(1.3)" pointer-events="none"><circle cx="0" cy="-5.5" r="4"/><path d="M-3.8 1.2 Q-6 4 0 9.5 Q6 4 3.8 1.2 Z"/></g>';
  // Account: eye with magnifying glass (almond eye + iris/pupil + handle)
  const accountIconSvg = '<g class="graph-node-account-icon" fill="#fff" stroke="#fff" stroke-width="0.85" transform="scale(1.15)" pointer-events="none"><path d="M-6 -1.5 Q-7.5 0 -6 2 Q0 4 6 2 Q7.5 0 6 -1.5 Q0 -3.5 -6 -1.5 Z" fill="none" stroke-linejoin="round"/><circle cx="0" cy="0.2" r="2.8" fill="none" stroke-width="0.95"/><circle cx="0" cy="0.2" r="1.15" fill="#fff"/><path d="M3.2 3 L6 5.8" stroke-linecap="round" fill="none" stroke-width="1.5"/></g>';
  // Group: three overlapping figures (circle head + trapezoid body each), front-and-back
  const groupIconSvg = '<g class="graph-node-group-icon" fill="#fff" transform="scale(1.05)" pointer-events="none"><circle cx="-5.5" cy="-3.5" r="3.2"/><path d="M-6.8 0.2 L-8 5.5 L-3 5.5 L-4.2 0.2 Z"/><circle cx="0" cy="-3.5" r="3.2"/><path d="M-3.5 0.2 L-4.8 5.5 L4.8 5.5 L3.5 0.2 Z"/><circle cx="5.5" cy="-3.5" r="3.2"/><path d="M4.2 0.2 L3 5.5 L8 5.5 L6.8 0.2 Z"/></g>';
  const nodesMarkup = nodes.map(n => {
    const x = tx(n);
    const y = ty(n);
    const tagStr = (n.tags && n.tags.length) ? n.tags.slice(0, 3).join(', ') : '';
    const isCapture = n.type === 'capture';
    const isAccount = n.type === 'account';
    const isPerson = n.type === 'person';
    const isGroup = n.type === 'group';
    const clipId = 'clip-node-' + String(n.id).replace(/[^a-zA-Z0-9-_]/g, '_');
    const thumb = isCapture && n.imageDataUrl
      ? `<image href="${n.imageDataUrl}" x="${-nodeRadius}" y="${-nodeRadius}" width="${nodeRadius * 2}" height="${nodeRadius * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`
      : '';
    const fill = isGroup ? 'var(--graph-node-group-bg, #4c1d95)' : isPerson ? 'var(--graph-node-person-bg, #db2777)' : isAccount ? 'var(--graph-node-account-bg, #fbcfe8)' : 'var(--accent)';
    const isImportant = isCapture && n.important;
    const importantColor = (settings && settings.importantNodeBorderColor) || '#dc2626';
    const circleStroke = isImportant ? importantColor : '#fff';
    const circleStrokeWidth = isImportant ? 5 : 2;
    let nodeCenterContent = '';
    if (isAccount) nodeCenterContent = accountIconSvg;
    else if (isPerson) nodeCenterContent = personIconSvg;
    else if (isGroup) nodeCenterContent = groupIconSvg;
    else nodeCenterContent = ''; // Capture nodes: show only thumbnail (above) or plain circle — no letter/number
    const outgoing = edges.filter(e => e.from === n.id).map(e => (nodeMap[e.to] && nodeMap[e.to].title) || e.to);
    const incoming = edges.filter(e => e.to === n.id).map(e => (nodeMap[e.from] && nodeMap[e.from].title) || e.from);
    const linkParts = [];
    if (outgoing.length) linkParts.push('To: ' + outgoing.map(t => String(t).slice(0, 30)).join(', '));
    if (incoming.length) linkParts.push('From: ' + incoming.map(t => String(t).slice(0, 30)).join(', '));
    const linkTooltip = linkParts.length ? linkParts.join(' · ') : 'No connections';
    const linkLabel = ''; // No Out/In counts on nodes — hover title shows link info
    const noPreviewTip = isCapture && !n.imageDataUrl ? ' (No preview — this capture has no screenshot saved)' : '';
    const nodeTitle = escapeHtml(linkTooltip) + noPreviewTip;
    const selectedClass = graphSelectedNodeIds && graphSelectedNodeIds.has(n.id) ? ' graph-node-selected' : '';
    return `
      <defs><clipPath id="${clipId}"><circle cx="0" cy="0" r="${nodeRadius}"/></clipPath></defs>
      <g class="graph-node graph-node-${n.type || 'capture'}${isImportant ? ' graph-node-important' : ''}${selectedClass}" data-id="${escapeHtml(n.id)}" data-type="${n.type || 'capture'}" transform="translate(${x},${y})">
        <title>${nodeTitle}</title>
        <circle r="${nodeRadius}" fill="${fill}" stroke="${circleStroke}" stroke-width="${circleStrokeWidth}" cursor="grab" class="graph-node-hit"/>
        ${thumb}
        ${nodeCenterContent}
        ${tagStr ? `<text y="${nodeRadius + 14}" text-anchor="middle" font-size="9" fill="#333" pointer-events="none">${escapeHtml(tagStr.slice(0, 20))}</text>` : ''}
        ${linkLabel}
      </g>`;
  }).join('');

  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const markerDefs = [
    ['graph-arrow-auto', edgeColorAuto],
    ['graph-arrow-domain', edgeColorDomain],
    ['graph-arrow-manual', edgeColorManual],
    ['graph-arrow-personGroup', edgeColorPersonGroup],
    ['graph-arrow-groupGroup', edgeColorGroupGroup],
    ['graph-arrow-accountPerson', edgeColorAccountPerson],
  ].map(([id, col]) => `<marker id="${id}" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><polygon points="0 0, 10 3, 0 6" fill="${escapeHtml(col)}"/></marker>`).join('');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.innerHTML = `
    <defs>${markerDefs}</defs>
    <rect class="graph-bg" width="${w}" height="${h}" x="0" y="0"/>
    <g class="graph-pan" transform="translate(${graphPan.x},${graphPan.y}) scale(${graphZoom})">
      <g class="graph-edges">${edgesMarkup}</g>
      ${nodesMarkup}
    </g>
  `;

  let dragNode = null;
  let dragStart = null;
  let dragNodeStart = null;
  let dragGrabOffset = null; // content-space offset from node center to cursor at mousedown
  const DRAG_THRESHOLD = 5;

  const getSvgCoords = (e) => {
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const vx = ((e.clientX - rect.left) / rect.width) * vb.width;
    const vy = ((e.clientY - rect.top) / rect.height) * vb.height;
    return { x: vx, y: vy };
  };
  const getInnerCoords = (e) => {
    const pt = getSvgCoords(e);
    return {
      x: (pt.x - graphPan.x) / graphZoom,
      y: (pt.y - graphPan.y) / graphZoom,
    };
  };
  let boxSelectRect = null;
  let boxSelectStart = null;
  const onBoxSelectMove = (e) => {
    if (!boxSelectStart || !boxSelectRect) return;
    const cur = getInnerCoords(e);
    const x = Math.min(boxSelectStart.x, cur.x);
    const y = Math.min(boxSelectStart.y, cur.y);
    const w = Math.abs(cur.x - boxSelectStart.x);
    const h = Math.abs(cur.y - boxSelectStart.y);
    boxSelectRect.setAttribute('x', x);
    boxSelectRect.setAttribute('y', y);
    boxSelectRect.setAttribute('width', w);
    boxSelectRect.setAttribute('height', h);
  };
  const onBoxSelectUp = (e) => {
    if (!boxSelectStart || !boxSelectRect) return;
    const cur = getInnerCoords(e);
    const xMin = Math.min(boxSelectStart.x, cur.x);
    const yMin = Math.min(boxSelectStart.y, cur.y);
    const xMax = Math.max(boxSelectStart.x, cur.x);
    const yMax = Math.max(boxSelectStart.y, cur.y);
    const pad = 80;
    const t = graphViewTransform;
    nodes.forEach(n => {
      const cx = pad + (n.x - t.minX) * t.scale;
      const cy = pad + (n.y - t.minY) * t.scale;
      if (cx >= xMin && cx <= xMax && cy >= yMin && cy <= yMax) graphSelectedNodeIds.add(n.id);
    });
    boxSelectRect.remove();
    boxSelectRect = null;
    boxSelectStart = null;
    document.removeEventListener('mousemove', onBoxSelectMove);
    document.removeEventListener('mouseup', onBoxSelectUp);
    requestAnimationFrame(() => renderGraph({ skipTransformUpdate: true }));
  };
  const startBoxSelect = (e) => {
    if (e.button !== 0) return;
    const pt = getInnerCoords(e);
    boxSelectStart = { x: pt.x, y: pt.y };
    const panGroup = svg.querySelector('.graph-pan');
    if (!panGroup) return;
    boxSelectRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    boxSelectRect.setAttribute('class', 'graph-select-box');
    boxSelectRect.setAttribute('x', pt.x);
    boxSelectRect.setAttribute('y', pt.y);
    boxSelectRect.setAttribute('width', 0);
    boxSelectRect.setAttribute('height', 0);
    boxSelectRect.setAttribute('fill', 'rgba(100,100,255,0.15)');
    boxSelectRect.setAttribute('stroke', 'var(--accent)');
    boxSelectRect.setAttribute('stroke-width', '2');
    boxSelectRect.setAttribute('pointer-events', 'none');
    panGroup.appendChild(boxSelectRect);
    document.addEventListener('mousemove', onBoxSelectMove);
    document.addEventListener('mouseup', onBoxSelectUp);
  };
  const toPanCoords = (clientX, clientY) => {
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    return {
      x: ((clientX - rect.left) / rect.width) * vb.width,
      y: ((clientY - rect.top) / rect.height) * vb.height,
    };
  };

  const updatePanGroupTransform = () => {
    const panGroup = svg.querySelector('.graph-pan');
    if (panGroup) panGroup.setAttribute('transform', `translate(${graphPan.x},${graphPan.y}) scale(${graphZoom})`);
    updateGraphMinimap(graphBounds, w, h);
  };

  let minimapDragStart = null;
  let minimapJustDragged = false;

  function updateGraphMinimap(bounds, viewW, viewH) {
    const minimapEl = document.getElementById('graphMinimap');
    if (!minimapEl || !bounds || (bounds.maxX - bounds.minX) <= 0 && (bounds.maxY - bounds.minY) <= 0) return;
    const containerEl = document.getElementById('graphContainer');
    const state = containerEl?.graphMinimapState;
    // Always sync current zoom/pan into state so minimap reflects latest position and zoom (avoids stale closure)
    if (state) {
      state.graphZoom = graphZoom;
      state.graphPan = { x: graphPan.x, y: graphPan.y };
      bounds = state.bounds;
      viewW = state.w;
      viewH = state.h;
    }
    const viewT = state ? state.t : t;
    const viewPad = state ? state.pad : pad;
    const viewNodes = state ? state.nodes : nodes;
    const viewEdges = state ? state.edges : edges;
    const zoom = state ? state.graphZoom : graphZoom;
    const pan = state ? state.graphPan : graphPan;
    const mmW = 140;
    const mmH = 100;
    const layoutW = Math.max(bounds.maxX - bounds.minX, 1);
    const layoutH = Math.max(bounds.maxY - bounds.minY, 1);
    const scale = Math.min(mmW / layoutW, mmH / layoutH);
    const offsetX = (mmW - layoutW * scale) / 2;
    const offsetY = (mmH - layoutH * scale) / 2;
    // Visible region in layout space (use synced pan/zoom)
    const vleft = -pan.x / zoom;
    const vtop = -pan.y / zoom;
    const vw = viewW / zoom;
    const vh = viewH / zoom;
    const layoutLeft = viewT.minX + (vleft - viewPad) / viewT.scale;
    const layoutTop = viewT.minY + (vtop - viewPad) / viewT.scale;
    const layoutVw = vw / viewT.scale;
    const layoutVh = vh / viewT.scale;
    const vx = (layoutLeft - bounds.minX) * scale + offsetX;
    const vy = (layoutTop - bounds.minY) * scale + offsetY;
    const vwM = Math.max(1, layoutVw * scale);
    const vhM = Math.max(1, layoutVh * scale);
    const vxClamped = Math.max(offsetX, Math.min(offsetX + layoutW * scale - vwM, vx));
    const vyClamped = Math.max(offsetY, Math.min(offsetY + layoutH * scale - vhM, vy));
    // Viewport box scales with zoom: smaller when zoomed out, bigger when zoomed in (clearly shows where you are)
    const viewportCenterX = vxClamped + vwM / 2;
    const viewportCenterY = vyClamped + vhM / 2;
    const vwMDisplay = Math.max(6, Math.min(layoutW * scale, vwM * zoom * 1.2));
    const vhMDisplay = Math.max(6, Math.min(layoutH * scale, vhM * zoom * 1.2));
    let vxDisplay = viewportCenterX - vwMDisplay / 2;
    let vyDisplay = viewportCenterY - vhMDisplay / 2;
    vxDisplay = Math.max(offsetX, Math.min(offsetX + layoutW * scale - vwMDisplay, vxDisplay));
    vyDisplay = Math.max(offsetY, Math.min(offsetY + layoutH * scale - vhMDisplay, vyDisplay));
    // Node size and edge stroke scale with zoom: small when zoomed out, larger when zoomed in (shows relation to zoom)
    const nodeR = Math.max(0.4, Math.min(6, 1.2 * zoom));
    const edgeStroke = Math.max(0.4, Math.min(2, 0.6 * zoom));
    const edgePaths = viewEdges.map(({ from, to }) => {
      const a = viewNodes.find(n => n.id === from);
      const b = viewNodes.find(n => n.id === to);
      if (!a || !b) return '';
      const x1 = (a.x - bounds.minX) * scale + offsetX;
      const y1 = (a.y - bounds.minY) * scale + offsetY;
      const x2 = (b.x - bounds.minX) * scale + offsetX;
      const y2 = (b.y - bounds.minY) * scale + offsetY;
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(0,0,0,0.6)" stroke-width="${edgeStroke}"/>`;
    }).join('');
    const nodeDots = viewNodes.map(n => {
      const nx = (n.x - bounds.minX) * scale + offsetX;
      const ny = (n.y - bounds.minY) * scale + offsetY;
      return `<circle cx="${nx}" cy="${ny}" r="${nodeR}" fill="rgba(0,0,0,0.75)" stroke="#fff" stroke-width="${Math.max(0.25, nodeR * 0.25)}"/>`;
    }).join('');
    minimapEl.innerHTML = `
      <svg viewBox="0 0 ${mmW} ${mmH}" preserveAspectRatio="none" class="minimap-svg">
        <rect class="minimap-bg" width="${mmW}" height="${mmH}" fill="#d1d5db"/>
        <rect class="minimap-graph-bounds" x="${offsetX}" y="${offsetY}" width="${layoutW * scale}" height="${layoutH * scale}" fill="rgba(255,255,255,0.9)" stroke="rgba(0,0,0,0.25)" stroke-width="1"/>
        <g class="minimap-edges">${edgePaths}</g>
        <g class="minimap-nodes">${nodeDots}</g>
        <rect class="minimap-viewport-bg" x="${vxDisplay}" y="${vyDisplay}" width="${vwMDisplay}" height="${vhMDisplay}"/>
        <rect id="minimapViewportRect" class="minimap-viewport minimap-viewport-draggable" x="${vxDisplay}" y="${vyDisplay}" width="${vwMDisplay}" height="${vhMDisplay}" cursor="move"/>
      </svg>`;
    const svgEl = minimapEl.querySelector('svg');
    const viewportRect = minimapEl.querySelector('#minimapViewportRect');
    const getMinimapCoords = (e) => {
      if (!svgEl) return { mx: 0, my: 0 };
      const rect = svgEl.getBoundingClientRect();
      return {
        mx: ((e.clientX - rect.left) / rect.width) * mmW,
        my: ((e.clientY - rect.top) / rect.height) * mmH,
      };
    };
    const layoutFromMinimap = (mx, my) => ({
      x: bounds.minX + (mx - offsetX) / scale,
      y: bounds.minY + (my - offsetY) / scale,
    });
    const viewSpaceFromLayout = (lx, ly) => ({
      x: viewPad + (lx - viewT.minX) * viewT.scale,
      y: viewPad + (ly - viewT.minY) * viewT.scale,
    });
    if (viewportRect) {
      viewportRect.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        minimapJustDragged = false;
        const pos = getMinimapCoords(e);
        minimapDragStart = { mx: pos.mx, my: pos.my, vx: vxClamped, vy: vyClamped };
        const onMinimapMove = (e2) => {
          if (!minimapDragStart) return;
          minimapJustDragged = true;
          const cur = getMinimapCoords(e2);
          let newVx = minimapDragStart.vx + (cur.mx - minimapDragStart.mx);
          let newVy = minimapDragStart.vy + (cur.my - minimapDragStart.my);
          const minVx = offsetX;
          const maxVx = offsetX + layoutW * scale - vwM;
          const minVy = offsetY;
          const maxVy = offsetY + layoutH * scale - vhM;
          newVx = Math.max(minVx, Math.min(maxVx, newVx));
          newVy = Math.max(minVy, Math.min(maxVy, newVy));
          const newLayoutLeft = bounds.minX + (newVx - offsetX) / scale;
          const newLayoutTop = bounds.minY + (newVy - offsetY) / scale;
          const vs = viewSpaceFromLayout(newLayoutLeft, newLayoutTop);
          graphPan.x = -vs.x * graphZoom;
          graphPan.y = -vs.y * graphZoom;
          updatePanGroupTransform();
          minimapDragStart.vx = newVx;
          minimapDragStart.vy = newVy;
        };
        const onMinimapUp = () => {
          minimapDragStart = null;
          document.removeEventListener('mousemove', onMinimapMove);
          document.removeEventListener('mouseup', onMinimapUp);
          chrome.runtime.sendMessage({ action: 'setCaseConfig', caseId: currentCaseId, config: { graphPan, graphZoom, graphViewTransform } }).catch(() => {});
        };
        document.addEventListener('mousemove', onMinimapMove);
        document.addEventListener('mouseup', onMinimapUp);
      });
    }
    minimapEl.onclick = (e) => {
      if (minimapJustDragged) { minimapJustDragged = false; return; }
      if (e.target.closest('.minimap-viewport-draggable')) return;
      if (!svgEl) return;
      const rect = svgEl.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * mmW;
      const my = ((e.clientY - rect.top) / rect.height) * mmH;
      const layout = layoutFromMinimap(mx, my);
      const vs = viewSpaceFromLayout(layout.x, layout.y);
      graphPan.x = viewW / 2 - vs.x * graphZoom;
      graphPan.y = viewH / 2 - vs.y * graphZoom;
      updatePanGroupTransform();
      chrome.runtime.sendMessage({ action: 'setCaseConfig', caseId: currentCaseId, config: { graphPan, graphZoom, graphViewTransform } }).catch(() => {});
    };
  }

  const onPanMove = (e) => {
    if (!container.dataset.panStart) return;
    const start = JSON.parse(container.dataset.panStart);
    const cur = toPanCoords(e.clientX, e.clientY);
    graphPan.x += cur.x - start.x;
    graphPan.y += cur.y - start.y;
    container.dataset.panStart = JSON.stringify({ x: cur.x, y: cur.y });
    updatePanGroupTransform();
  };
  const onPanUp = () => {
    graphIsPanning = false;
    container.classList.remove('panning');
    delete container.dataset.panStart;
    document.removeEventListener('mousemove', onPanMove);
    document.removeEventListener('mouseup', onPanUp);
    chrome.runtime.sendMessage({ action: 'setCaseConfig', caseId: currentCaseId, config: { graphPan, graphZoom, graphViewTransform } }).catch(() => {});
  };

  const startPan = (e) => {
    if (e.button !== 0 && e.button !== 1) return; // left (0) or middle (1) mouse
    if (graphLinkFromId) { graphLinkFromId = null; graphLinkFromType = null; graphLinkFromIds = null; graphUnlinkFromIds = null; if (linkHintEl) linkHintEl.classList.add('hidden'); if (container) { container.classList.remove('link-mode'); container.classList.remove('link-mode-link'); container.classList.remove('link-mode-unlink'); } return; }
    if (graphUnlinkFromId) { graphUnlinkFromId = null; graphUnlinkFromType = null; graphLinkFromIds = null; graphUnlinkFromIds = null; if (linkHintEl) linkHintEl.classList.add('hidden'); if (container) { container.classList.remove('link-mode'); container.classList.remove('link-mode-link'); container.classList.remove('link-mode-unlink'); } return; }
    e.preventDefault();
    graphIsPanning = true;
    container.classList.add('panning');
    container.dataset.panStart = JSON.stringify(toPanCoords(e.clientX, e.clientY));
    document.addEventListener('mousemove', onPanMove);
    document.addEventListener('mouseup', onPanUp);
  };
  const onGraphContextMenu = (e) => {
    e.preventDefault();
    if (graphLinkFromId) { graphLinkFromId = null; graphLinkFromType = null; graphLinkFromIds = null; graphUnlinkFromIds = null; if (linkHintEl) linkHintEl.classList.add('hidden'); if (container) { container.classList.remove('link-mode'); container.classList.remove('link-mode-link'); container.classList.remove('link-mode-unlink'); } }
    if (graphUnlinkFromId) { graphUnlinkFromId = null; graphUnlinkFromType = null; graphLinkFromIds = null; graphUnlinkFromIds = null; if (linkHintEl) linkHintEl.classList.add('hidden'); if (container) { container.classList.remove('link-mode'); container.classList.remove('link-mode-link'); container.classList.remove('link-mode-unlink'); } }
    document.getElementById('graphNodeMenu')?.classList.add('hidden');
  };
  const bg = svg.querySelector('.graph-bg');
  if (bg) {
    bg.addEventListener('mousedown', (e) => {
      if (e.shiftKey && e.button === 0) { startBoxSelect(e); return; }
      startPan(e);
    });
    bg.addEventListener('contextmenu', onGraphContextMenu);
  }
  if (container && !container.dataset.panListenersAdded) {
    container.dataset.panListenersAdded = '1';
    container.addEventListener('mousedown', (e) => {
      if (e.button === 1) { startPan(e); return; }
      if (e.target.closest('.graph-node') || e.target.closest('.graph-edge')) return;
      if (e.shiftKey && e.button === 0) { startBoxSelect(e); return; }
      if (e.button === 0 && graphSelectedNodeIds.size > 0) {
        graphSelectedNodeIds.clear();
        requestAnimationFrame(() => renderGraph({ skipTransformUpdate: true }));
      }
      startPan(e);
    });
    container.addEventListener('contextmenu', (e) => {
      const edgeEl = e.target.closest('.graph-edge');
      if (edgeEl && (edgeEl.dataset.from || e.target.closest('.graph-edge-hit'))) {
        e.preventDefault();
        e.stopPropagation();
        const fromId = edgeEl.dataset.from;
        const toId = edgeEl.dataset.to;
        const fromType = edgeEl.dataset.fromType || 'capture';
        const toType = edgeEl.dataset.toType || 'capture';
        if (fromId && toId) {
          removeGraphLink(fromId, fromType, toId, toType).then(() => load());
        }
        return;
      }
      if (e.target.closest('.graph-node') || e.target.closest('.graph-edge')) return;
      onGraphContextMenu(e);
    });
  }

  if (container && !container.dataset.wheelZoomAdded) {
    container.dataset.wheelZoomAdded = '1';
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const panGroup = svg.querySelector('.graph-pan');
      if (!panGroup) return;
      const rect = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      const vx = ((e.clientX - rect.left) / rect.width) * vb.width;
      const vy = ((e.clientY - rect.top) / rect.height) * vb.height;
      const oldZoom = graphZoom;
      graphZoom *= e.deltaY < 0 ? 1.15 : 0.87;
      graphZoom = Math.max(graphZoomMin, Math.min(graphZoomMax, graphZoom));
      graphPan.x += (vx - graphPan.x) * (1 - graphZoom / oldZoom);
      graphPan.y += (vy - graphPan.y) * (1 - graphZoom / oldZoom);
      updatePanGroupTransform();
      chrome.runtime.sendMessage({ action: 'setCaseConfig', caseId: currentCaseId, config: { graphPan, graphZoom } }).catch(() => {});
    }, { passive: false });
  }

  if (container && !container.dataset.graphResizeObserved) {
    container.dataset.graphResizeObserved = '1';
    const ro = new ResizeObserver(() => {
      if (document.getElementById('panel-graph')?.classList.contains('active')) {
        requestAnimationFrame(() => renderGraph({ skipTransformUpdate: true }));
      }
    });
    ro.observe(container);
  }

  // Store current state so zoom/pan handlers (attached once, stale closure) can read fresh bounds, size, transform, and node positions
  if (container) {
    container.graphMinimapState = {
      bounds: { minX: graphBounds.minX, minY: graphBounds.minY, maxX: graphBounds.maxX, maxY: graphBounds.maxY },
      w, h,
      t: { minX: t.minX, minY: t.minY, scale: t.scale },
      pad,
      nodes: nodes.map(n => ({ id: n.id, x: n.x, y: n.y })),
      edges: edges.map(e => ({ from: e.from, to: e.to })),
      graphZoom,
      graphPan: { x: graphPan.x, y: graphPan.y },
    };
    container.graphExportBounds = graphBounds;
    const typeOrder = { group: 0, person: 1, account: 2, capture: 3 };
    const captureById = new Map((allCaptures || []).map(c => [c.id, c]));
    const nodeTime = (n) => {
      if (n.type !== 'capture') return 0;
      const c = captureById.get(n.id);
      return (c && c.timestamp) ? new Date(c.timestamp).getTime() : 0;
    };
    const sorted = [...nodes].sort((a, b) => {
      if (typeOrder[a.type] !== typeOrder[b.type]) return typeOrder[a.type] - typeOrder[b.type];
      return nodeTime(a) - nodeTime(b);
    });
    container.graphOrderedNodeIds = sorted.map(n => n.id);
  }
  updateGraphMinimap(graphBounds, w, h);

  const updateEdgeInDom = (edgeEl, fromId, toId) => {
    const a = nodeMap[fromId];
    const b = nodeMap[toId];
    if (!a || !b) return;
    const paths = edgeEl.querySelectorAll('path');
    paths.forEach(p => p.setAttribute('d', edgePath(a, b)));
  };

  const onNodeMove = (e) => {
    if (!dragNode || !dragGrabOffset) return;
    const inner = getInnerCoords(e);
    const dist = Math.hypot(inner.x - dragStart.x, inner.y - dragStart.y);
    if (dist >= DRAG_THRESHOLD) graphDidMoveWhileDrag = true;
    const node = nodeMap[dragNode];
    if (!node) return;
    const t = graphViewTransform;
    const contentX = inner.x - dragGrabOffset.x;
    const contentY = inner.y - dragGrabOffset.y;
    const newX = (contentX - pad) / t.scale + t.minX;
    const newY = (contentY - pad) / t.scale + t.minY;
    const dx = newX - node.x;
    const dy = newY - node.y;
    const toMove = graphSelectedNodeIds.has(dragNode) && graphSelectedNodeIds.size > 0
      ? [...graphSelectedNodeIds].map(id => nodeMap[id]).filter(Boolean)
      : [node];
    toMove.forEach(n => {
      const c = clampLayout(n.x + dx, n.y + dy);
      n.x = c.x;
      n.y = c.y;
    });
    toMove.forEach(n => {
      const nx = pad + (n.x - t.minX) * t.scale;
      const ny = pad + (n.y - t.minY) * t.scale;
      const nodeEl = svg.querySelector(`.graph-node[data-id="${CSS.escape(n.id)}"]`);
      if (nodeEl) nodeEl.setAttribute('transform', `translate(${nx},${ny})`);
    });
    const movedIds = new Set(toMove.map(n => n.id));
    svg.querySelectorAll('.graph-edge').forEach(edgeEl => {
      const fromId = edgeEl.dataset.from;
      const toId = edgeEl.dataset.to;
      if (movedIds.has(fromId) || movedIds.has(toId)) updateEdgeInDom(edgeEl, fromId, toId);
    });
  };

  const onNodeUp = () => {
    if (!dragNode) return;
    const node = nodeMap[dragNode];
    const toSave = graphSelectedNodeIds.has(dragNode) && graphSelectedNodeIds.size > 0
      ? [...graphSelectedNodeIds].map(id => nodeMap[id]).filter(Boolean)
      : node ? [node] : [];
    if (toSave.length > 0) {
      toSave.forEach(n => {
        const c = clampLayout(n.x, n.y);
        n.x = c.x;
        n.y = c.y;
        graphLayout[n.id] = { x: c.x, y: c.y };
      });
      chrome.runtime.sendMessage({ action: 'setCaseConfig', caseId: currentCaseId, config: { graphLayout } });
      setTimeout(() => renderGraph({ skipTransformUpdate: true }), 0);
      if (!graphDidMoveWhileDrag && node && toSave.length <= 1) {
        if (node.type === 'account') {
          const idx = accounts.findIndex(x => x.id === dragNode);
          if (idx >= 0) openAccountModal(idx);
        } else if (node.type === 'person') {
          const idx = people.findIndex(x => x.id === dragNode);
          if (idx >= 0) openPersonModal(idx);
        } else if (node.type === 'group') {
          const idx = groups.findIndex(x => x.id === dragNode);
          if (idx >= 0) openGroupModal(idx);
        } else {
          openDetail(dragNode);
        }
      }
    }
    dragNode = null;
    dragGrabOffset = null;
    graphIsDraggingNode = false;
    graphDidMoveWhileDrag = false;
    document.removeEventListener('mousemove', onNodeMove);
    document.removeEventListener('mouseup', onNodeUp);
    svg.style.cursor = '';
  };

  const graphNodeMenu = document.getElementById('graphNodeMenu');
  if (graphNodeMenu && !graphNodeMenu.dataset.listenersAttached) {
    graphNodeMenu.dataset.listenersAttached = '1';
    graphNodeMenu.addEventListener('click', (e) => e.stopPropagation());
    graphNodeMenu.querySelectorAll('.graph-node-menu-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const menuNodeId = graphNodeMenu.dataset.nodeId;
        const menuNodeType = graphNodeMenu.dataset.nodeType || 'capture';
        const linkHint = document.getElementById('graphLinkHint');
        const cont = document.getElementById('graphContainer');
        if (btn.dataset.action === 'link') {
          if (!menuNodeId) return;
          if (graphSelectedNodeIds.size > 0) {
            graphLinkFromId = null;
            graphLinkFromType = null;
            graphLinkFromIds = new Set(graphSelectedNodeIds);
            graphUnlinkFromIds = null;
            if (linkHint) { linkHint.textContent = 'Left‑click a node to link to (right‑click background to cancel). One note per linked node can be added.'; linkHint.classList.remove('hidden'); }
          } else {
            graphLinkFromId = menuNodeId;
            graphLinkFromType = menuNodeType;
            graphLinkFromIds = null;
            graphUnlinkFromIds = null;
            if (linkHint) { linkHint.textContent = 'Now left‑click another node to link to (right‑click background to cancel)'; linkHint.classList.remove('hidden'); }
          }
          if (cont) { cont.classList.add('link-mode'); cont.classList.add('link-mode-link'); cont.classList.remove('link-mode-unlink'); }
        } else if (btn.dataset.action === 'unlink') {
          if (!menuNodeId) return;
          if (graphSelectedNodeIds.size > 0) {
            graphUnlinkFromId = null;
            graphUnlinkFromType = null;
            graphUnlinkFromIds = new Set(graphSelectedNodeIds);
            graphLinkFromIds = null;
            if (linkHint) { linkHint.textContent = 'Left‑click a node to unlink from (right‑click background to cancel)'; linkHint.classList.remove('hidden'); }
          } else {
            graphUnlinkFromId = menuNodeId;
            graphUnlinkFromType = menuNodeType;
            graphLinkFromIds = null;
            graphUnlinkFromIds = null;
            if (linkHint) { linkHint.textContent = 'Now left‑click a node to remove the link (right‑click background to cancel)'; linkHint.classList.remove('hidden'); }
          }
          if (cont) { cont.classList.add('link-mode'); cont.classList.add('link-mode-unlink'); cont.classList.remove('link-mode-link'); }
        } else if (btn.dataset.action === 'favourite') {
          if (!menuNodeId || menuNodeType !== 'capture') return;
          markImportant(menuNodeId).then(() => { if (document.getElementById('panel-graph')?.classList.contains('active')) renderGraph({ skipTransformUpdate: true }); });
        }
        graphNodeMenu.classList.add('hidden');
      });
    });
    document.addEventListener('click', () => graphNodeMenu.classList.add('hidden'));
  }

  svg.querySelectorAll('.graph-node').forEach(g => {
    const hit = g.querySelector('.graph-node-hit');
    const id = g.dataset.id;
    const nodeType = g.dataset.type || 'capture';
    if (hit) {
      hit.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
          if (e.button === 2) {
          if (graphNodeMenu) {
            graphNodeMenu.style.left = e.clientX + 'px';
            graphNodeMenu.style.top = e.clientY + 'px';
            graphNodeMenu.dataset.nodeId = id;
            graphNodeMenu.dataset.nodeType = nodeType;
            const favBtn = graphNodeMenu.querySelector('.graph-node-menu-item[data-action="favourite"]');
            if (favBtn) {
              favBtn.style.display = (nodeType === 'capture' || !nodeType) ? '' : 'none';
              if (nodeType === 'capture' || !nodeType) {
                const cap = allCaptures.find(x => x.id === id);
                favBtn.textContent = cap?.important ? '☆ Unfavourite' : '★ Favourite';
              }
            }
            graphNodeMenu.classList.remove('hidden');
          }
          return;
        }
        if (e.button !== 0) return;
        if (graphUnlinkFromIds) {
          if (graphUnlinkFromIds.has(id)) return;
          (async () => {
            const toId = id;
            const toType = nodeType;
            for (const fromId of graphUnlinkFromIds) {
              if (fromId === toId) continue;
              const fromType = nodeMap[fromId]?.type || 'capture';
              await removeGraphLink(fromId, fromType, toId, toType);
              applyGraphLinkRemovalLocally(fromId, fromType, toId, toType);
            }
            graphUnlinkFromIds = null;
            if (linkHintEl) linkHintEl.classList.add('hidden');
            if (container) { container.classList.remove('link-mode'); container.classList.remove('link-mode-link'); container.classList.remove('link-mode-unlink'); }
            load();
          })();
          return;
        }
        if (graphUnlinkFromId) {
          if (id === graphUnlinkFromId) return;
          removeGraphLink(graphUnlinkFromId, graphUnlinkFromType, id, nodeType);
          graphUnlinkFromId = null;
          graphUnlinkFromType = null;
          graphUnlinkFromIds = null;
          if (linkHintEl) linkHintEl.classList.add('hidden');
          if (container) { container.classList.remove('link-mode'); container.classList.remove('link-mode-link'); container.classList.remove('link-mode-unlink'); }
          load();
          return;
        }
        if (graphLinkFromIds) {
          if (graphLinkFromIds.has(id)) return;
          const fromIdsAndTypes = Array.from(graphLinkFromIds).map(fromId => ({ id: fromId, type: nodeMap[fromId]?.type || 'capture' }));
          const noteEl = document.getElementById('linkNoteInput');
          const modal = document.getElementById('linkNoteModal');
          window._graphPendingLink = { fromIdsAndTypes, toId: id, toType: nodeType };
          graphLinkFromIds = null;
          if (linkHintEl) linkHintEl.classList.add('hidden');
          if (container) { container.classList.remove('link-mode'); container.classList.remove('link-mode-link'); container.classList.remove('link-mode-unlink'); }
          if (noteEl) noteEl.value = '';
          if (modal) modal.classList.remove('hidden');
          if (noteEl) noteEl.focus();
          return;
        }
        if (graphLinkFromId) {
          if (id === graphLinkFromId) return;
          const noteEl = document.getElementById('linkNoteInput');
          const modal = document.getElementById('linkNoteModal');
          window._graphPendingLink = { fromId: graphLinkFromId, fromType: graphLinkFromType, toId: id, toType: nodeType };
          graphLinkFromId = null;
          graphLinkFromType = null;
          graphLinkFromIds = null;
          if (linkHintEl) linkHintEl.classList.add('hidden');
          if (container) { container.classList.remove('link-mode'); container.classList.remove('link-mode-link'); container.classList.remove('link-mode-unlink'); }
          if (noteEl) noteEl.value = '';
          if (modal) modal.classList.remove('hidden');
          if (noteEl) noteEl.focus();
          return;
        }
        if (e.shiftKey) {
          if (graphSelectedNodeIds.has(id)) graphSelectedNodeIds.delete(id);
          else graphSelectedNodeIds.add(id);
          requestAnimationFrame(() => renderGraph({ skipTransformUpdate: true }));
          return;
        }
        if (!graphSelectedNodeIds.has(id)) graphSelectedNodeIds.clear();
        graphIsDraggingNode = true;
        graphDidMoveWhileDrag = false;
        dragNode = id;
        const node = nodeMap[id];
        dragNodeStart = { x: node.x, y: node.y };
        dragStart = getInnerCoords(e);
        const t = graphViewTransform;
        const nodeContentX = pad + (node.x - t.minX) * t.scale;
        const nodeContentY = pad + (node.y - t.minY) * t.scale;
        dragGrabOffset = { x: dragStart.x - nodeContentX, y: dragStart.y - nodeContentY };
        document.addEventListener('mousemove', onNodeMove);
        document.addEventListener('mouseup', onNodeUp);
        svg.style.cursor = 'grabbing';
      });
    }
    g.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  });
}

function applyGraphLinkRemovalLocally(fromId, fromType, toId, toType) {
  const removeFromEntity = (entity, targetId) => {
    if (!entity || !entity.links) return entity;
    const links = entity.links.filter(l => l.id !== targetId);
    return { ...entity, links };
  };
  if (fromType === 'account') {
    const idx = accounts.findIndex(a => a.id === fromId);
    if (idx >= 0) accounts[idx] = removeFromEntity(accounts[idx], toId);
  } else {
    const c = allCaptures.find(x => x.id === fromId);
    if (c) {
      const links = (c.links || []).filter(l => l.id !== toId);
      const idx = allCaptures.findIndex(x => x.id === fromId);
      if (idx >= 0) allCaptures[idx] = { ...allCaptures[idx], links };
    }
  }
  if (toType === 'account') {
    const idx = accounts.findIndex(a => a.id === toId);
    if (idx >= 0) accounts[idx] = removeFromEntity(accounts[idx], fromId);
  } else {
    const c = allCaptures.find(x => x.id === toId);
    if (c) {
      const links = (c.links || []).filter(l => l.id !== fromId);
      const idx = allCaptures.findIndex(x => x.id === toId);
      if (idx >= 0) allCaptures[idx] = { ...allCaptures[idx], links };
    }
  }
}

async function removeGraphLink(fromId, fromType, toId, toType) {
  const removeFromEntity = (entity, targetId) => {
    if (!entity || !entity.links) return entity;
    const links = entity.links.filter(l => l.id !== targetId);
    return { ...entity, links };
  };
  if (fromType === 'account') {
    const acc = accounts.find(x => x.id === fromId);
    if (acc) {
      const next = accounts.map(a => a.id === fromId ? removeFromEntity(a, toId) : a);
      await chrome.runtime.sendMessage({ action: 'setAccounts', caseId: currentCaseId, list: next });
    }
  } else {
    const c = allCaptures.find(x => x.id === fromId);
    if (c) {
      const links = (c.links || []).filter(l => l.id !== toId);
      await chrome.runtime.sendMessage({ action: 'updateCapture', id: fromId, updates: { links } });
    }
  }
  if (toType === 'account') {
    const acc = accounts.find(x => x.id === toId);
    if (acc) {
      const next = accounts.map(a => a.id === toId ? removeFromEntity(a, fromId) : a);
      await chrome.runtime.sendMessage({ action: 'setAccounts', caseId: currentCaseId, list: next });
    }
  } else {
    const c = allCaptures.find(x => x.id === toId);
    if (c) {
      const links = (c.links || []).filter(l => l.id !== fromId);
      await chrome.runtime.sendMessage({ action: 'updateCapture', id: toId, updates: { links } });
    }
  }
}

// Format time for display: always include timezone (e.g. "11 Mar 2025, 14:30 GMT")
function formatTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const opts = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' };
    return d.toLocaleString(undefined, opts);
  } catch (_) {
    try { return new Date(iso).toISOString(); } catch (e2) { return String(iso); }
  }
}
// Full timestamp with seconds and timezone
function formatTimestampFull(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    });
  } catch (_) {
    return new Date(iso).toISOString();
  }
}
// Compact format with timezone for logs (YYYY-MM-DD HH:mm:ss TZ)
function formatTimeWithZone(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    const tz = d.toLocaleTimeString(undefined, { timeZoneName: 'short' }).split(' ').pop() || 'UTC';
    return `${y}-${m}-${day} ${h}:${min}:${s} ${tz}`;
  } catch (_) {
    return String(iso).replace('T', ' ').slice(0, 19) + ' Z';
  }
}

/** Returns { datetime, tz } for troubleshooting log so timezone is shown on its own line. */
function formatTimeWithZoneParts(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    const tz = d.toLocaleTimeString(undefined, { timeZoneName: 'short' }).split(' ').pop() || 'UTC';
    return { datetime: `${y}-${m}-${day} ${h}:${min}:${s}`, tz };
  } catch (_) {
    const s = String(iso).replace('T', ' ').slice(0, 19);
    return { datetime: s, tz: 'Z' };
  }
}
function escapeHtml(s) {
  if (s == null) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}

// CSS to hide common cookie/consent/privacy overlays so they don't block content in the Page tab
const PRIVACY_NOTICE_HIDING_CSS = `
/* OneTrust */
#onetrust-consent-sdk, .onetrust-pc-dark-filter, [id^="onetrust-"] { display: none !important; }
/* Cookiebot */
#CybotCookiebotDialog, .CybotCookiebotDialogActive, #CybotCookiebotDialogBody { display: none !important; }
/* Generic cookie/consent */
#cookie-banner, .cookie-banner, .cookie-consent, .cookie-notice, #cookie-notice, .cookie-notice,
#cookie-law-info-bar, .cookie-law-info-bar, .cli-modal, #cookiePolicyDialog,
.cc-window, .cc-banner, .cc-modal { display: none !important; }
/* TrustArc */
#truste-consent-track, .truste_box_overlay { display: none !important; }
/* Quantcast */
.qc-cmp2-container, #qc-cmp2-main { display: none !important; }
/* Evidon */
.evidon-banner, #_evidon-consent, #_evidon-banner { display: none !important; }
/* Sourcepoint */
.sp_choice_type_11, #sp-cc, .message-container[data-nosnippet] { display: none !important; }
/* Common patterns */
[id*="cookie-banner"], [class*="cookie-banner"], [id*="cookie-consent"], [class*="cookie-consent"],
[id*="consent-banner"], [class*="consent-banner"], [id*="gdpr-banner"], [class*="gdpr-banner"],
[class*="privacy-banner"], [id*="privacy-banner"] { display: none !important; }
`;

function injectPrivacyNoticeHidingCss(html) {
  if (!html || typeof html !== 'string') return html;
  const styleBlock = '<style id="shuck-hide-privacy">' + PRIVACY_NOTICE_HIDING_CSS.trim() + '</style>';
  if (/<head[\s>]/i.test(html)) return html.replace(/(<head[\s>][^<]*)/i, '$1' + styleBlock);
  if (/<html[\s>]/i.test(html)) return html.replace(/(<html[\s>][^<]*)/i, '$1<head>' + styleBlock + '</head>');
  return styleBlock + html;
}

function escapeRegexLiteral(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function highlightSourceWithSelectors(html, list) {
  if (!html) return '(No HTML saved)';
  let text = escapeHtml(html);
  if (!list || !list.length) return text;
  for (const sel of list) {
    const pattern = (sel.pattern || '').trim();
    if (!pattern) continue;
    try {
      const regex = sel.useRegex ? new RegExp(pattern, 'gi') : new RegExp(escapeRegexLiteral(pattern), 'gi');
      text = text.replace(regex, match => `<mark class="shuck-highlight" title="${escapeHtml(sel.name || pattern)}">${match}</mark>`);
    } catch (_) {}
  }
  return text;
}

function refreshTagModalLists() {
  const addTagModal = document.getElementById('addTagModal');
  const addTagExistingList = document.getElementById('addTagExistingList');
  const addTagPickerList = document.getElementById('addTagPickerList');
  const addTagNewInput = document.getElementById('addTagNewInput');
  const id = addTagModal.dataset.captureId;
  if (!id) return;
  const c = captures.find(x => x.id === id) || allCaptures.find(x => x.id === id);
  const existingTags = (c && c.tags) || [];
  const existingSet = new Set(existingTags);
  addTagExistingList.innerHTML = existingTags.length
    ? existingTags.map(tag => `
        <div class="tag-existing-row" data-tag="${escapeHtml(tag)}">
          <span class="tag">${escapeHtml(tag)}</span>
          <button type="button" class="btn-edit-tag btn btn-secondary" data-tag="${escapeHtml(tag)}">Edit</button>
          <button type="button" class="btn-remove-tag btn btn-secondary" data-tag="${escapeHtml(tag)}">Remove</button>
        </div>
      `).join('')
    : '<p class="muted tag-existing-empty">No tags on this capture yet.</p>';
  addTagExistingList.querySelectorAll('.btn-remove-tag').forEach(btn => {
    btn.addEventListener('click', () => removeTagFromCapture(id, btn.dataset.tag));
  });
  addTagExistingList.querySelectorAll('.btn-edit-tag').forEach(btn => {
    btn.addEventListener('click', () => editTagOnCapture(id, btn.dataset.tag));
  });
  const suggested = [...new Set([...DEFAULT_TAGS, ...globalTagList])].filter(t => t && !existingSet.has(t)).sort();
  addTagPickerList.innerHTML = suggested.length
    ? suggested.map(t => `<button type="button" class="tag-picker-btn" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('')
    : '<p class="muted tag-picker-empty">No suggested tags (add in Configuration or type below)</p>';
  addTagPickerList.querySelectorAll('.tag-picker-btn').forEach(btn => {
    btn.addEventListener('click', () => applyTagFromModal(btn.dataset.tag));
  });
  if (addTagNewInput) addTagNewInput.value = '';
  const addTagToGlobalEl = document.getElementById('addTagToGlobalList');
  if (addTagToGlobalEl) addTagToGlobalEl.checked = false;
}

async function removeTagFromCapture(captureId, tag) {
  const c = captures.find(x => x.id === captureId) || allCaptures.find(x => x.id === captureId);
  if (!c) return;
  const tags = (c.tags || []).filter(t => t !== tag);
  await chrome.runtime.sendMessage({ action: 'updateCapture', id: captureId, updates: { tags } });
  await load();
  refreshTagModalLists();
  if (detailCaptureId === captureId) openDetail(captureId, { preserveActiveTab: true });
}

async function editTagOnCapture(captureId, oldTag) {
  const newTag = await showPromptModal('Edit tag', 'Tag:', oldTag);
  if (newTag == null || newTag.trim() === '') return;
  const t = newTag.trim();
  if (t === oldTag) return;
  const c = captures.find(x => x.id === captureId) || allCaptures.find(x => x.id === captureId);
  if (!c) return;
  const tags = (c.tags || []).map(tag => tag === oldTag ? t : tag);
  await chrome.runtime.sendMessage({ action: 'updateCapture', id: captureId, updates: { tags } });
  await load();
  refreshTagModalLists();
  if (detailCaptureId === captureId) openDetail(captureId, { preserveActiveTab: true });
}

function addTag(id) {
  const addTagModal = document.getElementById('addTagModal');
  const addTagNewInput = document.getElementById('addTagNewInput');
  addTagModal.dataset.captureId = id;
  if (addTagNewInput) addTagNewInput.value = '';
  refreshTagModalLists();
  addTagModal.classList.remove('hidden');
  if (addTagNewInput) addTagNewInput.focus();
}

async function applyTagFromModal(tag) {
  const addTagModalEl = document.getElementById('addTagModal');
  const addTagNewInputEl = document.getElementById('addTagNewInput');
  const addTagToGlobalEl = document.getElementById('addTagToGlobalList');
  const id = addTagModalEl.dataset.captureId;
  if (!id) return;
  const t = (typeof tag === 'string' ? tag : (addTagNewInputEl?.value || '').trim()).trim();
  if (!t) return;
  const c = captures.find(x => x.id === id) || allCaptures.find(x => x.id === id);
  if (!c) return;
  await chrome.runtime.sendMessage({ action: 'updateCapture', id, updates: { tags: [...(c.tags || []), t] } });
  if (addTagToGlobalEl && addTagToGlobalEl.checked && !globalTagList.includes(t)) {
    globalTagList = [...globalTagList, t];
    await chrome.runtime.sendMessage({ action: 'setGlobalTags', tags: globalTagList });
  }
  await load();
  refreshTagModalLists();
  if (detailCaptureId === id) openDetail(id, { preserveActiveTab: true });
}

function closeAddTagModal() {
  document.getElementById('addTagModal').classList.add('hidden');
}
async function deleteCapture(id) {
  const ok = await showConfirmModal('Delete capture', 'Delete this capture?');
  if (!ok) return;
  await chrome.runtime.sendMessage({ action: 'deleteCapture', id });
  if (detailCaptureId === id) detailModal.classList.add('hidden');
  load();
}

function openDetail(id, opts) {
  const c = allCaptures.find(x => x.id === id);
  if (!c) return;
  detailCaptureId = id;
  const preserveTab = opts && opts.preserveActiveTab;
  detailTitle.textContent = c.title || c.url || 'Capture';
  detailUrl.innerHTML = c.url ? `<a href="${escapeHtml(c.url)}" target="_blank" rel="noopener">${escapeHtml(c.url)}</a>` : '';
  detailMeta.textContent = `${formatTimestampFull(c.timestamp)} · Hash: ${(c.contentHash || '').slice(0, 16)}…`;
  const detailCaptureTypeEl = document.getElementById('detailCaptureType');
  if (detailCaptureTypeEl) {
    const sourceLabel = getCaptureSourceLabel(c);
    const hasNotes = !!(c.notes && String(c.notes).trim());
    const sameUrlNorm = normalizeUrlForCompare(c.url);
    const sameUrlCount = (captures || []).filter(x => normalizeUrlForCompare(x.url) === sameUrlNorm).length;
    const hasSameUrl = sameUrlCount > 1;
    detailCaptureTypeEl.innerHTML = [
      `<span class="detail-type-item"><span class="detail-type-key">Type</span> <span class="detail-type-badge detail-type-source">${escapeHtml(sourceLabel)}</span></span>`,
      `<span class="detail-type-item"><span class="detail-type-key">Has notes</span> <span class="detail-type-badge detail-type-notes ${hasNotes ? 'detail-type-yes' : 'detail-type-no'}">${hasNotes ? 'Yes' : 'No'}</span></span>`,
      `<span class="detail-type-item"><span class="detail-type-key">Same URL</span> <span class="detail-type-badge detail-type-sameurl ${hasSameUrl ? 'detail-type-yes' : 'detail-type-no'}">${hasSameUrl ? `Yes (${sameUrlCount} captures)` : 'No'}</span></span>`,
    ].join('');
  }
  const detailInlineFailed = document.getElementById('detailInlineFailed');
  if (detailInlineFailed) {
    if (c.inlineFailed) {
      detailInlineFailed.classList.remove('hidden');
      detailInlineFailed.innerHTML = `<p class="inline-failed-msg">This capture was saved without inlined media (page not ready or restrictions).</p><button type="button" id="detailRequestFromServer" class="btn btn-secondary">Request from server</button> <a href="${escapeHtml(c.url || '#')}" target="_blank" rel="noopener" class="btn btn-secondary">Open page</a>`;
      document.getElementById('detailRequestFromServer')?.addEventListener('click', () => requestReinlineFromList(c.id, c.url));
    } else {
      detailInlineFailed.classList.add('hidden');
    }
  }
  detailPreview.innerHTML = '';
  if (c.imageDataUrl) {
    const img = document.createElement('img');
    img.src = c.imageDataUrl;
    img.alt = 'Screenshot';
    detailPreview.appendChild(img);
    const annotateWrap = document.createElement('div');
    annotateWrap.className = 'detail-preview-actions';
    const annotateBtn = document.createElement('button');
    annotateBtn.type = 'button';
    annotateBtn.className = 'btn btn-secondary detail-annotate-btn';
    annotateBtn.textContent = 'Annotate';
    annotateBtn.title = 'Open screenshot in annotation editor; save as a new image linked to this capture';
    annotateBtn.addEventListener('click', async () => {
      const pendingKey = 'shuck_pending_annotate_' + Date.now();
      await chrome.storage.local.set({
        [pendingKey]: {
          imageDataUrl: c.imageDataUrl,
          url: c.url || '',
          title: (c.title || 'Screenshot').trim() || 'Screenshot',
          linkToCaptureId: c.id,
        },
      });
      chrome.tabs.create({ url: chrome.runtime.getURL('annotation.html?pending=' + encodeURIComponent(pendingKey)) });
    });
    annotateWrap.appendChild(annotateBtn);
    detailPreview.appendChild(annotateWrap);
  } else detailPreview.innerHTML = '<p class="muted">No screenshot</p>';
  const html = c.htmlContent || '';
  detailSourceContent.textContent = html || '(No HTML saved)';
  if (html) detailSourceContent.innerHTML = highlightSourceWithSelectors(html, selectors);
  const detailPageFrame = document.getElementById('detailPageFrame');
  const detailPageEmpty = document.getElementById('detailPageEmpty');
  const detailPageToolbar = document.querySelector('.detail-page-toolbar');
  if (detailPageFrame && detailPageEmpty) {
    if (html) {
      let doc = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
      const baseTag = c.url ? `<base href="${escapeHtml(c.url).replace(/"/g, '&quot;')}">` : '';
      if (baseTag) {
        if (/<head[\s>]/i.test(doc)) doc = doc.replace(/(<head[\s>][^<]*)/i, '$1' + baseTag);
        else if (/<html[\s>]/i.test(doc)) doc = doc.replace(/(<html[\s>][^<]*)/i, '$1' + baseTag);
        else doc = baseTag + doc;
      }
      const noLinkNavScript = '<script>(function(){document.addEventListener("click",function(e){var a=e.target.closest("a");if(a){e.preventDefault();}},true);document.querySelectorAll("a[href]").forEach(function(a){if(!a.title)a.title=a.getAttribute("href")||"";});})();<\/script>';
      if (/<\/body\s*>/i.test(doc)) doc = doc.replace(/<\/body\s*>/i, noLinkNavScript + '</body>');
      else if (/<\/html\s*>/i.test(doc)) doc = doc.replace(/<\/html\s*>/i, noLinkNavScript + '</html>');
      else doc = doc + noLinkNavScript;
      if (settings.hidePrivacyNoticesInRenderedView !== false) doc = injectPrivacyNoticeHidingCss(doc);
      detailPageFrame.srcdoc = doc;
      detailPageFrame.classList.remove('hidden');
      detailPageEmpty.classList.add('hidden');
      if (detailPageToolbar) detailPageToolbar.classList.remove('hidden');
    } else {
      detailPageFrame.classList.add('hidden');
      detailPageEmpty.classList.remove('hidden');
      if (detailPageToolbar) detailPageToolbar.classList.add('hidden');
    }
  }
  const techList = c.technologies || [];
  const headers = c.serverHeaders || {};
  detailTechnologies.innerHTML = techList.length ? techList.map(t => `<li><span class="tech-pill">${escapeHtml(t)}</span></li>`).join('') : '<li class="muted">None detected</li>';
  detailHeaders.innerHTML = Object.keys(headers).length ? Object.entries(headers).map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd><code>${escapeHtml(String(v))}</code></dd>`).join('') : '<dd class="muted">None captured</dd>';
  const ed = c.extractedData || { emails: [], ips: [] };
  detailEmails.innerHTML = (ed.emails && ed.emails.length) ? ed.emails.map(e => `<li><code>${escapeHtml(e)}</code></li>`).join('') : '<li class="muted">None found</li>';
  detailIps.innerHTML = (ed.ips && ed.ips.length) ? ed.ips.map(i => `<li><code>${escapeHtml(i)}</code></li>`).join('') : '<li class="muted">None found</li>';
  detailNotesInput.value = c.notes || '';
  detailImportant.checked = !!c.important;
  const tagList = c.tags || [];
  detailTags.innerHTML = tagList.map(t => `<span class="tag detail-tag"><span class="tag-text">${escapeHtml(t)}</span> <button type="button" class="tag-remove" data-tag="${escapeHtml(t)}" title="Remove tag">×</button></span>`).join('') +
    '<button type="button" class="btn-add-detail-tag btn btn-secondary">+ Tag</button>';
  detailTags.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tagToRemove = btn.dataset.tag;
      const next = (c.tags || []).filter(x => x !== tagToRemove);
      await chrome.runtime.sendMessage({ action: 'updateCapture', id: c.id, updates: { tags: next } });
      await load();
      openDetail(c.id, { preserveActiveTab: true });
    });
  });
  detailTags.querySelector('.btn-add-detail-tag')?.addEventListener('click', () => addTag(c.id));
  const linkList = c.links || [];
  const detailLinksListEl = document.getElementById('detailLinksList');
  const detailLinkTargetEl = document.getElementById('detailLinkTarget');
  const linkedSet = new Set(linkList.map(l => (l.type || 'capture') + ':' + l.id));
  const incomingLinks = [];
  const capId = c.id;
  [...allCaptures.filter(x => (x.links || []).some(l => l.id === capId)), ...accounts.filter(x => (x.links || []).some(l => l.id === capId))].forEach(src => {
    const link = (src.links || []).find(l => l.id === capId);
    const title = src.title || src.url || src.label || src.username || src.email || src.id;
    const type = src.username !== undefined ? 'account' : 'capture';
    const srcId = src.id;
    incomingLinks.push({ type, id: srcId, title, note: link && link.note });
  });
  if (detailLinksListEl) {
    const outgoingHtml = linkList.length
      ? '<p class="detail-links-section-label">Linked to (outgoing)</p>' + linkList.map((link, i) => {
          const type = link.type || 'capture';
          const id = link.id;
          let title = id;
          if (type === 'capture') {
            const target = allCaptures.find(x => x.id === id);
            title = target ? (target.title || target.url || id) : id;
          } else if (type === 'account') {
            const acc = accounts.find(x => x.id === id);
            title = acc ? (acc.label || acc.username || acc.email || id) : id;
          }
          const noteBlock = link.note ? `<div class="detail-link-note"><span class="detail-link-note-label">Note:</span>${escapeHtml(link.note)}</div>` : '';
          return `<li class="detail-link-row" data-i="${i}"><div class="detail-link-row-head"><a href="#" class="detail-link-open" data-type="${escapeHtml(type)}" data-id="${escapeHtml(id)}">${type === 'account' ? '👤 ' : ''}${escapeHtml(String(title).slice(0, 60))}</a><button type="button" class="btn-remove-att" data-i="${i}">×</button></div>${noteBlock}</li>`;
        }).join('')
      : '<p class="detail-links-section-label">Linked to (outgoing)</p><li class="muted">None</li>';
    const fromHtml = incomingLinks.length
      ? '<p class="detail-links-section-label">Linked from (incoming)</p>' + incomingLinks.map(({ type, id, title, note }) => {
          const noteBlock = note ? `<div class="detail-link-note"><span class="detail-link-note-label">Note:</span>${escapeHtml(note)}</div>` : '';
          return `<li class="detail-link-row"><div class="detail-link-row-head"><a href="#" class="detail-link-open" data-type="${escapeHtml(type)}" data-id="${escapeHtml(id)}">${type === 'account' ? '👤 ' : ''}${escapeHtml(String(title).slice(0, 60))}</a></div>${noteBlock}</li>`;
        }).join('')
      : '<p class="detail-links-section-label">Linked from (incoming)</p><li class="muted">None</li>';
    detailLinksListEl.innerHTML = outgoingHtml + fromHtml;
    detailLinksListEl.querySelectorAll('.btn-remove-att').forEach(btn => {
      btn.addEventListener('click', async () => {
        const i = parseInt(btn.dataset.i, 10);
        const next = [...linkList];
        next.splice(i, 1);
        await new Promise(r => chrome.runtime.sendMessage({ action: 'updateCapture', id: detailCaptureId, updates: { links: next } }, r));
        await load();
        openDetail(detailCaptureId, { preserveActiveTab: true });
      });
    });
    detailLinksListEl.querySelectorAll('.detail-link-open').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const type = a.dataset.type;
        const id = a.dataset.id;
        if (type === 'account') {
          const idx = accounts.findIndex(x => x.id === id);
          if (idx >= 0) { closeAccountModal(); openAccountModal(idx); }
        } else openDetail(id);
      });
    });
  }
  if (detailLinkTargetEl) {
    const othersCapture = captures.filter(x => x.id !== c.id && !linkedSet.has('capture:' + x.id));
    const othersAccount = accounts.filter(x => !linkedSet.has('account:' + x.id));
    const opts = '<option value="">— Select capture or account to link —</option>' +
      (othersCapture.length ? '<optgroup label="Captures">' + othersCapture.map(o => `<option value="capture:${escapeHtml(o.id)}">${escapeHtml((o.title || o.url || o.id).slice(0, 50))}</option>`).join('') + '</optgroup>' : '') +
      (othersAccount.length ? '<optgroup label="Accounts">' + othersAccount.map(o => `<option value="account:${escapeHtml(o.id)}">${escapeHtml((o.label || o.username || o.email || o.id).slice(0, 50))}</option>`).join('') + '</optgroup>' : '');
    detailLinkTargetEl.innerHTML = opts;
  }
  if (!preserveTab) {
    document.querySelectorAll('.detail-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('detailInfo').classList.add('active');
    document.querySelector('.detail-tab[data-detail-tab="info"]').classList.add('active');
  }
  detailModal.classList.remove('hidden');
}

detailClose.addEventListener('click', () => detailModal.classList.add('hidden'));
detailModal.querySelector('.modal-backdrop').addEventListener('click', () => detailModal.classList.add('hidden'));
document.getElementById('detailPageFullscreen')?.addEventListener('click', () => {
  const c = allCaptures.find(x => x.id === detailCaptureId);
  if (!c || !c.htmlContent) return;
  const baseTag = c.url ? `<base href="${escapeHtml(c.url).replace(/"/g, '&quot;')}" target="_blank">` : '';
  let doc = c.htmlContent;
  if (baseTag) {
    if (/<head[\s>]/i.test(doc)) doc = doc.replace(/(<head[\s>][^<]*)/i, '$1' + baseTag);
    else if (/<html[\s>]/i.test(doc)) doc = doc.replace(/(<html[\s>][^<]*)/i, '$1' + baseTag);
    else doc = baseTag + doc;
  }
  if (settings.hidePrivacyNoticesInRenderedView !== false) doc = injectPrivacyNoticeHidingCss(doc);
  const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  chrome.tabs.create({ url });
  setTimeout(() => URL.revokeObjectURL(url), 60000);
});
document.querySelectorAll('.detail-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.detailTab;
    document.querySelectorAll('.detail-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const panel = document.getElementById(tab === 'data' ? 'detailData' : tab === 'source' ? 'detailSource' : tab === 'notes' ? 'detailNotes' : tab === 'tech' ? 'detailTech' : tab === 'page' ? 'detailPage' : tab === 'links' ? 'detailLinks' : 'detailInfo');
    if (panel) panel.classList.add('active');
  });
});

function saveDetail() {
  if (!detailCaptureId) return;
  const notes = detailNotesInput.value.trim();
  const important = detailImportant.checked;
  chrome.runtime.sendMessage({ action: 'updateCapture', id: detailCaptureId, updates: { notes, important } }, () => {
    const c = allCaptures.find(x => x.id === detailCaptureId);
    if (c) {
      c.notes = notes;
      c.important = important;
    }
    setDashboardUnsavedChanges(false);
    renderCaptures();
    detailModal.classList.add('hidden');
  });
}
detailNotesInput.addEventListener('input', () => setDashboardUnsavedChanges(true));
detailImportant.addEventListener('change', () => setDashboardUnsavedChanges(true));
detailNotesInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); saveDetail(); } });
detailSave.addEventListener('click', saveDetail);

// Shift+Enter in any modal submits/saves (clicks the primary button). Skip when focus is in a textarea (it has its own handler).
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !e.shiftKey) return;
  if (e.target.tagName === 'TEXTAREA') return;
  const openModal = document.querySelector('.modal:not(.hidden)');
  if (!openModal) return;
  const primaryBtn = openModal.querySelector('.modal-actions .btn-primary');
  if (primaryBtn) {
    e.preventDefault();
    primaryBtn.click();
  }
});

document.getElementById('detailLinkAdd')?.addEventListener('click', async () => {
  const sel = document.getElementById('detailLinkTarget');
  const val = sel?.value;
  if (!val || !detailCaptureId) return;
  const [type, id] = val.indexOf(':') >= 0 ? val.split(':', 2) : ['capture', val];
  const c = allCaptures.find(x => x.id === detailCaptureId);
  const links = [...(c?.links || []), { type: type || 'capture', id, manual: true }];
  await new Promise(r => chrome.runtime.sendMessage({ action: 'updateCapture', id: detailCaptureId, updates: { links } }, r));
  await load();
  openDetail(detailCaptureId, { preserveActiveTab: true });
});

const linkNoteModalEl = document.getElementById('linkNoteModal');
const linkNoteInputEl = document.getElementById('linkNoteInput');
function addOneGraphLink(fromId, fromType, toId, toType, note) {
  const link = { type: toType || 'capture', id: toId, note: note || undefined, manual: true };
  if (fromType === 'account') {
    const acc = accounts.find(x => x.id === fromId);
    if (acc) {
      const next = [...accounts];
      const idx = next.findIndex(x => x.id === fromId);
      if (idx >= 0) {
        next[idx] = { ...next[idx], links: [...(next[idx].links || []), link] };
        return chrome.runtime.sendMessage({ action: 'setAccounts', caseId: currentCaseId, list: next });
      }
    }
  } else {
    const c = allCaptures.find(x => x.id === fromId);
    if (c) {
      const links = [...(c.links || []), link];
      return chrome.runtime.sendMessage({ action: 'updateCapture', id: fromId, updates: { links } });
    }
  }
}
document.getElementById('linkNoteSave')?.addEventListener('click', async () => {
  const pending = window._graphPendingLink;
  if (!pending) { linkNoteModalEl?.classList.add('hidden'); return; }
  const note = (linkNoteInputEl?.value || '').trim();
  if (pending.fromIdsAndTypes) {
    for (const { id: fromId, type: fromType } of pending.fromIdsAndTypes) {
      await addOneGraphLink(fromId, fromType, pending.toId, pending.toType, note);
    }
  } else {
    await addOneGraphLink(pending.fromId, pending.fromType, pending.toId, pending.toType, note);
  }
  window._graphPendingLink = null;
  linkNoteModalEl?.classList.add('hidden');
  load();
});
document.getElementById('linkNoteCancel')?.addEventListener('click', () => {
  window._graphPendingLink = null;
  linkNoteModalEl?.classList.add('hidden');
});
linkNoteModalEl?.querySelector('.modal-backdrop')?.addEventListener('click', () => {
  window._graphPendingLink = null;
  linkNoteModalEl.classList.add('hidden');
});

caseSelect.addEventListener('change', async () => {
  await chrome.runtime.sendMessage({ action: 'setCurrentCaseId', id: caseSelect.value });
  load();
});
function openNewCaseModal() {
  newCaseName.value = '';
  newCaseModal.classList.remove('hidden');
  newCaseName.focus();
}
function closeNewCaseModal() {
  newCaseModal.classList.add('hidden');
}
newCaseModal.querySelector('.modal-backdrop').addEventListener('click', closeNewCaseModal);
newCaseCancel.addEventListener('click', closeNewCaseModal);
newCaseOk.addEventListener('click', async () => {
  const name = newCaseName.value.trim();
  if (!name) return;
  const res = await chrome.runtime.sendMessage({ action: 'addCase', name });
  if (res && res.id) await chrome.runtime.sendMessage({ action: 'setCurrentCaseId', id: res.id });
  closeNewCaseModal();
  load();
});
newCaseName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') newCaseOk.click();
  if (e.key === 'Escape') { e.preventDefault(); closeNewCaseModal(); }
});
addCaseBtn.addEventListener('click', openNewCaseModal);

const addTagModalEl = document.getElementById('addTagModal');
const addTagNewInputEl = document.getElementById('addTagNewInput');
addTagModalEl?.addEventListener('click', (e) => e.stopPropagation());
document.getElementById('addTagConfirm').addEventListener('click', () => applyTagFromModal(addTagNewInputEl?.value?.trim()));
addTagNewInputEl?.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('addTagConfirm').click(); });
document.getElementById('addTagCancel').addEventListener('click', closeAddTagModal);
addTagModalEl?.querySelector('.modal-backdrop').addEventListener('click', closeAddTagModal);

function updateCaptureToggleStatus() {
  const statusEl = document.getElementById('captureToggleStatus');
  if (statusEl) statusEl.textContent = captureToggle.checked ? 'On' : 'Off';
}
captureToggle.addEventListener('change', async () => {
  const on = captureToggle.checked;
  updateCaptureToggleStatus();
  await chrome.runtime.sendMessage({ action: 'setSettings', settings: { captureEnabled: on, fullCapture: on } });
  load();
});

async function loadConfigForm() {
  configCaptureToggle.checked = settings.captureEnabled !== false;
  configSaveImages.checked = settings.saveImagesInReport !== false;
  const configInlineMedia = document.getElementById('configInlineMedia');
  if (configInlineMedia) configInlineMedia.checked = settings.inlineMediaOnCapture !== false;
  const configHidePrivacyNotices = document.getElementById('configHidePrivacyNotices');
  if (configHidePrivacyNotices) configHidePrivacyNotices.checked = settings.hidePrivacyNoticesInRenderedView !== false;
  const configTroubleshootLogEnabled = document.getElementById('configTroubleshootLogEnabled');
  if (configTroubleshootLogEnabled) configTroubleshootLogEnabled.checked = settings.troubleshootLogEnabled !== false;
  const theme = settings.theme || 'purple';
  if (theme.startsWith('#')) {
    configTheme.value = 'custom';
    if (configThemeColorPicker) configThemeColorPicker.value = theme;
  } else {
    configTheme.value = theme;
    if (configThemeColorPicker) configThemeColorPicker.value = themeToHex(theme);
  }
  const configAccentColor = document.getElementById('configAccentColor');
  const configTagColor = document.getElementById('configTagColor');
  if (configAccentColor) {
    configAccentColor.value = (settings.accentColor || themeToHex(theme)).replace(/^#?/, '#');
    configAccentColor.dataset.cleared = settings.accentColor ? '' : '1';
  }
  if (configTagColor) {
    configTagColor.value = (settings.tagColor || themeToHex(theme)).replace(/^#?/, '#');
    configTagColor.dataset.cleared = settings.tagColor ? '' : '1';
  }
  const configImportantNodeColor = document.getElementById('configImportantNodeColor');
  if (configImportantNodeColor) {
    configImportantNodeColor.value = (settings.importantNodeBorderColor || '#dc2626').replace(/^#?/, '#');
    const ib = (configImportantNodeColor.value || '#dc2626').replace(/^#?/, '#');
    document.body.style.setProperty('--important-node-border', ib);
  }
  const configGraphEdgeColor = document.getElementById('configGraphEdgeColor');
  const configGraphEdgeManualColor = document.getElementById('configGraphEdgeManualColor');
  const configGraphEdgePersonGroupColor = document.getElementById('configGraphEdgePersonGroupColor');
  const configGraphEdgeGroupGroupColor = document.getElementById('configGraphEdgeGroupGroupColor');
  const configGraphEdgeAccountPersonColor = document.getElementById('configGraphEdgeAccountPersonColor');
  if (configGraphEdgeColor) configGraphEdgeColor.value = (settings.graphEdgeColor || '#999999').replace(/^#?/, '#');
  if (configGraphEdgeManualColor) configGraphEdgeManualColor.value = (settings.graphEdgeManualColor || '#22c55e').replace(/^#?/, '#');
  if (configGraphEdgePersonGroupColor) configGraphEdgePersonGroupColor.value = (settings.graphEdgePersonGroupColor || '#2563eb').replace(/^#?/, '#');
  if (configGraphEdgeGroupGroupColor) configGraphEdgeGroupGroupColor.value = (settings.graphEdgeGroupGroupColor || '#7c3aed').replace(/^#?/, '#');
  if (configGraphEdgeAccountPersonColor) configGraphEdgeAccountPersonColor.value = (settings.graphEdgeAccountPersonColor || '#ea580c').replace(/^#?/, '#');
  const configGraphCanvasColor = document.getElementById('configGraphCanvasColor');
  if (configGraphCanvasColor) configGraphCanvasColor.value = (settings.graphCanvasColor || '#d3d3d3').replace(/^#?/, '#');
  const configGraphNodeGroupColor = document.getElementById('configGraphNodeGroupColor');
  const configGraphNodePersonColor = document.getElementById('configGraphNodePersonColor');
  const configGraphNodeAccountColor = document.getElementById('configGraphNodeAccountColor');
  if (configGraphNodeGroupColor) configGraphNodeGroupColor.value = (settings.graphNodeGroupColor || '#4c1d95').replace(/^#?/, '#');
  if (configGraphNodePersonColor) configGraphNodePersonColor.value = (settings.graphNodePersonColor || '#db2777').replace(/^#?/, '#');
  if (configGraphNodeAccountColor) configGraphNodeAccountColor.value = (settings.graphNodeAccountColor || '#fbcfe8').replace(/^#?/, '#');
  const configColorScheme = document.getElementById('configColorScheme');
  if (configColorScheme) configColorScheme.value = (settings.colorScheme === 'dark' ? 'dark' : 'light');
  configCaseSelect.innerHTML = cases.length
    ? cases.map(c => `<option value="${c.id}" ${c.id === currentCaseId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')
    : '<option value="">— No cases —</option>';
  const caseId = configCaseSelect.value || currentCaseId;
  const caseConfig = await new Promise(r => chrome.runtime.sendMessage({ action: 'getCaseConfig', caseId }, r));
  if (configIgnoreList) configIgnoreList.value = (caseConfig.blacklist || []).join('\n');
  selectors = Array.isArray(caseConfig.selectors) ? caseConfig.selectors : [];
  globalTagList = await new Promise(r => chrome.runtime.sendMessage({ action: 'getGlobalTags' }, r)) || [];
  renderConfigTagLibraryList();
  renderConfigSelectorsList();
  renderTroubleshootLog();
  if (configCaseSelect) configCaseSelect.dataset.prevCaseId = configCaseSelect.value || currentCaseId;
}

async function renderTroubleshootLog() {
  const listEl = document.getElementById('troubleshootLogList');
  if (!listEl) return;
  const log = await new Promise(r => chrome.runtime.sendMessage({ action: 'getTroubleshootLog' }, r)) || [];
  const rows = log.slice().reverse().map(entry => {
    const timeParts = formatTimeWithZoneParts(entry.time);
    const timeHtml = timeParts
      ? `<span class="troubleshoot-log-dt">${escapeHtml(timeParts.datetime)}</span><span class="troubleshoot-log-tz">${escapeHtml(timeParts.tz)}</span>`
      : '<span class="troubleshoot-log-dt">—</span>';
    let label = entry.type || 'event';
    let detail = '';
    if (entry.type === 'ignore_list_hit') {
      label = 'Ignore list';
      detail = `URL matched ignore list — not captured. ${entry.url || ''} (case: ${entry.caseId || '—'})`;
    } else if (entry.type === 'capture_skipped') {
      label = 'Skipped';
      detail = `Reason: ${entry.reason || '—'}. ${entry.url || ''} (case: ${entry.caseId || '—'})`;
    } else if (entry.type === 'capture_done') {
      label = 'Captured';
      detail = `${entry.url || ''} → id ${entry.id || '—'} (case: ${entry.caseId || '—'})`;
    } else if (entry.type === 'capture_failed') {
      label = 'Failed';
      detail = `${entry.url || ''}. ${entry.message || ''} (case: ${entry.caseId || '—'})`;
    } else {
      detail = JSON.stringify(entry);
    }
    return `<div class="troubleshoot-log-row" data-type="${escapeHtml(entry.type)}">
      <span class="troubleshoot-log-time">${timeHtml}</span>
      <span class="troubleshoot-log-type">${escapeHtml(label)}</span>
      <span class="troubleshoot-log-detail">${escapeHtml(detail)}</span>
    </div>`;
  });
  listEl.innerHTML = rows.length ? rows.join('') : '<p class="muted">No log entries yet. Navigate to pages or trigger captures to see ignore-list hits and capture events.</p>';
}

document.getElementById('troubleshootLogClear')?.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ action: 'clearTroubleshootLog' });
  renderTroubleshootLog();
});
document.getElementById('troubleshootLogRefresh')?.addEventListener('click', () => renderTroubleshootLog());

function renderConfigSelectorsList() {
  if (!configSelectorsList) return;
  configSelectorsList.innerHTML = selectors.map((sel, i) => `
    <div class="selector-row" data-i="${i}">
      <input type="text" class="selector-name input-custom" placeholder="Name" value="${escapeHtml(sel.name || '')}" />
      <input type="text" class="selector-pattern input-custom" placeholder="Pattern" value="${escapeHtml(sel.pattern || '')}" />
      <label class="selector-regex"><input type="checkbox" ${sel.useRegex ? 'checked' : ''} /> Regex</label>
      <button type="button" class="btn-remove-selector btn btn-secondary">Remove</button>
    </div>
  `).join('');
  configSelectorsList.querySelectorAll('.btn-remove-selector').forEach(btn => {
    btn.addEventListener('click', () => {
      selectors.splice(parseInt(btn.closest('.selector-row').dataset.i, 10), 1);
      renderConfigSelectorsList();
      setDashboardUnsavedChanges(true);
    });
  });
}

configAddSelector.addEventListener('click', () => {
  selectors.push({ id: Date.now(), name: '', pattern: '', useRegex: false });
  renderConfigSelectorsList();
  setDashboardUnsavedChanges(true);
});
const addTagToListModal = document.getElementById('addTagToListModal');
const addTagToListModalTitle = document.getElementById('addTagToListModalTitle');
const addTagToListPickerList = document.getElementById('addTagToListPickerList');
const addTagToListInput = document.getElementById('addTagToListInput');
const addTagToListConfirm = document.getElementById('addTagToListConfirm');
const addTagToListCancel = document.getElementById('addTagToListCancel');

function openAddTagToLibraryModal() {
  addTagToListModalTitle.textContent = 'Add to tag library';
  const existing = new Set(globalTagList || []);
  const suggested = DEFAULT_TAGS.filter(t => t && !existing.has(t));
  addTagToListPickerList.innerHTML = suggested.length
    ? suggested.map(t => `<button type="button" class="tag-picker-btn" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('')
    : '<p class="muted tag-picker-empty">All defaults already in library — type your own below</p>';
  addTagToListPickerList.querySelectorAll('.tag-picker-btn').forEach(btn => {
    btn.addEventListener('click', () => applyTagToLibraryAndClose(btn.dataset.tag));
  });
  addTagToListInput.value = '';
  addTagToListModal.classList.remove('hidden');
  addTagToListInput.focus();
}

function renderConfigTagLibraryList() {
  const configTagLibraryList = document.getElementById('configTagLibraryList');
  if (!configTagLibraryList) return;
  const list = globalTagList || [];
  configTagLibraryList.innerHTML = list.map((tag, i) => `
    <div class="tag-list-row" data-i="${i}">
      <span class="tag">${escapeHtml(tag)}</span>
      <button type="button" class="btn-remove-config-tag btn btn-secondary">×</button>
    </div>
  `).join('');
  configTagLibraryList.querySelectorAll('.btn-remove-config-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.closest('.tag-list-row').dataset.i, 10);
      globalTagList.splice(i, 1);
      renderConfigTagLibraryList();
      setDashboardUnsavedChanges(true);
    });
  });
}

function closeAddTagToListModal() {
  addTagToListModal.classList.add('hidden');
}

function applyTagToLibraryAndClose(tag) {
  const t = (typeof tag === 'string' ? tag : (addTagToListInput?.value || '').trim()).trim();
  if (!t) return;
  globalTagList = [...(globalTagList || []), t];
  renderConfigTagLibraryList();
  setDashboardUnsavedChanges(true);
  closeAddTagToListModal();
}

addTagToListConfirm?.addEventListener('click', () => applyTagToLibraryAndClose(addTagToListInput?.value?.trim()));
addTagToListInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTagToListConfirm?.click(); });
addTagToListCancel?.addEventListener('click', closeAddTagToListModal);
addTagToListModal?.querySelector('.modal-backdrop')?.addEventListener('click', closeAddTagToListModal);

document.getElementById('configAddToLibrary')?.addEventListener('click', openAddTagToLibraryModal);
configCaseSelect.addEventListener('change', () => {
  const newCaseId = configCaseSelect.value;
  const prevCaseId = configCaseSelect.dataset.prevCaseId ?? currentCaseId;
  if (dashboardHasUnsavedChanges && newCaseId !== prevCaseId) {
    showConfirmModal('Unsaved changes', 'You have unsaved changes. Switch case without saving?')
      .then(leave => {
        if (leave) {
          setDashboardUnsavedChanges(false);
          loadConfigForm();
        } else {
          configCaseSelect.value = prevCaseId;
        }
      });
    return;
  }
  loadConfigForm();
});
// Important node color is applied only on Save or when loading the config form
document.getElementById('configSaveBtn')?.addEventListener('click', async () => {
  await saveConfigToStorage();
  setDashboardUnsavedChanges(false);
  showMessageModal('Configuration saved', 'All settings have been saved and applied.');
});
document.getElementById('configCancelBtn')?.addEventListener('click', async () => {
  await loadConfigForm();
  setDashboardUnsavedChanges(false);
  // Re-apply saved theme so UI matches storage
  const theme = settings.theme || 'purple';
  applyDashboardTheme(theme, { accentColor: settings.accentColor || '', tagColor: settings.tagColor || '' });
  setGraphNodeColorVariables();
  applyColorSchemeAndCanvas(settings.colorScheme || 'light', settings.graphCanvasColor || '#d3d3d3');
  const ib = (settings.importantNodeBorderColor || '#dc2626').replace(/^#?/, '#');
  document.body.style.setProperty('--important-node-border', ib);
  if (document.getElementById('panel-graph')?.classList.contains('active')) renderGraph();
  showMessageModal('Cancelled', 'Unsaved changes discarded. Form reloaded from storage.');
});
const APPEARANCE_CONFIG_IDS = [
  'configTheme', 'configThemeColorPicker', 'configAccentColor', 'configTagColor',
  'configImportantNodeColor', 'configGraphEdgeColor', 'configGraphEdgeManualColor',
  'configGraphEdgePersonGroupColor', 'configGraphEdgeGroupGroupColor', 'configGraphEdgeAccountPersonColor',
  'configGraphCanvasColor', 'configGraphNodeGroupColor', 'configGraphNodePersonColor', 'configGraphNodeAccountColor',
  'configColorScheme',
];
const configPanel = document.getElementById('panel-config');
if (configPanel) {
  configPanel.addEventListener('input', (e) => {
    setDashboardUnsavedChanges(true);
    if (e.target && e.target.id && APPEARANCE_CONFIG_IDS.includes(e.target.id)) previewAppearanceFromConfigForm();
  });
  configPanel.addEventListener('change', (e) => {
    setDashboardUnsavedChanges(true);
    if (e.target && e.target.id && APPEARANCE_CONFIG_IDS.includes(e.target.id)) previewAppearanceFromConfigForm();
  });
}
window.addEventListener('beforeunload', (e) => {
  if (dashboardHasUnsavedChanges) { e.preventDefault(); e.returnValue = ''; }
});
configAddCase.addEventListener('click', openNewCaseModal);

document.getElementById('configRenameCase')?.addEventListener('click', async () => {
  const cid = configCaseSelect.value || currentCaseId;
  if (!cid || cid === 'default') { showMessageModal('Rename', 'Select a case to rename (Default case cannot be renamed).'); return; }
  const c = cases.find(x => x.id === cid);
  const name = window.prompt('New name for this case:', c?.name || '');
  if (name == null || !String(name).trim()) return;
  try {
    const res = await chrome.runtime.sendMessage({ action: 'updateCase', caseId: cid, name: String(name).trim() });
    if (res?.error) showMessageModal('Error', res.error);
    else { cases = res.cases || cases; load(); loadConfigForm(); showMessageModal('Saved', 'Case renamed.'); }
  } catch (e) {
    showMessageModal('Error', e?.message || 'Failed to rename case.');
  }
});

document.getElementById('configDeleteCase')?.addEventListener('click', async () => {
  const cid = configCaseSelect.value || currentCaseId;
  if (!cid) { showMessageModal('Delete', 'Select a case to delete.'); return; }
  const c = cases.find(x => x.id === cid);
  const ok = await showConfirmModal('Delete case', `Delete "${c?.name || cid}"? All its data (captures, accounts, settings) will be permanently deleted.`);
  if (!ok) return;
  try {
    const res = await chrome.runtime.sendMessage({ action: 'deleteCase', caseId: cid });
    if (res?.error) showMessageModal('Error', res.error);
    else {
      cases = res.cases || cases;
      currentCaseId = cases.length ? cases[0].id : '';
      load();
      loadConfigForm();
      showMessageModal('Done', cases.length ? 'Case deleted.' : 'All cases deleted. Create a new case to get started.');
    }
  } catch (e) {
    showMessageModal('Error', e?.message || 'Failed to delete case.');
  }
});

function getThemeOverrides() {
  const configAccentColor = document.getElementById('configAccentColor');
  const configTagColor = document.getElementById('configTagColor');
  const theme = configTheme.value === 'custom' ? configThemeColorPicker.value : configTheme.value;
  const baseHex = theme.startsWith('#') ? theme : themeToHex(theme);
  return {
    accentColor: configAccentColor && configAccentColor.dataset.cleared ? '' : (configAccentColor?.value || ''),
    tagColor: configTagColor && configTagColor.dataset.cleared ? '' : (configTagColor?.value || ''),
  };
}
if (configThemeColorPicker) {
  configTheme.addEventListener('change', () => {
    const v = configTheme.value;
    if (v !== 'custom') configThemeColorPicker.value = themeToHex(v);
  });
  configThemeColorPicker.addEventListener('input', () => {
    configTheme.value = 'custom';
  });
}
document.getElementById('configAccentColorClear')?.addEventListener('click', () => {
  const el = document.getElementById('configAccentColor');
  if (!el) return;
  el.dataset.cleared = '1';
  el.value = themeToHex(configTheme.value === 'custom' ? configThemeColorPicker.value : configTheme.value);
});
document.getElementById('configTagColorClear')?.addEventListener('click', () => {
  const el = document.getElementById('configTagColor');
  if (!el) return;
  el.dataset.cleared = '1';
  el.value = themeToHex(configTheme.value === 'custom' ? configThemeColorPicker.value : configTheme.value);
});
document.getElementById('configAccentColor')?.addEventListener('input', () => {
  document.getElementById('configAccentColor').dataset.cleared = '';
});
document.getElementById('configTagColor')?.addEventListener('input', () => {
  document.getElementById('configTagColor').dataset.cleared = '';
});
function applyPastedThemeFromInput() {
  const configThemePaste = document.getElementById('configThemePaste');
  if (!configThemePaste) return;
  const raw = (configThemePaste.value || '').trim();
  if (!raw) return;
  const hexes = raw.split(/[\s,]+/).map(s => {
    let h = s.trim();
    if (!h) return '';
    if (!h.startsWith('#')) h = '#' + h;
    return /^#[0-9A-Fa-f]{6}$/.test(h) ? h : '';
  }).filter(Boolean);
  if (hexes.length === 0) return;
  configTheme.value = 'custom';
  if (configThemeColorPicker) configThemeColorPicker.value = hexes[0];
  const configAccentColor = document.getElementById('configAccentColor');
  if (configAccentColor) { configAccentColor.value = hexes[0]; configAccentColor.dataset.cleared = ''; }
  if (hexes.length >= 2) {
    const configTagColor = document.getElementById('configTagColor');
    if (configTagColor) { configTagColor.value = hexes[1]; configTagColor.dataset.cleared = ''; }
  }
  if (hexes.length >= 3) {
    const el = document.getElementById('configImportantNodeColor');
    if (el) el.value = hexes[2];
  }
  if (hexes.length >= 4) {
    const el = document.getElementById('configGraphEdgeColor');
    if (el) el.value = hexes[3];
  }
  if (hexes.length >= 5) {
    const el = document.getElementById('configGraphEdgeManualColor');
    if (el) el.value = hexes[4];
  }
  configThemePaste.value = '';
  previewAppearanceFromConfigForm();
}
const configThemePaste = document.getElementById('configThemePaste');
const configThemePasteApply = document.getElementById('configThemePasteApply');
const configThemeResetDefaults = document.getElementById('configThemeResetDefaults');
if (configThemePaste) configThemePaste.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyPastedThemeFromInput(); } });
if (configThemePasteApply) configThemePasteApply.addEventListener('click', applyPastedThemeFromInput);
if (configThemeResetDefaults) {
  configThemeResetDefaults.addEventListener('click', () => {
    const theme = 'purple';
    const hex = themeToHex(theme);
    configTheme.value = theme;
    if (configThemeColorPicker) configThemeColorPicker.value = hex;
    const configAccentColor = document.getElementById('configAccentColor');
    if (configAccentColor) { configAccentColor.value = hex; configAccentColor.dataset.cleared = '1'; }
    const configTagColor = document.getElementById('configTagColor');
    if (configTagColor) { configTagColor.value = hex; configTagColor.dataset.cleared = '1'; }
    const colorIds = ['configImportantNodeColor', 'configGraphEdgeColor', 'configGraphEdgeManualColor', 'configGraphEdgePersonGroupColor', 'configGraphEdgeGroupGroupColor', 'configGraphEdgeAccountPersonColor', 'configGraphCanvasColor', 'configGraphNodeGroupColor', 'configGraphNodePersonColor', 'configGraphNodeAccountColor'];
    const colorDefaults = ['#dc2626', '#999999', '#22c55e', '#2563eb', '#7c3aed', '#ea580c', '#d3d3d3', '#4c1d95', '#db2777', '#fbcfe8'];
    colorIds.forEach((id, i) => { const el = document.getElementById(id); if (el) el.value = colorDefaults[i]; });
    const configColorScheme = document.getElementById('configColorScheme');
    if (configColorScheme) configColorScheme.value = 'light';
    settings = {
      ...settings,
      theme,
      accentColor: '',
      tagColor: '',
      importantNodeBorderColor: '#dc2626',
      graphEdgeColor: '#999999',
      graphEdgeManualColor: '#22c55e',
      graphEdgePersonGroupColor: '#2563eb',
      graphEdgeGroupGroupColor: '#7c3aed',
      graphEdgeAccountPersonColor: '#ea580c',
      graphCanvasColor: '#d3d3d3',
      graphNodeGroupColor: '#4c1d95',
      graphNodePersonColor: '#db2777',
      graphNodeAccountColor: '#fbcfe8',
      colorScheme: 'light',
    };
    applyDashboardTheme(theme, getThemeOverrides());
    applyColorSchemeAndCanvas('light', '#d3d3d3');
    setGraphNodeColorVariables();
    updateColorSchemeToggleLabel();
    const importantEl = document.getElementById('configImportantNodeColor');
    if (importantEl) document.body.style.setProperty('--important-node-border', (importantEl.value || '#dc2626').replace(/^#?/, '#'));
    if (document.getElementById('panel-graph')?.classList.contains('active')) renderGraph();
  });
}

async function saveConfigToStorage(overrideCaseId) {
  if (Array.isArray(globalTagList)) {
    await chrome.runtime.sendMessage({ action: 'setGlobalTags', tags: globalTagList });
  }
  const ignoreList = (configIgnoreList && configIgnoreList.value) ? configIgnoreList.value.split('\n').map(s => s.trim()).filter(Boolean) : [];
  const theme = configTheme.value === 'custom' ? configThemeColorPicker.value : configTheme.value;
  const overrides = getThemeOverrides();
  const newSelectors = [];
  configSelectorsList.querySelectorAll('.selector-row').forEach(row => {
    const pattern = (row.querySelector('.selector-pattern')?.value || '').trim();
    if (!pattern) return;
    newSelectors.push({
      id: Date.now() + Math.random(),
      name: (row.querySelector('.selector-name')?.value || '').trim(),
      pattern,
      useRegex: row.querySelector('.selector-regex input')?.checked || false,
    });
  });
  const inlineMediaInput = document.getElementById('configInlineMedia');
  const configHidePrivacyNotices = document.getElementById('configHidePrivacyNotices');
  const configImportantNodeColor = document.getElementById('configImportantNodeColor');
  const configGraphEdgeColor = document.getElementById('configGraphEdgeColor');
  const configGraphEdgeManualColor = document.getElementById('configGraphEdgeManualColor');
  const configGraphEdgePersonGroupColor = document.getElementById('configGraphEdgePersonGroupColor');
  const configGraphEdgeGroupGroupColor = document.getElementById('configGraphEdgeGroupGroupColor');
  const configGraphEdgeAccountPersonColor = document.getElementById('configGraphEdgeAccountPersonColor');
  const importantNodeBorderColor = (configImportantNodeColor && configImportantNodeColor.value) ? configImportantNodeColor.value : '#dc2626';
  const graphEdgeColor = (configGraphEdgeColor && configGraphEdgeColor.value) ? configGraphEdgeColor.value.replace(/^#?/, '#') : '#999999';
  const graphEdgeManualColor = (configGraphEdgeManualColor && configGraphEdgeManualColor.value) ? configGraphEdgeManualColor.value.replace(/^#?/, '#') : '#22c55e';
  const graphEdgePersonGroupColor = (configGraphEdgePersonGroupColor && configGraphEdgePersonGroupColor.value) ? configGraphEdgePersonGroupColor.value.replace(/^#?/, '#') : '#2563eb';
  const graphEdgeGroupGroupColor = (configGraphEdgeGroupGroupColor && configGraphEdgeGroupGroupColor.value) ? configGraphEdgeGroupGroupColor.value.replace(/^#?/, '#') : '#7c3aed';
  const graphEdgeAccountPersonColor = (configGraphEdgeAccountPersonColor && configGraphEdgeAccountPersonColor.value) ? configGraphEdgeAccountPersonColor.value.replace(/^#?/, '#') : '#ea580c';
  const configGraphCanvasColor = document.getElementById('configGraphCanvasColor');
  const graphCanvasColor = (configGraphCanvasColor && configGraphCanvasColor.value) ? configGraphCanvasColor.value.replace(/^#?/, '#') : '#d3d3d3';
  const configGraphNodeGroupColor = document.getElementById('configGraphNodeGroupColor');
  const configGraphNodePersonColor = document.getElementById('configGraphNodePersonColor');
  const configGraphNodeAccountColor = document.getElementById('configGraphNodeAccountColor');
  const graphNodeGroupColor = (configGraphNodeGroupColor && configGraphNodeGroupColor.value) ? configGraphNodeGroupColor.value.replace(/^#?/, '#') : '#4c1d95';
  const graphNodePersonColor = (configGraphNodePersonColor && configGraphNodePersonColor.value) ? configGraphNodePersonColor.value.replace(/^#?/, '#') : '#db2777';
  const graphNodeAccountColor = (configGraphNodeAccountColor && configGraphNodeAccountColor.value) ? configGraphNodeAccountColor.value.replace(/^#?/, '#') : '#fbcfe8';
  const configColorScheme = document.getElementById('configColorScheme');
  const colorScheme = (configColorScheme && configColorScheme.value === 'dark') ? 'dark' : 'light';
  await chrome.runtime.sendMessage({ action: 'setSettings', settings: {
    captureEnabled: configCaptureToggle.checked,
    fullCapture: configCaptureToggle.checked,
    saveImagesInReport: configSaveImages.checked,
    theme,
    accentColor: overrides.accentColor || '',
    tagColor: overrides.tagColor || '',
    inlineMediaOnCapture: inlineMediaInput ? inlineMediaInput.checked : false,
    hidePrivacyNoticesInRenderedView: configHidePrivacyNotices ? configHidePrivacyNotices.checked : true,
    troubleshootLogEnabled: document.getElementById('configTroubleshootLogEnabled')?.checked !== false,
    importantNodeBorderColor: importantNodeBorderColor.replace(/^#?/, '#'),
    graphEdgeColor,
    graphEdgeManualColor,
    graphEdgePersonGroupColor,
    graphEdgeGroupGroupColor,
    graphEdgeAccountPersonColor,
    graphCanvasColor,
    graphNodeGroupColor,
    graphNodePersonColor,
    graphNodeAccountColor,
    colorScheme,
  } });
  const cid = overrideCaseId != null ? overrideCaseId : (configCaseSelect.value || currentCaseId);
  await chrome.runtime.sendMessage({ action: 'setCaseConfig', caseId: cid, config: { blacklist: ignoreList, selectors: newSelectors, tags: [] } });
  selectors = newSelectors;
  settings = { ...settings, theme, accentColor: overrides.accentColor, tagColor: overrides.tagColor, graphEdgeColor, graphEdgeManualColor, graphCanvasColor, graphNodeGroupColor, graphNodePersonColor, graphNodeAccountColor, colorScheme };
  applyDashboardTheme(theme, overrides);
  applyColorSchemeAndCanvas(colorScheme, graphCanvasColor);
  setGraphNodeColorVariables();
  updateColorSchemeToggleLabel();
  if (document.getElementById('panel-graph')?.classList.contains('active')) renderGraph();
}

async function getHighlightTargetTab() {
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  const dashboardTab = tabs.find(t => t.url === dashboardUrl);
  return tabs.find(t => t.id !== dashboardTab?.id);
}
function setDashboardHighlightButtonState(on) {
  const btn = document.getElementById('highlightOnPage');
  if (!btn) return;
  btn.dataset.highlightState = on ? 'on' : 'off';
  btn.textContent = on ? 'Highlight: On' : 'Highlight: Off';
  btn.classList.toggle('highlight-on', on);
}
const HIGHLIGHT_TAB_KEY = 'shuck_highlight_tab_id';
async function updateDashboardHighlightButton() {
  let target = null;
  if (chrome.storage?.session) {
    const { [HIGHLIGHT_TAB_KEY]: storedId } = await chrome.storage.session.get(HIGHLIGHT_TAB_KEY);
    if (storedId) {
      try {
        target = await chrome.tabs.get(storedId);
      } catch (_) {
        await chrome.storage.session.remove(HIGHLIGHT_TAB_KEY);
      }
    }
  }
  if (!target) target = await getHighlightTargetTab();
  if (!target) { setDashboardHighlightButtonState(false); return; }
  try {
    const res = await chrome.tabs.sendMessage(target.id, { action: 'getHighlightState' });
    setDashboardHighlightButtonState(res && res.enabled);
  } catch (_) {
    setDashboardHighlightButtonState(false);
  }
}
document.getElementById('highlightOnPage').addEventListener('click', async (e) => {
  e.preventDefault();
  const list = await new Promise(r => chrome.runtime.sendMessage({ action: 'getSelectors', caseId: currentCaseId }, r));
  if (!list?.length) { showMessageModal('Highlight', 'Add at least one selector in Configuration first.'); return; }
  const target = await getHighlightTargetTab();
  if (!target) { showMessageModal('Highlight', 'Open the page you want to highlight in another tab, then try again.'); return; }
  const btn = document.getElementById('highlightOnPage');
  const isOn = btn && btn.dataset.highlightState === 'on';
  if (isOn) {
    try {
      await chrome.tabs.sendMessage(target.id, { action: 'highlightOff' });
    } catch (_) {}
    if (chrome.storage?.session) await chrome.storage.session.remove(HIGHLIGHT_TAB_KEY);
    setDashboardHighlightButtonState(false);
    return;
  }
  try {
    await chrome.tabs.sendMessage(target.id, { action: 'highlightOnPage', selectors: list });
    if (chrome.storage?.session) await chrome.storage.session.set({ [HIGHLIGHT_TAB_KEY]: target.id });
    setDashboardHighlightButtonState(true);
  } catch (err) {
    chrome.scripting.executeScript({ target: { tabId: target.id }, files: ['content.js'] }).then(() =>
      chrome.tabs.sendMessage(target.id, { action: 'highlightOnPage', selectors: list })
    ).then(async () => {
      if (chrome.storage?.session) await chrome.storage.session.set({ [HIGHLIGHT_TAB_KEY]: target.id });
      setDashboardHighlightButtonState(true);
    }).catch(() => showMessageModal('Highlight', 'Reload the target page and try again.'));
  }
});

todoLoadTemplate.addEventListener('click', async () => {
  const replace = !todoItems.length || await showConfirmModal('Load OSINT template', 'Replace current list with OSINT template? (Cancel = append)');
  if (replace) todoItems = [];
  OSINT_TEMPLATE.forEach(({ section, items }) => {
    items.forEach(text => todoItems.push({ text, done: false, section }));
  });
  saveTodoList();
  renderTodo();
});
todoAddBtn.addEventListener('click', () => {
  const text = (todoInput?.value || '').trim();
  if (!text) return;
  const section = (todoSectionSelect && todoSectionSelect.value) || '';
  todoItems.push({ text, done: false, section: section || undefined });
  saveTodoList();
  renderTodo();
  todoInput.value = '';
});
todoInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); todoAddBtn.click(); } });

importBtn.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const text = await f.text();
  let data;
  try { data = JSON.parse(text); } catch (_) { showMessageModal('Import', 'Invalid JSON'); importFile.value = ''; return; }
  const isFullCaseExport = data.caseId != null && (data.caseName != null || data.caseConfig != null || Array.isArray(data.todoItems) || Array.isArray(data.accounts) || Array.isArray(data.people) || Array.isArray(data.groups));
  let merge = false;
  let forceNewCase = false;
  if (isFullCaseExport) {
    const caseExists = data.caseId != null && cases.some(c => c.id === data.caseId);
    if (caseExists) {
      const choice = await showImportDuplicateModal('Import', 'A case with the same ID already exists. Merge into it, cancel the import, or create a new case from this import?');
      if (choice === 'cancel') { importFile.value = ''; return; }
      if (choice === 'newCase') forceNewCase = true;
      else merge = true;
    }
  } else {
    const caseCaptures = (await getLocalCaptures()).captures?.filter(c => (c.caseId || 'default') === currentCaseId) || [];
    if (caseCaptures.length > 0) {
      merge = await showConfirmModal('Import', 'Merge captures with current case? (Cancel = replace current case captures)');
    }
  }
  if (isFullCaseExport) {
    const res = await chrome.runtime.sendMessage({ action: 'importFullCase', payload: data, merge, forceNewCase });
    if (res && res.error) { showMessageModal('Import failed', res.error); importFile.value = ''; return; }
    const importedCaseId = (res && res.caseId) ? res.caseId : data.caseId;
    if (data.graphFilters && Array.isArray(data.graphFilters)) {
      const existing = await chrome.storage.local.get(GRAPH_FILTERS_STORAGE_KEY);
      const list = existing[GRAPH_FILTERS_STORAGE_KEY] || [];
      const maxId = list.reduce((m, x) => { const n = parseInt(String(x.id).replace(/\D/g, ''), 10) || 0; return Math.max(m, n); }, 0);
      const merged = merge ? [...list] : [];
      data.graphFilters.forEach((gf, i) => { merged.push({ id: 'f' + (maxId + 1 + i), name: gf.name || 'Imported', filter: gf.filter || {} }); });
      await chrome.storage.local.set({ [GRAPH_FILTERS_STORAGE_KEY]: merged });
    }
    if (data.settings && typeof data.settings === 'object') {
      await chrome.runtime.sendMessage({ action: 'setSettings', settings: data.settings });
      settings = { ...settings, ...data.settings };
    }
    if (data.config && typeof data.config === 'object' && data.config.captureSortOrder != null) {
      await chrome.runtime.sendMessage({ action: 'setSettings', settings: { captureSortOrder: data.config.captureSortOrder } });
      settings = { ...settings, captureSortOrder: data.config.captureSortOrder };
    }
    await chrome.runtime.sendMessage({ action: 'setCurrentCaseId', id: importedCaseId });
  } else {
    const payload = data.captures ? { captures: data.captures, nextId: data.nextId || data.captures.length + 1 } : { captures: [], nextId: 1 };
    await chrome.runtime.sendMessage({ action: 'importData', data: payload, merge });
    if (data.graphFilters && Array.isArray(data.graphFilters)) {
      if (merge) {
        const existing = await chrome.storage.local.get(GRAPH_FILTERS_STORAGE_KEY);
        const list = existing[GRAPH_FILTERS_STORAGE_KEY] || [];
        const maxId = list.reduce((m, x) => { const n = parseInt(String(x.id).replace(/\D/g, ''), 10) || 0; return Math.max(m, n); }, 0);
        const merged = [...list];
        data.graphFilters.forEach((gf, i) => { merged.push({ id: 'f' + (maxId + 1 + i), name: gf.name || 'Imported', filter: gf.filter || {} }); });
        await chrome.storage.local.set({ [GRAPH_FILTERS_STORAGE_KEY]: merged });
      } else {
        await chrome.storage.local.set({ [GRAPH_FILTERS_STORAGE_KEY]: data.graphFilters });
      }
    }
    if (data.settings && typeof data.settings === 'object') {
      await chrome.runtime.sendMessage({ action: 'setSettings', settings: data.settings });
      settings = { ...settings, ...data.settings };
    }
    if (data.config && typeof data.config === 'object' && data.config.captureSortOrder != null) {
      await chrome.runtime.sendMessage({ action: 'setSettings', settings: { captureSortOrder: data.config.captureSortOrder } });
      settings = { ...settings, captureSortOrder: data.config.captureSortOrder };
    }
  }
  importFile.value = '';
  load();
});

function getGraphSvgDataUrl(options = {}) {
  const svg = document.getElementById('graphSvg');
  const container = document.getElementById('graphContainer');
  if (!svg || !svg.innerHTML.trim()) return null;
  const bounds = container?.graphExportBounds;
  const pad = 80;
  const forWord = !!options.forWord;
  const exportW = forWord ? 600 : 1000;
  const exportH = forWord ? 450 : 700;
  try {
    let clone;
    if (bounds && (bounds.maxX > bounds.minX || bounds.maxY > bounds.minY)) {
      const rangeX = Math.max(bounds.maxX - bounds.minX, 1);
      const rangeY = Math.max(bounds.maxY - bounds.minY, 1);
      const scale = Math.min((exportW - 2 * pad) / rangeX, (exportH - 2 * pad) / rangeY);
      const savedT = graphViewTransform;
      const savedPan = { x: graphPan.x, y: graphPan.y };
      const savedZoom = graphZoom;
      graphViewTransform = { minX: bounds.minX, minY: bounds.minY, scale };
      graphPan.x = 0;
      graphPan.y = 0;
      graphZoom = 1;
      renderGraph({ skipTransformUpdate: true });
      clone = svg.cloneNode(true);
      graphViewTransform = savedT;
      graphPan.x = savedPan.x;
      graphPan.y = savedPan.y;
      graphZoom = savedZoom;
      renderGraph({ skipTransformUpdate: true });
    } else {
      clone = svg.cloneNode(true);
    }
    const vb = clone.viewBox && clone.viewBox.baseVal;
    const w = vb && vb.width ? vb.width : exportW;
    const h = vb && vb.height ? vb.height : exportH;
    clone.setAttribute('width', w);
    clone.setAttribute('height', h);
    if (!clone.getAttribute('viewBox') && vb) clone.setAttribute('viewBox', `0 0 ${vb.width} ${vb.height}`);
    const bg = clone.querySelector('.graph-bg');
    const canvasColor = (settings && settings.graphCanvasColor) ? String(settings.graphCanvasColor).replace(/^#?/, '#') : '#d3d3d3';
    if (bg) bg.setAttribute('fill', canvasColor);
    clone.style.setProperty('--graph-node-group-bg', (settings && settings.graphNodeGroupColor) ? String(settings.graphNodeGroupColor).replace(/^#?/, '#') : '#4c1d95');
    clone.style.setProperty('--graph-node-person-bg', (settings && settings.graphNodePersonColor) ? String(settings.graphNodePersonColor).replace(/^#?/, '#') : '#db2777');
    clone.style.setProperty('--graph-node-account-bg', (settings && settings.graphNodeAccountColor) ? String(settings.graphNodeAccountColor).replace(/^#?/, '#') : '#fbcfe8');
    const str = new XMLSerializer().serializeToString(clone);
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(str)));
  } catch (_) { return null; }
}

/** All captures and image-only items for current case, sorted chronologically (oldest first). */
function getChronologicalReportItems() {
  const list = [...captures];
  const ta = (c) => (c.timestamp ? new Date(c.timestamp).getTime() : 0);
  list.sort((a, b) => ta(a) - ta(b));
  return list;
}

/** Human-readable content type for report (Page capture vs Screenshot / Image). */
function getReportContentTypeLabel(c) {
  if (isImageOnlyCapture(c)) {
    return c.captureSource === 'annotation' ? 'Image (annotation)' : 'Screenshot';
  }
  return 'Page capture';
}

function buildReportHtml(includeScreenshots, options = {}) {
  const forWord = !!options.forWord;
  const chronological = getChronologicalReportItems();
  const blocks = chronological.map(c => {
    const dateTime = escapeHtml(formatTimestampFull(c.timestamp));
    const page = c.url ? (forWord ? escapeHtml(c.title || c.url) : `<a href="${escapeHtml(c.url)}">${escapeHtml(c.title || c.url)}</a>`) : escapeHtml(c.title || '');
    const pageUrl = forWord ? (c.url ? `\nURL: ${escapeHtml(c.url)}` : '') : '';
    const hash = escapeHtml((c.contentHash || '').slice(0, 16));
    const tagsPlain = (c.tags || []).length ? (c.tags || []).map(t => escapeHtml(t)).join(', ') : '—';
    const tags = forWord ? tagsPlain : ((c.tags || []).length ? (c.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join(' ') : '—');
    const notes = escapeHtml((c.notes || '').slice(0, 2000)) || '—';
    const techPlain = (c.technologies || []).length ? (c.technologies || []).map(t => escapeHtml(t)).join(', ') : '—';
    const tech = forWord ? techPlain : ((c.technologies || []).length ? (c.technologies || []).map(t => `<span class="tech-pill">${escapeHtml(t)}</span>`).join(' ') : '—');
    const headersStr = c.serverHeaders && Object.keys(c.serverHeaders).length ? Object.entries(c.serverHeaders).map(([k, v]) => `${k}: ${v}`).join('; ') : '—';
    const contentTypeLabel = getReportContentTypeLabel(c);
    const screenshot = (includeScreenshots && c.imageDataUrl)
      ? `<div class="report-screenshot-wrap"><img src="${c.imageDataUrl}" alt="${escapeHtml(contentTypeLabel)}" class="report-screenshot"/></div>`
      : '<p class="report-no-screenshot">—</p>';
    const typeLabel = `<p><strong>Content type:</strong> ${escapeHtml(contentTypeLabel)}</p>`;
    const hashRow = forWord ? '' : `<p><strong>Hash:</strong> <code>${hash}</code></p>`;
    const hashRowPlain = forWord && (c.contentHash || '') ? `<p><strong>Hash:</strong> ${hash}</p>` : '';
    return `<section class="report-capture-block">
${typeLabel}
<p><strong>Date &amp; Time:</strong> ${dateTime}</p>
<p><strong>Page:</strong> ${page}${pageUrl}</p>
${hashRow}${hashRowPlain}
<p><strong>Tags:</strong> ${tags}</p>
<p><strong>Notes:</strong> ${notes}</p>
<p><strong>Technologies:</strong> ${tech}</p>
<p><strong>Server Headers:</strong> <small>${escapeHtml(headersStr.slice(0, 300))}</small></p>
<p><strong>${escapeHtml(contentTypeLabel)}:</strong></p>
${screenshot}
</section>`;
  }).join('');
  const byTag = {};
  captures.forEach(c => { (c.tags || []).forEach(t => { byTag[t] = (byTag[t] || 0) + 1; }); });
  const tagEntries = Object.entries(byTag).sort((a, b) => b[1] - a[1]);
  const statsBlock = `
<h2>Stats</h2>
<div class="report-stats-cards">
  <span class="report-stat">Captures: ${captures.length}</span>
  <span class="report-stat">Tags used: ${tagEntries.length}</span>
  <span class="report-stat">Accounts: ${accounts.length}</span>
  <span class="report-stat">People: ${people.length}</span>
  <span class="report-stat">Groups: ${groups.length}</span>
</div>
${tagEntries.length ? '<p><strong>By tag:</strong> ' + tagEntries.map(([t, n]) => escapeHtml(t) + ' (' + n + ')').join(', ') + '</p>' : ''}`;
  const accountsRows = (accounts || []).map(a => {
    const label = escapeHtml((a.label || a.username || a.email || 'Account').slice(0, 80));
    const username = (a.username || '') ? escapeHtml(String(a.username).slice(0, 80)) : '—';
    const email = (a.email || '') ? escapeHtml(String(a.email).slice(0, 80)) : '—';
    const sites = (a.sites || []).length ? escapeHtml((a.sites || []).join(', ').slice(0, 120)) : '—';
    const personCell = (a.personId && people) ? escapeHtml((people.find(p => p.id === a.personId)?.name || a.personId).slice(0, 60)) : '—';
    const pass = (a.password && a.password.length) ? '••••••••' : '—';
    const tags = (a.tags || []).length ? (a.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join(' ') : '—';
    return `<tr><td>${label}</td><td>${username}</td><td>${email}</td><td>${sites}</td><td>${personCell}</td><td>${pass}</td><td>${tags}</td></tr>`;
  }).join('');
  const accountsBlock = `
<h2>Accounts</h2>
<table class="report-table report-accounts-table"><thead><tr><th>Label</th><th>Username</th><th>Email</th><th>Sites</th><th>Person</th><th>Password</th><th>Tags</th></tr></thead><tbody>${accountsRows || '<tr><td colspan="7" class="muted">None</td></tr>'}</tbody></table>`;
  const peopleBlock = `
<h2>People</h2>
${(people || []).length ? (people || []).map(p => {
    const name = escapeHtml((p.name || 'Unnamed').slice(0, 200));
    const notes = (p.notes || '').trim() ? `<p class="report-entity-notes">${escapeHtml((p.notes || '').slice(0, 2000))}</p>` : '';
    const tags = (p.tags || []).length ? (p.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join(' ') : '';
    const tagsLine = tags ? `<p><strong>Tags:</strong> ${tags}</p>` : '';
    const linkedGroups = (p.groupIds || []).map(gid => groups.find(g => g.id === gid)).filter(Boolean);
    const groupsLine = linkedGroups.length ? `<p><strong>Groups:</strong> ${linkedGroups.map(g => escapeHtml(g.name || g.id)).join(', ')}</p>` : '';
    const linkedAccounts = (accounts || []).filter(a => (a.personId || '') === p.id);
    const accountsLine = linkedAccounts.length ? `<p><strong>Accounts:</strong> ${linkedAccounts.map(a => escapeHtml(a.label || a.username || a.email || a.id)).join(', ')}</p>` : '';
    return `<div class="report-entity-block"><strong>${name}</strong>${notes}${tagsLine}${groupsLine}${accountsLine}</div>`;
  }).join('') : '<p class="muted">None</p>'}`;
  const groupsBlock = `
<h2>Groups</h2>
${(groups || []).length ? (groups || []).map(g => {
    const name = escapeHtml((g.name || 'Unnamed group').slice(0, 200));
    const desc = (g.description || '').trim() ? `<p class="report-entity-notes">${escapeHtml((g.description || '').slice(0, 2000))}</p>` : '';
    const tags = (g.tags || []).length ? (g.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join(' ') : '';
    const tagsLine = tags ? `<p><strong>Tags:</strong> ${tags}</p>` : '';
    const linkedPeople = (g.personIds || []).map(pid => people.find(p => p.id === pid)).filter(Boolean);
    const peopleLine = linkedPeople.length ? `<p><strong>People:</strong> ${linkedPeople.map(p => escapeHtml(p.name || p.id)).join(', ')}</p>` : '';
    const linkedGroups = (g.groupIds || []).map(gid => groups.find(x => x.id === gid)).filter(Boolean);
    const groupsLine = linkedGroups.length ? `<p><strong>Linked groups:</strong> ${linkedGroups.map(x => escapeHtml(x.name || x.id)).join(', ')}</p>` : '';
    return `<div class="report-entity-block"><strong>${name}</strong>${desc}${tagsLine}${peopleLine}${groupsLine}</div>`;
  }).join('') : '<p class="muted">None</p>'}`;
  const graphDataUrl = getGraphSvgDataUrl({ forWord });
  const graphBlock = graphDataUrl
    ? `<h2>Graph</h2><div class="report-screenshot-wrap report-graph-wrap"><img src="${graphDataUrl}" alt="Graph" class="report-screenshot report-graph"/></div>`
    : '<h2>Graph</h2><p class="muted">Switch to the Graph tab and export again to include the graph.</p>';
  const baseReportStyle = '@page{margin:1in;} body{font-family:system-ui;margin:0;padding:1in;box-sizing:border-box;} .report-meta{color:#666;margin-top:0;} .report-footer{margin-top:2em;font-size:12px;} .report-capture-block{border-bottom:1px solid #ddd;padding:1em 0;break-inside:avoid;} .report-capture-block p{margin:0.4em 0;} .report-no-screenshot{color:#999;} .tag,.tech-pill{background:#e9d5ff;color:#6b21a8;padding:2px 6px;border-radius:4px;font-size:12px;} code{font-size:11px;} .report-stats-cards{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0;} .report-stat{background:#f3f4f6;padding:4px 10px;border-radius:6px;} .report-list{margin:0.4em 0;} .report-table{border-collapse:collapse;width:100%;margin:8px 0;} .report-table th,.report-table td{border:1px solid #ddd;padding:8px 10px;text-align:left;} .report-table th{background:#f3f4f6;font-weight:600;} .report-entity-block{border-bottom:1px solid #eee;padding:10px 0;} .report-entity-block p{margin:4px 0;} .report-entity-notes{color:#444;}';
  const reportGraphBg = (settings && settings.graphCanvasColor) ? String(settings.graphCanvasColor).replace(/^#?/, '#') : '#d3d3d3';
  const imageStyleHtml = forWord
    ? ` .report-screenshot-wrap{max-width:100%;overflow:hidden;margin-top:4px;page-break-inside:avoid;} .report-screenshot{max-width:100%!important;max-height:6in!important;width:auto!important;height:auto!important;object-fit:contain;display:block;} .report-screenshot-wrap.report-graph-wrap{background:${reportGraphBg};} .report-graph{object-fit:contain;} @media print{ body{margin:0;padding:1in;} .report-screenshot-wrap{max-width:100%;} .report-screenshot{max-width:100%!important;max-height:6in!important;} }`
    : ` .report-screenshot-wrap{max-width:100%;overflow:hidden;margin-top:4px;} .report-screenshot{max-width:100%;max-height:70vh;width:auto;height:auto;object-fit:contain;display:block;} .report-screenshot-wrap.report-graph-wrap{background:${reportGraphBg};min-height:200px;} .report-graph{object-fit:contain;max-width:100%;} @media print{ body{margin:0;padding:1in;} .report-screenshot-wrap{max-width:100%!important;max-height:6in!important;} }`;
  const reportStyle = baseReportStyle + imageStyleHtml;
  const title = 'Shuck Report';
  const generated = new Date().toISOString();
  const caseId = escapeHtml(currentCaseId);
  const capturesBlockOut = blocks || '<p class="muted">No captures</p>';
  const defaultBody = `
<h1>${escapeHtml(title)}</h1>
<p class="report-meta"><strong>Document info:</strong> Generated ${generated} · Case: ${caseId}</p>
<h2>1. Scope and objectives</h2>
<p class="muted">Describe the scope of the investigation and key questions to answer.</p>
<h2>2. Methodology</h2>
<p class="muted">Describe data sources, tools, and collection methods.</p>
<h2>3. Intelligence summary</h2>
<p>Findings from captured data: entity graph, statistics, and linked accounts, people, and groups.</p>
${graphBlock}
${statsBlock}
${accountsBlock}
${peopleBlock}
${groupsBlock}
<h2>4. Evidence and captures</h2>
<p>Captured pages and screenshots supporting the assessment.</p>
${capturesBlockOut}
<h2>5. Sources and references</h2>
<p class="muted">List primary and secondary sources, with URLs and dates where applicable.</p>
<hr/>
<p class="report-footer muted"><strong>Classification:</strong> [Set as required] · <strong>Generated by Shuck</strong> · ${generated}</p>`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>${escapeHtml(title)}</title><style>${reportStyle}</style></head><body>${defaultBody}</body></html>`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Sanitize string for Obsidian note filename (alphanumeric, dash, underscore). */
function slugForObsidian(s, maxLen = 60) {
  if (s == null || String(s).trim() === '') return 'note';
  let t = String(s).trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return t.slice(0, maxLen) || 'note';
}

/** Return Obsidian wiki-link for an entity by id and type (capture | account | person | group), or null if not found. */
function obsidianLinkForEntity(id, type, chronological, people, accounts, groups) {
  if (!id) return null;
  const linkType = type || 'capture';
  if (linkType === 'account') {
    const a = (accounts || []).find(x => x.id === id);
    if (!a) return null;
    const label = (a.label || a.username || a.email || a.id || 'Account').slice(0, 60);
    const slug = slugForObsidian(a.label || a.username || a.email || a.id) + '-' + (a.id || '').slice(0, 8);
    return `[[Accounts/${slug}|${label}]]`;
  }
  if (linkType === 'person') {
    const p = (people || []).find(x => x.id === id);
    if (!p) return null;
    const name = (p.name || p.id || 'Person').slice(0, 60);
    const slug = slugForObsidian(p.name || p.id) + '-' + (p.id || '').slice(0, 8);
    return `[[People/${slug}|${name}]]`;
  }
  if (linkType === 'group') {
    const g = (groups || []).find(x => x.id === id);
    if (!g) return null;
    const name = (g.name || g.id || 'Group').slice(0, 60);
    const slug = slugForObsidian(g.name || g.id) + '-' + (g.id || '').slice(0, 8);
    return `[[Groups/${slug}|${name}]]`;
  }
  const c = (chronological || []).find(x => x.id === id) || (typeof captures !== 'undefined' && captures.find(x => x.id === id));
  if (!c) return null;
  const title = (c.title || c.url || c.id || 'Capture').slice(0, 80);
  const slug = slugForObsidian(title) + '-' + (c.id || '').slice(0, 8);
  return `[[Captures/${slug}|${title}]]`;
}

/**
 * Build Obsidian vault content for the current case: markdown files and optional image blobs.
 * Returns { caseName, files: [{ path, content }], assets: [{ path, blob }] }.
 * Every note gets case frontmatter and case tag so the vault can hold many cases and be filtered.
 * Links between captures, people, accounts, and groups are emitted as wiki-links (same as the graph).
 */
function buildObsidianVaultContent() {
  const caseMeta = cases.find(c => c.id === currentCaseId);
  const caseName = (caseMeta && caseMeta.name) ? String(caseMeta.name).replace(/[^\w\s-]/g, ' ').trim() || 'Shuck Case' : 'Shuck Case';
  const safeCaseName = slugForObsidian(caseName, 80) || 'ShuckCase';
  const caseTag = 'case-' + safeCaseName;
  const caseEscaped = caseName.replace(/"/g, '\\"');
  const files = [];
  const assets = [];

  const chronological = getChronologicalReportItems();
  const generated = new Date().toISOString();

  /** Frontmatter: case, type tag (capture|person|account|group|index|todo), and any tags added in the extension. */
  function caseFrontmatter(extraTags = [], typeTag = '') {
    const tags = ['shuck', caseTag].concat(typeTag ? [typeTag] : []).concat(extraTags || []);
    const tagLines = tags.map(t => (t.indexOf('-') >= 0 || t.indexOf(' ') >= 0 || /[^a-zA-Z0-9_]/.test(t) ? `  - "${t}"` : `  - ${t}`)).join('\n');
    return `case: "${caseEscaped}"\ntags:\n${tagLines}`;
  }

  // Index note: overview with links to sections
  const captureLinks = chronological.slice(0, 100).map(c => {
    const title = (c.title || c.url || c.id || 'Capture').slice(0, 80);
    const slug = slugForObsidian(title) + '-' + (c.id || '').slice(0, 8);
    return `- [[Captures/${slug}|${title}]]`;
  }).join('\n');
  const moreCaptures = chronological.length > 100 ? `\n_… and ${chronological.length - 100} more (see Captures folder)._` : '';
  const peopleLinks = (people || []).map(p => `- [[People/${slugForObsidian(p.name || p.id)}-${(p.id || '').slice(0, 8)}|${(p.name || p.id).trim() || 'Person'}]]`).join('\n');
  const accountLinks = (accounts || []).map(a => `- [[Accounts/${slugForObsidian(a.label || a.username || a.email || a.id)}-${(a.id || '').slice(0, 8)}|${(a.label || a.username || a.email || a.id || 'Account').slice(0, 60)}]]`).join('\n');
  const groupLinks = (groups || []).map(g => `- [[Groups/${slugForObsidian(g.name || g.id)}-${(g.id || '').slice(0, 8)}|${(g.name || g.id || 'Group').trim()}]]`).join('\n');

  const indexMd = `---
source: Shuck
${caseFrontmatter([], 'index')}
exported: ${generated}
---

# ${caseName}

Case exported from Shuck. Use this note as the entry point.

**Filter by this case:** Every note is tagged with \`#case-${safeCaseName}\` and has frontmatter \`case: "${caseEscaped}"\`. In Obsidian: **Graph** → filter by tag \`case-${safeCaseName}\` to see only this case; **Dataview** use \`WHERE contains(tags, "case-${safeCaseName}")\` or \`WHERE case = "${caseEscaped}"\`.

## Captures (${chronological.length})
${captureLinks || '_None_'}${moreCaptures}

## People (${(people || []).length})
${peopleLinks || '_None_'}

## Accounts (${(accounts || []).length})
${accountLinks || '_None_'}

## Groups (${(groups || []).length})
${groupLinks || '_None_'}

## Todo
See [[Todo]].

## Stats
- **Captures:** ${captures.length}
- **People:** ${(people || []).length}
- **Accounts:** ${(accounts || []).length}
- **Groups:** ${(groups || []).length}
`;
  files.push({ path: 'index.md', content: indexMd });

  // Todo note
  const todoLines = (todoItems || []).map((item, i) => {
    const done = item.done ? '- [x]' : '- [ ]';
    const section = item.section ? ` _(${item.section})_` : '';
    return `${done} ${(item.title || '').trim() || 'Task'}${section}`;
  }).join('\n');
  const todoMd = `---
source: Shuck
${caseFrontmatter([], 'todo')}
---

# Todo

${todoLines || '_No tasks._'}
`;
  files.push({ path: 'Todo.md', content: todoMd });

  // Capture notes (and optional screenshot assets)
  chronological.forEach(c => {
    const title = (c.title || c.url || c.id || 'Capture').slice(0, 80);
    const slug = slugForObsidian(title) + '-' + (c.id || '').slice(0, 8);
    const tags = (c.tags || []).length ? (c.tags || []).map(t => `  - ${t}`).join('\n') : '';
    const tech = (c.technologies || []).length ? (c.technologies || []).join(', ') : '';
    const dateStr = c.timestamp ? formatTimestampFull(c.timestamp) : '';
    const screenshotRel = c.imageDataUrl ? `assets/capture-${(c.id || 'img').slice(0, 12)}.png` : '';
    let body = '';
    if (c.url) body += `**URL:** [${c.url}](${c.url})\n\n`;
    if (dateStr) body += `**Date:** ${dateStr}\n\n`;
    if (c.contentHash) body += `**Hash:** \`${String(c.contentHash).slice(0, 24)}\`\n\n`;
    if (tags) body += `**Tags:**\n${tags}\n\n`;
    if (tech) body += `**Technologies:** ${tech}\n\n`;
    if (c.notes && String(c.notes).trim()) body += `## Notes\n\n${String(c.notes).trim()}\n\n`;
    if (c.serverHeaders && Object.keys(c.serverHeaders).length) {
      const headers = Object.entries(c.serverHeaders).map(([k, v]) => `${k}: ${v}`).join('; ');
      body += `**Server headers:** ${headers.slice(0, 300)}\n\n`;
    }
    const ed = c.extractedData || {};
    if ((ed.emails && ed.emails.length) || (ed.ips && ed.ips && ed.ips.length)) {
      body += '**Extracted:** ';
      const parts = [];
      if (ed.emails && ed.emails.length) parts.push(`Emails: ${ed.emails.slice(0, 5).join(', ')}`);
      if (ed.ips && ed.ips.length) parts.push(`IPs: ${ed.ips.slice(0, 5).join(', ')}`);
      body += parts.join('; ') + '\n\n';
    }
    if (screenshotRel) body += `## Screenshot\n\n![[${screenshotRel}]]\n`;

    // Links (same as graph: capture→capture, capture→account, capture→person, capture→group)
    const captureLinkLines = (c.links || [])
      .map(l => obsidianLinkForEntity(l.id, l.type, chronological, people, accounts, groups))
      .filter(Boolean);
    if (captureLinkLines.length) body += '## Links\n\n' + captureLinkLines.map(l => `- ${l}`).join('\n') + '\n\n';
    // Linked from: incoming links so Obsidian graph shows same connections as extension graph
    const linkedFromCaptures = chronological.filter(x => x.id !== c.id && (x.links || []).some(l => l.id === c.id));
    const linkedFromAccounts = (accounts || []).filter(a => (a.links || []).some(l => l.id === c.id));
    const linkedFromLines = [
      ...linkedFromCaptures.map(x => obsidianLinkForEntity(x.id, 'capture', chronological, people, accounts, groups)),
      ...linkedFromAccounts.map(a => obsidianLinkForEntity(a.id, 'account', chronological, people, accounts, groups)),
    ].filter(Boolean);
    if (linkedFromLines.length) body += '## Linked from\n\n' + linkedFromLines.map(l => `- ${l}`).join('\n') + '\n\n';

    const captureTags = (c.tags || []).length ? (c.tags || []).slice() : [];
    const frontmatter = [
      'source: Shuck',
      caseFrontmatter(captureTags, 'capture'),
      `url: ${(c.url || '').slice(0, 500)}`,
      `created: ${c.timestamp || ''}`,
      c.important ? 'important: true' : '',
    ].filter(Boolean).join('\n');

    files.push({ path: `Captures/${slug}.md`, content: `---\n${frontmatter}\n---\n\n# ${title}\n\n${body}` });

    if (c.imageDataUrl && c.id) {
      try {
        const base64 = c.imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
        const bin = atob(base64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        assets.push({ path: `assets/capture-${String(c.id).slice(0, 12)}.png`, blob: new Blob([arr], { type: 'image/png' }) });
      } catch (_) { /* skip image if decode fails */ }
    }
  });

  // People notes (links to accounts and groups like the graph: person→account via account.personId, person→group via group.personIds and person.groupIds)
  (people || []).forEach(p => {
    const name = (p.name || 'Unnamed').trim() || 'Person';
    const slug = slugForObsidian(p.name || p.id) + '-' + (p.id || '').slice(0, 8);
    const linkedAccounts = (accounts || []).filter(a => (a.personId || '') === p.id);
    const linkedGroups = (groups || []).filter(g => (g.personIds || []).includes(p.id) || (p.groupIds || []).includes(g.id));
    let body = '';
    if (p.notes && String(p.notes).trim()) body += `${String(p.notes).trim()}\n\n`;
    if (linkedAccounts.length) body += '## Linked accounts\n\n' + linkedAccounts.map(a => `- [[Accounts/${slugForObsidian(a.label || a.username || a.email || a.id)}-${(a.id || '').slice(0, 8)}|${(a.label || a.username || a.email || a.id)}]]`).join('\n') + '\n\n';
    if (linkedGroups.length) body += '## Groups\n\n' + linkedGroups.map(g => `- [[Groups/${slugForObsidian(g.name || g.id)}-${(g.id || '').slice(0, 8)}|${g.name || g.id}]]`).join('\n') + '\n';
    const personTags = (p.tags || []).length ? (p.tags || []).slice() : [];
    const frontmatter = ['source: Shuck', 'type: person', caseFrontmatter(personTags, 'person')].filter(Boolean).join('\n');
    files.push({ path: `People/${slug}.md`, content: `---\n${frontmatter}\n---\n\n# ${name}\n\n${body}` });
  });

  // Accounts notes (no passwords in export for safety; user can add manually). Links to person and to captures/accounts (same as graph).
  (accounts || []).forEach(a => {
    const label = (a.label || a.username || a.email || a.id || 'Account').slice(0, 80);
    const slug = slugForObsidian(a.label || a.username || a.email || a.id) + '-' + (a.id || '').slice(0, 8);
    let body = '';
    if (a.username) body += `**Username:** ${a.username}\n\n`;
    if (a.email) body += `**Email:** ${a.email}\n\n`;
    if (Array.isArray(a.sites) && a.sites.length) body += `**Sites:** ${a.sites.join(', ')}\n\n`;
    if (a.personId && people) {
      const person = people.find(p => p.id === a.personId);
      if (person) body += `**Person:** [[People/${slugForObsidian(person.name || person.id)}-${(person.id || '').slice(0, 8)}|${person.name || person.id}]]\n\n`;
    }
    const accountLinkLines = (a.links || [])
      .map(l => obsidianLinkForEntity(l.id, l.type, chronological, people, accounts, groups))
      .filter(Boolean);
    if (accountLinkLines.length) body += '## Links\n\n' + accountLinkLines.map(l => `- ${l}`).join('\n') + '\n\n';
    // Linked from: incoming links so Obsidian graph matches extension graph
    const linkedFromCaptures = chronological.filter(c => (c.links || []).some(l => l.id === a.id));
    const linkedFromAccounts = (accounts || []).filter(x => x.id !== a.id && (x.links || []).some(l => l.id === a.id));
    const linkedFromLines = [
      ...linkedFromCaptures.map(c => obsidianLinkForEntity(c.id, 'capture', chronological, people, accounts, groups)),
      ...linkedFromAccounts.map(x => obsidianLinkForEntity(x.id, 'account', chronological, people, accounts, groups)),
    ].filter(Boolean);
    if (linkedFromLines.length) body += '## Linked from\n\n' + linkedFromLines.map(l => `- ${l}`).join('\n') + '\n\n';
    const accountTags = (a.tags || []).length ? (a.tags || []).slice() : [];
    const frontmatter = ['source: Shuck', 'type: account', caseFrontmatter(accountTags, 'account')].filter(Boolean).join('\n');
    files.push({ path: `Accounts/${slug}.md`, content: `---\n${frontmatter}\n---\n\n# ${label}\n\n${body}` });
  });

  // Groups notes (links to people and other groups like the graph)
  (groups || []).forEach(g => {
    const name = (g.name || g.id || 'Group').trim().slice(0, 80);
    const slug = slugForObsidian(g.name || g.id) + '-' + (g.id || '').slice(0, 8);
    let body = '';
    if (g.description && String(g.description).trim()) body += `${String(g.description).trim()}\n\n`;
    const linkedPeople = (g.personIds || []).map(pid => people.find(p => p.id === pid)).filter(Boolean);
    const linkedGroups = (g.groupIds || []).map(gid => groups.find(x => x.id === gid)).filter(Boolean);
    if (linkedPeople.length) body += '## People\n\n' + linkedPeople.map(p => `- [[People/${slugForObsidian(p.name || p.id)}-${(p.id || '').slice(0, 8)}|${p.name || p.id}]]`).join('\n') + '\n\n';
    if (linkedGroups.length) body += '## Linked groups\n\n' + linkedGroups.map(x => `- [[Groups/${slugForObsidian(x.name || x.id)}-${(x.id || '').slice(0, 8)}|${x.name || x.id}]]`).join('\n') + '\n';
    const groupTags = (g.tags || []).length ? (g.tags || []).slice() : [];
    const frontmatter = ['source: Shuck', 'type: group', caseFrontmatter(groupTags, 'group')].filter(Boolean).join('\n');
    files.push({ path: `Groups/${slug}.md`, content: `---\n${frontmatter}\n---\n\n# ${name}\n\n${body}` });
  });

  return { caseName: safeCaseName, files, assets };
}

/**
 * Export case to Obsidian: either write into a folder (File System Access API) or download a single .md file.
 */
async function exportToObsidian() {
  const { caseName, files, assets } = buildObsidianVaultContent();
  const allText = files.map(f => `\n\n---\n\n# File: ${f.path}\n\n${f.content}`).join('');
  const singleMd = `# ${caseName} (Shuck export – single file)\n\n_To get a full vault with separate notes, use Chrome and choose a folder when prompted._\n${allText}`;

  if (typeof window.showDirectoryPicker === 'function') {
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite', startIn: 'documents' });
      const caseDir = await dirHandle.getDirectoryHandle(caseName, { create: true });
      const assetDir = await caseDir.getDirectoryHandle('assets', { create: true });
      for (const { path, content } of files) {
        const parts = path.split('/');
        const dir = parts.length > 1 ? await caseDir.getDirectoryHandle(parts[0], { create: true }) : caseDir;
        const fileName = parts.length > 1 ? parts[1] : parts[0];
        const handle = await dir.getFileHandle(fileName, { create: true });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
      }
      for (const { path, blob } of assets) {
        const name = path.replace('assets/', '');
        const handle = await assetDir.getFileHandle(name, { create: true });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      }
      await showMessageModal('Export complete', `Case "${caseName}" has been written to the selected folder. Open it as a vault (or folder) in Obsidian.`);
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('Obsidian folder export failed, falling back to single file:', err);
    }
  }
  downloadBlob(new Blob([singleMd], { type: 'text/markdown' }), `${caseName}-shuck-export.md`);
}

const exportBtn = document.getElementById('exportBtn');
const exportDropdown = document.getElementById('exportDropdown');
if (exportBtn && exportDropdown) {
  exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportDropdown.classList.toggle('hidden');
  });
  document.addEventListener('click', () => exportDropdown.classList.add('hidden'));
  exportDropdown.querySelectorAll('.export-option').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      exportDropdown.classList.add('hidden');
      const format = btn.dataset.format;
      const filtered = filterCaptures();
      const d = new Date();
      const ts = () => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const h = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        const s = String(d.getSeconds()).padStart(2, '0');
        const tzPart = Intl.DateTimeFormat(undefined, { timeZoneName: 'short' }).formatToParts(d).find(p => p.type === 'timeZoneName');
        const tz = (tzPart && tzPart.value) ? tzPart.value.replace(/\+/g, 'p').replace(/-/g, 'm').replace(/\s/g, '_') : 'UTC';
        return `${y}-${m}-${day}_${h}-${min}-${s}_${tz}`;
      };
      const dateStr = ts();
      if (format === 'json') {
        const data = await getLocalCaptures();
        const caseCaptures = (data.captures || []).filter(c => (c.caseId || 'default') === currentCaseId);
        const [caseConfig, globalSettings] = await Promise.all([
          chrome.runtime.sendMessage({ action: 'getCaseConfig', caseId: currentCaseId }),
          chrome.runtime.sendMessage({ action: 'getSettings' }),
        ]);
        const caseMeta = cases.find(c => c.id === currentCaseId);
        const isUuidV4 = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
        const exportCaseId = (caseMeta && isUuidV4(caseMeta.id)) ? caseMeta.id : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'export-' + Date.now());
        const fullCase = {
          exportedAt: new Date().toISOString(),
          generator: 'Shuck',
          version: 1,
          caseId: exportCaseId,
          caseName: caseMeta ? caseMeta.name : currentCaseId,
          captures: caseCaptures,
          nextId: data.nextId != null ? data.nextId : caseCaptures.length + 1,
          accounts: accounts,
          people: people,
          groups: groups,
          todoItems: todoItems,
          caseConfig: {
            blacklist: (caseConfig && caseConfig.blacklist) || [],
            selectors: (caseConfig && caseConfig.selectors) || [],
            tags: (caseConfig && caseConfig.tags) || [],
            graphLayout: (caseConfig && caseConfig.graphLayout) || {},
            graphViewTransform: (caseConfig && caseConfig.graphViewTransform) || null,
            graphPan: (caseConfig && caseConfig.graphPan) || null,
            graphZoom: (caseConfig && caseConfig.graphZoom) != null ? caseConfig.graphZoom : null,
          },
          graphFilters: (savedGraphFilters || []).map(f => ({ id: f.id, name: f.name, filter: f.filter })),
          settings: globalSettings || null,
          config: {
            captureSortOrder: (settings && settings.captureSortOrder) || 'newest',
          },
        };
        downloadBlob(new Blob([JSON.stringify(fullCase, null, 2)], { type: 'application/json' }), `shuck-case-${(caseMeta && caseMeta.name) ? caseMeta.name.replace(/[^\w-]/g, '_') : currentCaseId}-${dateStr}.json`);
      } else if (format === 'html') {
        downloadBlob(new Blob([buildReportHtml(true)], { type: 'text/html' }), `shuck-report-${dateStr}.html`);
      } else if (format === 'csv') {
        const header = 'Id,URL,Title,Timestamp,ContentHash,Tags,Notes,Important,Technologies,Emails,IPs,HasScreenshot,HasHtml\n';
        const rows = filtered.map(c => {
          const tags = (c.tags || []).map(t => `"${String(t).replace(/"/g, '""')}"`).join(';');
          const tech = (c.technologies || []).map(t => String(t).replace(/"/g, '""')).join(';');
          const ed = c.extractedData || {};
          const emails = (ed.emails || []).join(';').replace(/"/g, '""');
          const ips = (ed.ips || []).join(';').replace(/"/g, '""');
          return `"${(c.id || '').replace(/"/g, '""')}","${(c.url || '').replace(/"/g, '""')}","${(c.title || '').replace(/"/g, '""')}","${c.timestamp || ''}","${(c.contentHash || '').replace(/"/g, '""')}","${tags}","${String(c.notes || '').replace(/"/g, '""')}",${c.important ? 'yes' : 'no'},"${tech}","${emails}","${ips}",${c.imageDataUrl ? 'yes' : 'no'},${c.htmlContent ? 'yes' : 'no'}`;
        }).join('\n');
        downloadBlob(new Blob([header + rows], { type: 'text/csv' }), `shuck-captures-${dateStr}.csv`);
      } else if (format === 'docx') {
        downloadBlob(new Blob([buildReportHtml(true, { forWord: true })], { type: 'application/vnd.ms-word' }), `shuck-report-${dateStr}.doc`);
      } else if (format === 'obsidian') {
        await exportToObsidian();
      }
    });
  });
}

bindGraphFilterListeners();
load();
