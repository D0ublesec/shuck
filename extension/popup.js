// Shuck - Popup UI

const searchEl = document.getElementById('search');
const tagFilterEl = document.getElementById('tagFilter');
const captureBtn = document.getElementById('captureBtn');
const captureDropdown = document.getElementById('captureDropdown');
const exportBtn = document.getElementById('exportBtn');
const exportDropdown = document.getElementById('exportDropdown');
const caseSelect = document.getElementById('caseSelect');
const addCaseBtn = document.getElementById('addCaseBtn');
const captureToggle = document.getElementById('captureToggle');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const ignoreListInput = document.getElementById('ignoreListInput');
const saveSettingsBtn = document.getElementById('saveSettings');
const selectorsList = document.getElementById('selectorsList');
const addSelectorBtn = document.getElementById('addSelector');
const highlightOnPageBtn = document.getElementById('highlightOnPage');
const capturesList = document.getElementById('capturesList');
const capturesEmpty = document.getElementById('capturesEmpty');
const statsEl = document.getElementById('stats');
const panels = document.querySelectorAll('.panel');
const tabButtons = document.querySelectorAll('.tab');

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
const detailAttachments = document.getElementById('detailAttachments');
const attachmentUrl = document.getElementById('attachmentUrl');
const attachmentAddBtn = document.getElementById('attachmentAdd');
const openDashboardBtn = document.getElementById('openDashboardBtn');
const mainArea = document.getElementById('mainArea');
const showPreviews = document.getElementById('showPreviews');
const statsContent = document.getElementById('statsContent');
const todoList = document.getElementById('todoList');
const todoInput = document.getElementById('todoInput');
const todoAddBtn = document.getElementById('todoAdd');
const importFile = document.getElementById('importFile');
const importBtn = document.getElementById('importBtn');

function showMessageModal(title, body) {
  return new Promise((resolve) => {
    const modal = document.getElementById('messageModal');
    const titleEl = document.getElementById('messageModalTitle');
    const bodyEl = document.getElementById('messageModalBody');
    const okBtn = document.getElementById('messageModalOk');
    if (titleEl) titleEl.textContent = title || 'Notice';
    if (bodyEl) bodyEl.textContent = body || '';
    modal?.classList.remove('hidden');
    const close = () => {
      modal?.classList.add('hidden');
      okBtn?.removeEventListener('click', close);
      modal?.querySelector('.modal-backdrop')?.removeEventListener('click', close);
      resolve();
    };
    okBtn?.addEventListener('click', close);
    modal?.querySelector('.modal-backdrop')?.addEventListener('click', close);
  });
}

function showConfirmModal(title, body) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmModalTitle');
    const bodyEl = document.getElementById('confirmModalBody');
    const okBtn = document.getElementById('confirmModalOk');
    const cancelBtn = document.getElementById('confirmModalCancel');
    if (titleEl) titleEl.textContent = title || 'Confirm';
    if (bodyEl) bodyEl.textContent = body || '';
    modal?.classList.remove('hidden');
    const close = (result) => {
      modal?.classList.add('hidden');
      okBtn?.removeEventListener('click', onOk);
      cancelBtn?.removeEventListener('click', onCancel);
      modal?.querySelector('.modal-backdrop')?.removeEventListener('click', onCancel);
      resolve(result);
    };
    const onOk = () => close(true);
    const onCancel = () => close(false);
    okBtn?.addEventListener('click', onOk);
    cancelBtn?.addEventListener('click', onCancel);
    modal?.querySelector('.modal-backdrop')?.addEventListener('click', onCancel);
  });
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
function applyPopupTheme(body, theme) {
  if (theme.startsWith('#')) {
    body.removeAttribute('data-theme');
    body.style.setProperty('--accent', theme);
    body.style.setProperty('--accent-hover', lightenHex(theme, 1.12));
    body.style.setProperty('--accent-muted', mixWithWhite(theme, 0.88));
    body.style.setProperty('--accent-tag', mixWithWhite(theme, 0.88));
    body.style.setProperty('--accent-tag-text', theme);
  } else {
    body.style.removeProperty('--accent');
    body.style.removeProperty('--accent-hover');
    body.style.removeProperty('--accent-muted');
    body.style.removeProperty('--accent-tag');
    body.style.removeProperty('--accent-tag-text');
    body.setAttribute('data-theme', theme);
  }
}

let allCaptures = [];
let captures = [];
let cases = [];
let currentCaseId = 'default';
let settings = { captureEnabled: true, blacklist: [] };
let searchQuery = '';
let selectedTagFilter = '';
let detailCaptureId = null;
let selectors = [];
let caseTagList = [];
let globalTagList = [];

const DEFAULT_TAGS = ['Evidence', 'Source', 'Person', 'Account', 'Follow-up', 'Important', 'Lead', 'Primary source', 'Profile', 'Target', 'Contact', 'Social', 'Domain', 'IP', 'Verified', 'To review'];

const POPUP_TAB_KEY = 'shuck_popup_tab';

// Tab switching
function setActiveTab(tab) {
  tabButtons.forEach(b => b.classList.remove('active'));
  panels.forEach(p => p.classList.remove('active'));
  const btn = [...tabButtons].find(b => b.dataset.tab === tab) || tabButtons[0];
  btn.classList.add('active');
  document.getElementById(`panel-${btn.dataset.tab}`).classList.add('active');
  if (btn.dataset.tab === 'captures') renderCaptures();
  if (btn.dataset.tab === 'stats') renderStats();
  if (btn.dataset.tab === 'todo') renderTodo();
  try { chrome.storage.local.set({ [POPUP_TAB_KEY]: btn.dataset.tab }); } catch (_) {}
}

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
});

searchEl.addEventListener('input', () => {
  searchQuery = searchEl.value.trim().toLowerCase();
  renderCaptures();
});

tagFilterEl.addEventListener('change', () => {
  selectedTagFilter = tagFilterEl.value;
  renderCaptures();
});
document.getElementById('captureSort')?.addEventListener('change', async () => {
  const el = document.getElementById('captureSort');
  const value = (el && el.value) || 'newest';
  await chrome.runtime.sendMessage({ action: 'setSettings', settings: { captureSortOrder: value } });
  settings = { ...settings, captureSortOrder: value };
  renderCaptures();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.shuck_settings) return;
  chrome.runtime.sendMessage({ action: 'getSettings' }, (newSettings) => {
    if (newSettings) {
      settings = newSettings;
      captureToggle.checked = settings.captureEnabled !== false;
      const statusEl = document.getElementById('captureToggleStatus');
      if (statusEl) statusEl.textContent = (settings.captureEnabled !== false) ? 'On' : 'Off';
    }
  });
});

async function load() {
  const curCase = await new Promise(r => chrome.runtime.sendMessage({ action: 'getCurrentCaseId' }, r));
  const caseId = curCase || 'default';
  const [data, caseList, sets, selList, caseConfig] = await Promise.all([
    new Promise(r => chrome.runtime.sendMessage({ action: 'getCaptures' }, r)),
    new Promise(r => chrome.runtime.sendMessage({ action: 'getCases' }, r)),
    new Promise(r => chrome.runtime.sendMessage({ action: 'getSettings' }, r)),
    new Promise(r => chrome.runtime.sendMessage({ action: 'getSelectors', caseId }, r)),
    new Promise(r => chrome.runtime.sendMessage({ action: 'getCaseConfig', caseId }, r)),
  ]);
  allCaptures = (data && data.captures) ? data.captures : [];
  cases = Array.isArray(caseList) ? caseList : [{ id: 'default', name: 'Default case' }];
  currentCaseId = caseId;
  settings = sets || settings;
  selectors = Array.isArray(selList) ? selList : [];
  caseTagList = Array.isArray(caseConfig?.tags) ? caseConfig.tags : [];
  globalTagList = await new Promise(r => chrome.runtime.sendMessage({ action: 'getGlobalTags' }, r)) || [];
  captures = allCaptures.filter(c => (c.caseId || 'default') === currentCaseId);
  todoItems = await new Promise(r => chrome.runtime.sendMessage({ action: 'getTodoList', caseId: currentCaseId }, r)) || [];

  captureToggle.checked = settings.captureEnabled;
  const statusEl = document.getElementById('captureToggleStatus');
  if (statusEl) statusEl.textContent = captureToggle.checked ? 'On' : 'Off';
  const captureSortEl = document.getElementById('captureSort');
  if (captureSortEl) captureSortEl.value = (settings.captureSortOrder || 'newest');
  if (ignoreListInput) ignoreListInput.value = (settings.blacklist || []).join('\n');
  renderTagList();
  renderSelectorsList();
  const theme = settings.theme || 'purple';
  const body = document.getElementById('popupBody') || document.body;
  if (body) applyPopupTheme(body, theme);
  body.setAttribute('data-color-scheme', (settings.colorScheme === 'dark' ? 'dark' : 'light'));

  caseSelect.innerHTML = cases.map(c => `<option value="${escapeHtml(c.id)}" ${c.id === currentCaseId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');
  const allTags = [...new Set(captures.flatMap(c => c.tags || []))].sort();
  tagFilterEl.innerHTML = '<option value="">All tags</option>' + allTags.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');

  renderCaptures();
  renderStats();
  renderTodo();
  updateStats();
  updateHighlightButtonFromTab();
  const stored = await chrome.storage.local.get(POPUP_TAB_KEY);
  const savedTab = stored[POPUP_TAB_KEY];
  if (savedTab && [...tabButtons].some(b => b.dataset.tab === savedTab)) setActiveTab(savedTab);
}

function renderStats() {
  if (!statsContent) return;
  const byTag = {};
  captures.forEach(c => {
    (c.tags || []).forEach(t => { byTag[t] = (byTag[t] || 0) + 1; });
  });
  const tagRows = Object.entries(byTag).sort((a, b) => b[1] - a[1]).map(([tag, n]) => `<div class="stat-row"><span>${escapeHtml(tag)}</span><span>${n}</span></div>`).join('');
  const recent = captures.slice(0, 5);
  const recentRows = recent.map(c => `<div class="stat-row"><span>${escapeHtml((c.title || c.url || '').slice(0, 40))}</span><span>${formatTime(c.timestamp)}</span></div>`).join('');
  statsContent.innerHTML = `
    <h3>This case</h3>
    <div class="stat-row"><span>Total captures</span><span>${captures.length}</span></div>
    <h3>By tag</h3>
    ${tagRows || '<p class="muted">No tags yet</p>'}
    <h3>Recent captures</h3>
    ${recentRows || '<p class="muted">None</p>'}
  `;
}

let todoItems = [];
function renderTodo() {
  if (!todoList) return;
  todoList.innerHTML = todoItems.map((item, i) => `
    <li class="${item.done ? 'done' : ''}" data-i="${i}">
      <input type="checkbox" class="todo-check" ${item.done ? 'checked' : ''} />
      <span class="todo-text">${escapeHtml(item.text)}</span>
      <button type="button" class="btn-remove-selector todo-remove">×</button>
    </li>
  `).join('');
  todoList.querySelectorAll('.todo-check').forEach((cb, i) => {
    cb.addEventListener('change', () => { todoItems[i].done = cb.checked; chrome.runtime.sendMessage({ action: 'setTodoList', caseId: currentCaseId, list: todoItems }); renderTodo(); });
  });
  todoList.querySelectorAll('.todo-list li').forEach(li => {
    li.addEventListener('click', (e) => {
      if (e.target.closest('.todo-remove')) return;
      if (e.target.closest('.todo-check')) return; /* let checkbox handle it */
      const i = parseInt(li.dataset.i, 10);
      if (Number.isNaN(i) || i < 0 || i >= todoItems.length) return;
      todoItems[i].done = !todoItems[i].done;
      chrome.runtime.sendMessage({ action: 'setTodoList', caseId: currentCaseId, list: todoItems });
      renderTodo();
    });
  });
  todoList.querySelectorAll('.todo-remove').forEach((btn, i) => {
    btn.addEventListener('click', () => { todoItems.splice(i, 1); chrome.runtime.sendMessage({ action: 'setTodoList', caseId: currentCaseId, list: todoItems }); renderTodo(); });
  });
}

function filterCaptures() {
  let out = captures;
  if (selectedTagFilter) out = out.filter(c => (c.tags || []).includes(selectedTagFilter));
  if (searchQuery) {
    const q = searchQuery;
    out = out.filter(c => {
      const text = `${c.title || ''} ${c.url || ''} ${(c.notes || '')} ${(c.tags || []).join(' ')} ${(c.htmlContent || '').slice(0, 5000)}`.toLowerCase();
      return text.includes(q);
    });
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
  const showThumbs = showPreviews && showPreviews.checked;
  capturesList.innerHTML = '';
  capturesEmpty.classList.toggle('hidden', filtered.length > 0);

  filtered.forEach(c => {
    const li = document.createElement('li');
    li.dataset.id = c.id;
    if (c.important) li.classList.add('item-important');
    const time = formatTime(c.timestamp);
    const thumb = (showThumbs && c.imageDataUrl) ? `<div class="capture-thumb"><img src="${c.imageDataUrl}" alt="" /></div>` : '';
    li.innerHTML = `
      ${thumb}
      <div class="item-body">
        <div class="item-title">${c.important ? '★ ' : ''}${escapeHtml(c.title || c.url)}</div>
        <div class="item-url">${escapeHtml(c.url)}</div>
        <div class="item-meta">${time}${c.contentHash ? ' · ' + (c.contentHash || '').slice(0, 12) + '…' : ''}</div>
        ${(c.tags && c.tags.length) ? `<div class="item-tags">${c.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        <div class="capture-actions">
          ${c.inlineFailed ? `<button class="request-from-server" data-id="${c.id}" title="Fetch inlined content from server">Request from server</button>` : ''}
          <button class="important-capture" data-id="${c.id}" title="Mark important">${c.important ? '★' : '☆'}</button>
          <button class="add-tag" data-id="${c.id}">+ Tag</button>
          <button class="view-detail" data-id="${c.id}">Details</button>
          <button class="delete-capture" data-id="${c.id}">Delete</button>
        </div>
      </div>
    `;
    li.querySelectorAll('.request-from-server').forEach(btn => btn.addEventListener('click', e => { e.stopPropagation(); requestReinline(c.id); }));
    li.querySelector('.important-capture').addEventListener('click', e => { e.stopPropagation(); markImportant(c.id); });
    li.querySelector('.add-tag').addEventListener('click', e => { e.stopPropagation(); addTag(c.id); });
    li.querySelector('.view-detail').addEventListener('click', e => { e.stopPropagation(); openDetail(c.id); });
    li.querySelector('.delete-capture').addEventListener('click', e => { e.stopPropagation(); deleteCapture(c.id); });
    li.addEventListener('click', e => { if (!e.target.closest('button')) openDetail(c.id); });
    capturesList.appendChild(li);
  });
}

async function requestReinline(captureId) {
  const res = await chrome.runtime.sendMessage({ action: 'reinlineCaptureFromServer', captureId });
  if (res && res.error) await showMessageModal('Error', res.error);
  else await load();
}

async function markImportant(id) {
  const c = allCaptures.find(x => x.id === id);
  if (!c) return;
  await chrome.runtime.sendMessage({ action: 'updateCapture', id, updates: { important: !c.important } });
  load();
}

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

function formatTimestampFull(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    });
  } catch (_) {
    try { return new Date(iso).toISOString(); } catch (e2) { return String(iso); }
  }
}

function escapeHtml(s) {
  if (s == null) return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}

function escapeRegexLiteral(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Apply selector highlights to HTML source (escaped text). Returns HTML string with <mark> wraps.
function highlightSourceWithSelectors(html, selectorsList) {
  if (!html) return '(No HTML saved)';
  let text = escapeHtml(html);
  if (!selectorsList || !selectorsList.length) return text;
  for (const sel of selectorsList) {
    const pattern = (sel.pattern || '').trim();
    if (!pattern) continue;
    let regex;
    try {
      regex = sel.useRegex ? new RegExp(pattern, 'gi') : new RegExp(escapeRegexLiteral(pattern), 'gi');
    } catch (_) { continue; }
    text = text.replace(regex, match => `<mark class="shuck-highlight" title="${escapeHtml(sel.name || pattern)}">${match}</mark>`);
  }
  return text;
}

function renderTagList() {
  const el = document.getElementById('tagListList');
  if (!el) return;
  el.innerHTML = (globalTagList || []).map((tag, i) => `
    <div class="tag-list-row" data-i="${i}">
      <span class="tag">${escapeHtml(tag)}</span>
      <button type="button" class="btn-remove-tag">×</button>
    </div>
  `).join('');
  el.querySelectorAll('.btn-remove-tag').forEach(btn => {
    btn.addEventListener('click', async () => {
      const i = parseInt(btn.closest('.tag-list-row').dataset.i, 10);
      globalTagList.splice(i, 1);
      await chrome.runtime.sendMessage({ action: 'setGlobalTags', tags: globalTagList });
      renderTagList();
    });
  });
}

const addTagToListModal = document.getElementById('addTagToListModal');
const addTagToListPickerList = document.getElementById('addTagToListPickerList');
const addTagToListInput = document.getElementById('addTagToListInput');
const addTagToListConfirm = document.getElementById('addTagToListConfirm');
const addTagToListCancel = document.getElementById('addTagToListCancel');

function openAddTagToListModal() {
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

function closeAddTagToListModal() {
  addTagToListModal.classList.add('hidden');
}

async function applyTagToLibraryAndClose(tag) {
  const t = (typeof tag === 'string' ? tag : (addTagToListInput?.value || '').trim()).trim();
  if (!t) return;
  globalTagList = [...(globalTagList || []), t];
  await chrome.runtime.sendMessage({ action: 'setGlobalTags', tags: globalTagList });
  closeAddTagToListModal();
  renderTagList();
}

addTagToListConfirm?.addEventListener('click', () => applyTagToLibraryAndClose(addTagToListInput?.value?.trim()));
addTagToListInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTagToListConfirm?.click(); });
addTagToListCancel?.addEventListener('click', closeAddTagToListModal);
addTagToListModal?.querySelector('.modal-backdrop')?.addEventListener('click', closeAddTagToListModal);

document.getElementById('addTagToList').addEventListener('click', openAddTagToListModal);

function renderSelectorsList() {
  if (!selectorsList) return;
  selectorsList.innerHTML = selectors.map((sel, i) => `
    <div class="selector-row" data-i="${i}">
      <input type="text" class="selector-name" placeholder="Name" value="${escapeHtml(sel.name || '')}" />
      <input type="text" class="selector-pattern" placeholder="Text or regex pattern" value="${escapeHtml(sel.pattern || '')}" />
      <label class="selector-regex"><input type="checkbox" ${sel.useRegex ? 'checked' : ''} /> Regex</label>
      <button type="button" class="btn-remove-selector">Remove</button>
    </div>
  `).join('');
  selectorsList.querySelectorAll('.btn-remove-selector').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.closest('.selector-row').dataset.i, 10);
      selectors.splice(i, 1);
      renderSelectorsList();
    });
  });
}

addSelectorBtn.addEventListener('click', () => {
  selectors.push({ id: Date.now(), name: '', pattern: '', useRegex: false });
  renderSelectorsList();
});

function updateStats() {
  if (statsEl) statsEl.textContent = `${captures.length} captures (this case)`;
}

let addTagCaptureId = null;
const addTagModal = document.getElementById('addTagModal');
const addTagNewInput = document.getElementById('addTagNewInput');
const addTagConfirm = document.getElementById('addTagConfirm');
const addTagCancel = document.getElementById('addTagCancel');
const addTagPickerList = document.getElementById('addTagPickerList');
const addTagExistingList = document.getElementById('addTagExistingList');
const addTagToGlobalListEl = document.getElementById('addTagToGlobalList');

function refreshTagModalLists() {
  if (!addTagCaptureId) return;
  const c = captures.find(x => x.id === addTagCaptureId) || allCaptures.find(x => x.id === addTagCaptureId);
  const existingTags = (c && c.tags) || [];
  const existingSet = new Set(existingTags);
  if (addTagExistingList) {
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
      btn.addEventListener('click', () => removeTagFromCapture(addTagCaptureId, btn.dataset.tag));
    });
    addTagExistingList.querySelectorAll('.btn-edit-tag').forEach(btn => {
      btn.addEventListener('click', () => editTagOnCapture(addTagCaptureId, btn.dataset.tag));
    });
  }
  const suggested = [...new Set([...DEFAULT_TAGS, ...globalTagList])].filter(t => t && !existingSet.has(t)).sort();
  addTagPickerList.innerHTML = suggested.length
    ? suggested.map(t => `<button type="button" class="tag-picker-btn" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('')
    : '<p class="muted tag-picker-empty">No suggested tags (add in Settings or type below)</p>';
  addTagPickerList.querySelectorAll('.tag-picker-btn').forEach(btn => {
    btn.addEventListener('click', () => applyTagFromModal(btn.dataset.tag));
  });
  addTagNewInput.value = '';
  if (addTagToGlobalListEl) addTagToGlobalListEl.checked = false;
}

async function removeTagFromCapture(captureId, tag) {
  const c = captures.find(x => x.id === captureId) || allCaptures.find(x => x.id === captureId);
  if (!c) return;
  const tags = (c.tags || []).filter(t => t !== tag);
  await chrome.runtime.sendMessage({ action: 'updateCapture', id: captureId, updates: { tags } });
  await load();
  refreshTagModalLists();
  if (detailCaptureId === captureId) openDetail(captureId);
}

async function editTagOnCapture(captureId, oldTag) {
  const newTag = prompt('Edit tag:', oldTag);
  if (newTag == null || newTag.trim() === '') return;
  const t = newTag.trim();
  if (t === oldTag) return;
  const c = captures.find(x => x.id === captureId) || allCaptures.find(x => x.id === captureId);
  if (!c) return;
  const tags = (c.tags || []).map(tag => tag === oldTag ? t : tag);
  await chrome.runtime.sendMessage({ action: 'updateCapture', id: captureId, updates: { tags } });
  await load();
  refreshTagModalLists();
  if (detailCaptureId === captureId) openDetail(captureId);
}

function openAddTagModal(captureId) {
  addTagCaptureId = captureId;
  refreshTagModalLists();
  addTagModal.classList.remove('hidden');
  addTagNewInput.focus();
}
function closeAddTagModal() {
  addTagModal.classList.add('hidden');
  addTagCaptureId = null;
}
async function applyTagFromModal(tag) {
  const t = (typeof tag === 'string' ? tag : addTagNewInput.value).trim();
  if (!t || !addTagCaptureId) return;
  const id = addTagCaptureId;
  const c = captures.find(x => x.id === id) || allCaptures.find(x => x.id === id);
  const tags = [...(c.tags || []), t];
  await chrome.runtime.sendMessage({ action: 'updateCapture', id, updates: { tags } });
  if (addTagToGlobalListEl && addTagToGlobalListEl.checked && !globalTagList.includes(t)) {
    globalTagList = [...globalTagList, t];
    await chrome.runtime.sendMessage({ action: 'setGlobalTags', tags: globalTagList });
  }
  await load();
  refreshTagModalLists();
  if (detailCaptureId === id) openDetail(id);
}
addTagConfirm.addEventListener('click', () => applyTagFromModal(addTagNewInput.value.trim()));
addTagNewInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTagConfirm.click(); });
addTagCancel.addEventListener('click', closeAddTagModal);
addTagModal.querySelector('.modal-backdrop').addEventListener('click', closeAddTagModal);

function addTag(id) {
  openAddTagModal(id);
}

async function deleteCapture(id) {
  const ok = await showConfirmModal('Delete capture', 'Delete this capture?');
  if (!ok) return;
  await chrome.runtime.sendMessage({ action: 'deleteCapture', id });
  if (detailCaptureId === id) detailModal.classList.add('hidden');
  load();
}

function openDetail(id) {
  const c = allCaptures.find(x => x.id === id);
  if (!c) return;
  detailCaptureId = id;
  detailTitle.textContent = c.title || c.url || 'Capture';
  detailUrl.innerHTML = c.url ? `<a href="${escapeHtml(c.url)}" target="_blank" rel="noopener">${escapeHtml(c.url)}</a>` : '';
  detailMeta.textContent = `${formatTimestampFull(c.timestamp)} · Hash: ${(c.contentHash || '').slice(0, 16)}…`;

  detailPreview.innerHTML = '';
  if (c.imageDataUrl) {
    const img = document.createElement('img');
    img.src = c.imageDataUrl;
    img.alt = 'Screenshot';
    img.style.maxWidth = '100%';
    img.style.maxHeight = '200px';
    detailPreview.appendChild(img);
  } else {
    detailPreview.innerHTML = '<p class="muted">No screenshot</p>';
  }

  const html = c.htmlContent || '';
  if (!html) {
    detailSourceContent.textContent = '(No HTML saved)';
  } else {
    detailSourceContent.innerHTML = highlightSourceWithSelectors(html, selectors);
  }

  const techList = c.technologies || [];
  const headers = c.serverHeaders || {};
  if (detailTechnologies) detailTechnologies.innerHTML = techList.length ? techList.map(t => `<li><span class="tech-pill">${escapeHtml(t)}</span></li>`).join('') : '<li class="muted">None detected</li>';
  if (detailHeaders) detailHeaders.innerHTML = Object.keys(headers).length ? Object.entries(headers).map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd><code>${escapeHtml(String(v))}</code></dd>`).join('') : '<dd class="muted">None captured</dd>';

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
      openDetail(c.id);
    });
  });
  detailTags.querySelector('.btn-add-detail-tag')?.addEventListener('click', () => openAddTagModal(c.id));
  const att = c.attachments || [];
  if (detailAttachments) {
    detailAttachments.innerHTML = att.length ? att.map((a, i) => `<li><a href="${escapeHtml(a.url || a.name || '#')}" target="_blank">${escapeHtml(a.name || a.url || 'Attachment')}</a> <button type="button" class="btn-remove-att" data-i="${i}">×</button></li>`).join('') : '<li class="muted">None</li>';
    detailAttachments.querySelectorAll('.btn-remove-att').forEach(btn => btn.addEventListener('click', () => removeAttachment(detailCaptureId, parseInt(btn.dataset.i, 10))));
  }
  if (attachmentUrl) attachmentUrl.value = '';

  document.querySelectorAll('.detail-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('detailInfo').classList.add('active');
  document.querySelector('.detail-tab[data-detail-tab="info"]').classList.add('active');
  document.querySelectorAll('.detail-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('detailInfo').classList.add('active');
  detailModal.classList.remove('hidden');
}

detailClose.addEventListener('click', () => detailModal.classList.add('hidden'));
detailModal.querySelector('.modal-backdrop').addEventListener('click', () => detailModal.classList.add('hidden'));

document.querySelectorAll('.detail-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.detailTab;
    document.querySelectorAll('.detail-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const panel = tab === 'data' ? document.getElementById('detailData') : tab === 'source' ? document.getElementById('detailSource') : tab === 'notes' ? document.getElementById('detailNotes') : tab === 'tech' ? document.getElementById('detailTech') : document.getElementById('detailInfo');
    if (panel) panel.classList.add('active');
  });
});

function saveDetail() {
  if (!detailCaptureId) return;
  chrome.runtime.sendMessage({
    action: 'updateCapture',
    id: detailCaptureId,
    updates: {
      notes: detailNotesInput.value.trim(),
      important: detailImportant.checked,
    },
  }, () => { load(); openDetail(detailCaptureId); });
}

detailNotesInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); saveDetail(); }
});
detailSave.addEventListener('click', saveDetail);

// Shift+Enter in any modal submits/saves (clicks the primary button). Skip when focus is in a textarea.
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

async function removeAttachment(capId, index) {
  const c = allCaptures.find(x => x.id === capId);
  if (!c) return;
  const att = [...(c.attachments || [])];
  att.splice(index, 1);
  await chrome.runtime.sendMessage({ action: 'updateCapture', id: capId, updates: { attachments: att } });
  openDetail(capId);
}

attachmentAddBtn.addEventListener('click', () => {
  const url = (attachmentUrl?.value || '').trim();
  if (!url || !detailCaptureId) return;
  const c = allCaptures.find(x => x.id === detailCaptureId);
  const att = [...(c?.attachments || []), { name: url, url: url.startsWith('http') ? url : '#' }];
  chrome.runtime.sendMessage({ action: 'updateCapture', id: detailCaptureId, updates: { attachments: att } }, () => { load(); openDetail(detailCaptureId); });
  attachmentUrl.value = '';
});

openDashboardBtn.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
});

showPreviews.addEventListener('change', () => renderCaptures());

settingsBtn.addEventListener('click', () => {
  settingsPanel.classList.toggle('hidden');
  if (mainArea) mainArea.classList.toggle('hidden', !settingsPanel.classList.contains('hidden'));
});

// Case
caseSelect.addEventListener('change', async () => {
  const id = caseSelect.value;
  await chrome.runtime.sendMessage({ action: 'setCurrentCaseId', id });
  load();
});

const newCaseModal = document.getElementById('newCaseModal');
const newCaseName = document.getElementById('newCaseName');
const newCaseOk = document.getElementById('newCaseOk');
const newCaseCancel = document.getElementById('newCaseCancel');
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

// Capture toggle
captureToggle.addEventListener('change', async () => {
  const on = captureToggle.checked;
  const statusEl = document.getElementById('captureToggleStatus');
  if (statusEl) statusEl.textContent = on ? 'On' : 'Off';
  await chrome.runtime.sendMessage({ action: 'setSettings', settings: { captureEnabled: on, fullCapture: on } });
  load();
});

// Settings
saveSettingsBtn.addEventListener('click', async () => {
  const lines = (ignoreListInput && ignoreListInput.value) ? ignoreListInput.value.split('\n').map(s => s.trim()).filter(Boolean) : [];
  await chrome.runtime.sendMessage({ action: 'setSettings', settings: { blacklist: lines } });
  const newSelectors = [];
  selectorsList.querySelectorAll('.selector-row').forEach(row => {
    const name = (row.querySelector('.selector-name')?.value || '').trim();
    const pattern = (row.querySelector('.selector-pattern')?.value || '').trim();
    const useRegex = row.querySelector('.selector-regex input')?.checked || false;
    if (pattern) newSelectors.push({ id: Date.now() + Math.random(), name, pattern, useRegex });
  });
  await chrome.runtime.sendMessage({ action: 'setSelectors', caseId: currentCaseId, selectors: newSelectors });
  await chrome.runtime.sendMessage({ action: 'setCaseConfig', caseId: currentCaseId, config: { tags: [] } });
  selectors = newSelectors;
  if (highlightOnPageBtn?.dataset.highlightState === 'on' && chrome.storage?.session) {
    const { [HIGHLIGHT_TAB_KEY]: tabId } = await chrome.storage.session.get(HIGHLIGHT_TAB_KEY);
    if (tabId) {
      try {
        await chrome.tabs.sendMessage(tabId, { action: 'highlightOnPage', selectors: newSelectors });
      } catch (_) {}
    }
  }
  settingsPanel.classList.add('hidden');
  mainArea.classList.remove('hidden');
  load();
});

// Highlight on/off for current page — toggle and show state
function setHighlightButtonState(on) {
  if (!highlightOnPageBtn) return;
  highlightOnPageBtn.dataset.highlightState = on ? 'on' : 'off';
  highlightOnPageBtn.textContent = on ? 'Highlight: On' : 'Highlight: Off';
  highlightOnPageBtn.classList.toggle('highlight-on', on);
}
const HIGHLIGHT_TAB_KEY = 'shuck_highlight_tab_id';

async function updateHighlightButtonFromTab() {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let tabIdToCheck = activeTab?.id;
  if (chrome.storage?.session) {
    const { [HIGHLIGHT_TAB_KEY]: storedId } = await chrome.storage.session.get(HIGHLIGHT_TAB_KEY);
    if (storedId) {
      try {
        await chrome.tabs.get(storedId);
        tabIdToCheck = storedId;
      } catch (_) {
        await chrome.storage.session.remove(HIGHLIGHT_TAB_KEY);
      }
    }
  }
  if (!tabIdToCheck || (activeTab && (activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('chrome-extension://')))) {
    setHighlightButtonState(false);
    return;
  }
  try {
    const res = await chrome.tabs.sendMessage(tabIdToCheck, { action: 'getHighlightState' });
    setHighlightButtonState(res && res.enabled);
  } catch (_) {
    setHighlightButtonState(false);
    if (chrome.storage?.session) await chrome.storage.session.remove(HIGHLIGHT_TAB_KEY);
  }
}
highlightOnPageBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || tab.url.startsWith('chrome://')) {
    await showMessageModal('Highlight', 'Cannot run on this page.');
    return;
  }
  const isOn = highlightOnPageBtn.dataset.highlightState === 'on';
  if (isOn) {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'highlightOff' });
    } catch (_) {}
    if (chrome.storage?.session) await chrome.storage.session.remove(HIGHLIGHT_TAB_KEY);
    setHighlightButtonState(false);
    return;
  }
  const list = await new Promise(r => chrome.runtime.sendMessage({ action: 'getSelectors', caseId: currentCaseId }, r));
  if (!list?.length) {
    await showMessageModal('Highlight', 'Add at least one selector in Settings first.');
    return;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'highlightOnPage', selectors: list });
    if (chrome.storage?.session) await chrome.storage.session.set({ [HIGHLIGHT_TAB_KEY]: tab.id });
    setHighlightButtonState(true);
  } catch (e) {
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }).then(() =>
      chrome.tabs.sendMessage(tab.id, { action: 'highlightOnPage', selectors: list })
    ).then(async () => {
      if (chrome.storage?.session) await chrome.storage.session.set({ [HIGHLIGHT_TAB_KEY]: tab.id });
      setHighlightButtonState(true);
    }).catch(() => showMessageModal('Highlight', 'Reload the page and try again.'));
  }
});

todoAddBtn.addEventListener('click', () => {
  const text = (todoInput?.value || '').trim();
  if (!text) return;
  todoItems.push({ text, done: false });
  chrome.runtime.sendMessage({ action: 'setTodoList', caseId: currentCaseId, list: todoItems });
  todoInput.value = '';
  renderTodo();
});
todoInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); todoAddBtn.click(); }
});

importBtn.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const merge = await showConfirmModal('Import', 'Merge with existing data? (Cancel = replace)');
  const text = await f.text();
  let data;
  try { data = JSON.parse(text); } catch (_) { await showMessageModal('Import', 'Invalid JSON'); return; }
  const payload = data.captures ? { captures: data.captures, nextId: data.nextId || data.captures.length + 1 } : { captures: [], nextId: 1 };
  await chrome.runtime.sendMessage({ action: 'importData', data: payload, merge });
  importFile.value = '';
  load();
});

function buildReportHtml(includeScreenshots) {
  const filtered = filterCaptures();
  const rows = filtered.map(c => {
    const imgCell = (includeScreenshots && c.imageDataUrl) ? `<td><img src="${c.imageDataUrl}" alt="Screenshot" style="max-width:120px;max-height:80px;" /></td>` : '';
    const techCell = `<td>${(c.technologies || []).map(t => `<span class="tech-pill">${escapeHtml(t)}</span>`).join(' ')}</td>`;
    const headersStr = c.serverHeaders && Object.keys(c.serverHeaders).length ? Object.entries(c.serverHeaders).map(([k, v]) => `${k}: ${v}`).join('; ') : '';
    return `<tr>
      <td>${escapeHtml(formatTimestampFull(c.timestamp))}</td>
      <td><a href="${escapeHtml(c.url)}">${escapeHtml(c.title || c.url)}</a></td>
      <td><code>${escapeHtml((c.contentHash || '').slice(0, 16))}</code></td>
      <td>${(c.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join(' ')}</td>
      <td>${escapeHtml((c.notes || '').slice(0, 200))}</td>
      ${techCell}
      <td><small>${escapeHtml(headersStr.slice(0, 150))}</small></td>
      ${imgCell}
    </tr>`;
  }).join('');
  const thExtra = includeScreenshots ? '<th>Screenshot</th>' : '';
  const colgroup = includeScreenshots
    ? '<colgroup><col style="width:9%"/><col style="width:18%"/><col style="width:8%"/><col style="width:10%"/><col style="width:18%"/><col style="width:14%"/><col style="width:18%"/><col style="width:5%"/></colgroup>'
    : '<colgroup><col style="width:10%"/><col style="width:20%"/><col style="width:9%"/><col style="width:11%"/><col style="width:20%"/><col style="width:15%"/><col style="width:15%"/></colgroup>';
  const reportStyle = '@page{margin:1in;} body{font-family:system-ui;margin:0;padding:1in;box-sizing:border-box;} table{table-layout:fixed;width:100%;border-collapse:collapse;} th,td{border:1px solid #ddd;padding:8px;word-wrap:break-word;word-break:break-word;overflow-wrap:break-word;} th{background:#6b21a8;color:#fff;} .tag,.tech-pill{background:#e9d5ff;color:#6b21a8;padding:2px 6px;border-radius:4px;font-size:12px;margin-right:4px;} code{font-size:11px;} @media print{ body{margin:0;padding:1in;} }';
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Shuck Report</title>
<style>${reportStyle}</style>
</head>
<body>
<h1>Shuck Report</h1>
<p><strong>Generated:</strong> ${new Date().toISOString()} · Case: ${escapeHtml(currentCaseId)}</p>
<p><strong>Print to PDF:</strong> Use browser Print (Ctrl+P) and choose "Save as PDF".</p>
<table>${colgroup}
<thead><tr><th>Date & time</th><th>Page</th><th>Hash</th><th>Tags</th><th>Notes</th><th>Technologies</th><th>Server headers</th>${thExtra}</tr></thead>
<tbody>${rows || `<tr><td colspan="${includeScreenshots ? 8 : 7}">No captures</td></tr>`}</tbody>
</table>
</body>
</html>`;
}

// Capture dropdown
if (captureBtn && captureDropdown) {
  captureBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    captureDropdown.classList.toggle('hidden');
    exportDropdown?.classList.add('hidden');
  });
  captureDropdown?.querySelectorAll('.popup-dropdown-option').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      captureDropdown.classList.add('hidden');
      const action = btn.dataset.capture;
      const label = captureBtn.textContent;
      captureBtn.disabled = true;
      captureBtn.textContent = action === 'full' ? 'Capturing…' : action === 'screenshot' ? 'Saving…' : 'Opening…';
      try {
        if (action === 'full') {
          const res = await chrome.runtime.sendMessage({ action: 'addCapture' });
          if (res && res.error) await showMessageModal('Capture', res.error);
          else await load();
        } else if (action === 'screenshot') {
          const res = await chrome.runtime.sendMessage({ action: 'addScreenshotOnly' });
          if (res && res.error) await showMessageModal('Screenshot', res.error);
          else await load();
        } else if (action === 'screenshot-annotate') {
          const res = await chrome.runtime.sendMessage({ action: 'addScreenshotWithAnnotation' });
          if (res && res.error) await showMessageModal('Screenshot', res.error);
          else window.close();
        }
      } finally {
        captureBtn.disabled = false;
        captureBtn.textContent = label;
      }
    });
  });
}

// Export dropdown
if (exportBtn && exportDropdown) {
  exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportDropdown.classList.toggle('hidden');
    captureDropdown?.classList.add('hidden');
  });
  document.addEventListener('click', () => {
    exportDropdown?.classList.add('hidden');
    captureDropdown?.classList.add('hidden');
  });
  exportDropdown.querySelectorAll('.popup-dropdown-option').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      exportDropdown.classList.add('hidden');
      const format = btn.dataset.format;
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
        const filtered = filterCaptures();
        const caseMeta = cases.find(c => c.id === currentCaseId);
        const isUuidV4 = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
        const exportCaseId = (caseMeta && isUuidV4(caseMeta.id)) ? caseMeta.id : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'export-' + Date.now());
        const report = {
          exportedAt: new Date().toISOString(),
          generator: 'Shuck',
          caseId: exportCaseId,
          caseName: caseMeta ? caseMeta.name : currentCaseId,
          captures: filtered.map(c => ({
            id: c.id, url: c.url, title: c.title, timestamp: c.timestamp, contentHash: c.contentHash,
            tags: c.tags || [], notes: c.notes || '', important: !!c.important, hasScreenshot: !!c.imageDataUrl,
            extractedData: c.extractedData,
          })),
        };
        downloadBlob(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }), `shuck-report-${dateStr}.json`);
      } else if (format === 'html') {
        const html = buildReportHtml(true);
        downloadBlob(new Blob([html], { type: 'text/html' }), `shuck-report-${dateStr}.html`);
      } else if (format === 'csv') {
        const filtered = filterCaptures();
        const header = 'URL,Title,Timestamp,Tags,Notes,Important\n';
        const rows = filtered.map(c => {
          const tags = (c.tags || []).map(t => `"${String(t).replace(/"/g, '""')}"`).join(';');
          const notes = `"${String(c.notes || '').replace(/"/g, '""')}"`;
          return `"${(c.url || '').replace(/"/g, '""')}","${(c.title || '').replace(/"/g, '""')}","${c.timestamp || ''}","${tags}",${notes},${c.important ? 'yes' : 'no'}`;
        }).join('\n');
        downloadBlob(new Blob([header + rows], { type: 'text/csv' }), `shuck-tags-${dateStr}.csv`);
      } else if (format === 'pdf') {
        const reportHtml = buildReportHtml(true);
        const url = 'data:text/html;charset=utf-8,' + encodeURIComponent(reportHtml);
        chrome.tabs.create({ url });
      } else if (format === 'docx') {
        const reportHtml = buildReportHtml(true);
        const blob = new Blob([reportHtml], { type: 'application/vnd.ms-word' });
        downloadBlob(blob, `shuck-report-${dateStr}.doc`);
      }
    });
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

load();
