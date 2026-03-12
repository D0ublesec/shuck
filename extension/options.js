// Shuck options page – load/save settings, cases, selectors

document.addEventListener('DOMContentLoaded', () => {
  load();
  document.getElementById('openDashboardFromOptions')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  });
});

async function load() {
  const [sets, caseList, curCase, selList] = await Promise.all([
    chrome.storage.local.get('shuck_settings').then(r => r.shuck_settings || {}),
    chrome.storage.local.get('shuck_cases').then(r => r.shuck_cases || []),
    chrome.storage.local.get('shuck_current_case_id').then(r => r.shuck_current_case_id || 'default'),
    chrome.storage.local.get('shuck_selectors').then(r => r.shuck_selectors || []),
  ]);
  const cases = (Array.isArray(caseList) && caseList.length) ? caseList : [{ id: 'default', name: 'Default case', createdAt: new Date().toISOString() }];
  const theme = sets.theme || 'purple';
  applyTheme(theme);
  document.documentElement.setAttribute('data-color-scheme', (sets.colorScheme === 'dark' ? 'dark' : 'light'));
  document.getElementById('captureToggle').checked = sets.captureEnabled !== false && sets.fullCapture !== false;
  document.getElementById('saveImagesToggle').checked = sets.saveImagesInReport !== false;
  const themeSelect = document.getElementById('themeSelect');
  const themeColorPicker = document.getElementById('themeColorPicker');
  if (theme.startsWith('#')) {
    themeSelect.value = 'custom';
    themeColorPicker.value = theme;
  } else {
    themeSelect.value = theme;
    themeColorPicker.value = themeToHex(theme);
  }
  const ignoreListEl = document.getElementById('ignoreListInput');
  if (ignoreListEl) ignoreListEl.value = (sets.blacklist || []).join('\n');

  document.getElementById('caseSelect').innerHTML = cases.map(c =>
    `<option value="${c.id}" ${c.id === curCase ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
  ).join('');

  window._selectors = Array.isArray(selList) ? selList : [];
  renderSelectors();
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

const THEME_HEX = { purple: '#6b21a8', teal: '#0d5c4b', blue: '#1d4ed8', slate: '#475569' };
function themeToHex(name) {
  return THEME_HEX[name] || '#6b21a8';
}
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme.startsWith('#')) {
    root.removeAttribute('data-theme');
    root.style.setProperty('--accent', theme);
    root.style.setProperty('--accent-hover', lightenHex(theme, 1.12));
    root.style.setProperty('--accent-muted', mixWithWhite(theme, 0.88));
  } else {
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent-hover');
    root.style.removeProperty('--accent-muted');
    root.setAttribute('data-theme', theme);
  }
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

function renderSelectors() {
  const list = document.getElementById('selectorsList');
  list.innerHTML = (window._selectors || []).map((sel, i) => `
    <div class="selector-row" data-i="${i}">
      <input type="text" class="selector-name" placeholder="Name" value="${escapeHtml(sel.name || '')}" />
      <input type="text" class="selector-pattern" placeholder="Pattern" value="${escapeHtml(sel.pattern || '')}" />
      <label class="selector-regex"><input type="checkbox" ${sel.useRegex ? 'checked' : ''} /> Regex</label>
      <button type="button" class="btn-remove-selector">Remove</button>
    </div>
  `).join('');
  list.querySelectorAll('.btn-remove-selector').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.closest('.selector-row').dataset.i, 10);
      window._selectors.splice(i, 1);
      renderSelectors();
      saveOptions();
    });
  });
}

document.getElementById('addSelector').addEventListener('click', () => {
  window._selectors.push({ id: Date.now(), name: '', pattern: '', useRegex: false });
  renderSelectors();
});

const newCaseModal = document.getElementById('newCaseModal');
const newCaseName = document.getElementById('newCaseName');
const newCaseOk = document.getElementById('newCaseOk');
const newCaseCancel = document.getElementById('newCaseCancel');
function openNewCaseModal() {
  newCaseName.value = 'New case';
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
  const cases = await chrome.storage.local.get('shuck_cases').then(r => r.shuck_cases || []);
  const list = cases.length ? cases : [{ id: 'default', name: 'Default case', createdAt: new Date().toISOString() }];
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'case_' + Date.now();
  list.push({ id, name, createdAt: new Date().toISOString() });
  await chrome.storage.local.set({ shuck_cases: list, shuck_current_case_id: id });
  closeNewCaseModal();
  load();
});
newCaseName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') newCaseOk.click();
  if (e.key === 'Escape') { e.preventDefault(); closeNewCaseModal(); }
});
document.getElementById('addCaseBtn').addEventListener('click', openNewCaseModal);

document.getElementById('caseSelect').addEventListener('change', async () => {
  await chrome.storage.local.set({ shuck_current_case_id: document.getElementById('caseSelect').value });
});

async function saveOptions() {
  const ignoreListEl = document.getElementById('ignoreListInput');
  const blacklist = ignoreListEl ? ignoreListEl.value.split('\n').map(s => s.trim()).filter(Boolean) : [];
  const themeSelect = document.getElementById('themeSelect').value;
  const theme = themeSelect === 'custom' ? document.getElementById('themeColorPicker').value : themeSelect;
  const newSelectors = [];
  document.querySelectorAll('#selectorsList .selector-row').forEach(row => {
    const pattern = (row.querySelector('.selector-pattern')?.value || '').trim();
    if (!pattern) return;
    newSelectors.push({
      id: Date.now() + Math.random(),
      name: (row.querySelector('.selector-name')?.value || '').trim(),
      pattern,
      useRegex: row.querySelector('.selector-regex input')?.checked || false,
    });
  });
  const settings = await chrome.storage.local.get('shuck_settings').then(r => r.shuck_settings || {});
  await chrome.storage.local.set({
    shuck_settings: {
      ...settings,
      captureEnabled: document.getElementById('captureToggle').checked,
      fullCapture: document.getElementById('captureToggle').checked,
      saveImagesInReport: document.getElementById('saveImagesToggle').checked,
      blacklist,
      theme,
    },
    shuck_selectors: newSelectors,
  });
  window._selectors = newSelectors;
  applyTheme(theme);
}

document.getElementById('themeSelect').addEventListener('change', () => {
  const v = document.getElementById('themeSelect').value;
  if (v !== 'custom') {
    document.getElementById('themeColorPicker').value = themeToHex(v);
    applyTheme(v);
  }
  saveOptions();
});
document.getElementById('themeColorPicker').addEventListener('input', () => {
  const hex = document.getElementById('themeColorPicker').value;
  document.getElementById('themeSelect').value = 'custom';
  applyTheme(hex);
  saveOptions();
});
document.getElementById('captureToggle').addEventListener('change', saveOptions);
document.getElementById('saveImagesToggle').addEventListener('change', saveOptions);
document.getElementById('ignoreListInput')?.addEventListener('blur', saveOptions);
