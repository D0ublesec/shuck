// Shuck - Content script: Take note dialog, respond to getHtml

const DIALOG_ID = 'shuck-note-dialog';

const THEME_HEX = { purple: '#6b21a8', teal: '#0d5c4b', blue: '#1d4ed8', slate: '#475569' };
function themeToHex(name) {
  if (!name || typeof name !== 'string') return '#6b21a8';
  if (name.startsWith('#')) return name;
  return THEME_HEX[name] || '#6b21a8';
}

function showNoteDialog() {
  if (document.getElementById(DIALOG_ID)) return;

  const overlay = document.createElement('div');
  overlay.id = DIALOG_ID;
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:2147483647;
    display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;
  `;
  const box = document.createElement('div');
  box.className = 'shuck-note-box';
  box.style.cssText = `
    background:#fff;border-radius:12px;padding:20px;min-width:320px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.3);
  `;
  box.innerHTML = `
    <h3 class="shuck-note-title" style="margin:0 0 12px;font-size:16px;">Shuck: Take note</h3>
    <p style="margin:0 0 12px;font-size:13px;color:#555;">Add context for this page. The current view will be captured with your note.</p>
    <textarea id="shuck-note-text" rows="4" style="width:100%;padding:8px;border:1px solid #ccc;border-radius:6px;font-size:14px;resize:vertical;box-sizing:border-box;"></textarea>
    <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end;">
      <button type="button" id="shuck-note-cancel" class="shuck-note-cancel" style="padding:8px 16px;border:1px solid #ccc;background:#fff;border-radius:6px;cursor:pointer;">Cancel</button>
      <button type="button" id="shuck-note-submit" class="shuck-note-submit" style="padding:8px 16px;border:none;color:#fff;border-radius:6px;cursor:pointer;">Save note</button>
    </div>
  `;
  overlay.appendChild(box);

  chrome.runtime.sendMessage({ action: 'getSettings' }, (settings) => {
    const theme = (settings && settings.theme) ? settings.theme : 'purple';
    const accentHex = (settings && settings.accentColor) ? settings.accentColor.replace(/^#?/, '#') : themeToHex(theme);
    const submitBtn = box.querySelector('#shuck-note-submit');
    const titleEl = box.querySelector('.shuck-note-title');
    if (submitBtn) {
      submitBtn.style.background = accentHex;
      submitBtn.style.borderColor = accentHex;
    }
    if (titleEl) titleEl.style.color = accentHex;
    if (box.style) {
      box.style.borderTop = '3px solid ' + accentHex;
    }
  });

  const cancel = () => {
    overlay.remove();
  };
  const submit = () => {
    const textarea = document.getElementById('shuck-note-text');
    const noteText = (textarea && textarea.value) ? textarea.value.trim() : '';
    overlay.remove();
    chrome.runtime.sendMessage({ action: 'addCaptureFromContent', noteText }, () => {});
  };

  const textarea = box.querySelector('#shuck-note-text');
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); submit(); }
  });
  box.querySelector('#shuck-note-cancel').addEventListener('click', cancel);
  box.querySelector('#shuck-note-submit').addEventListener('click', submit);
  overlay.addEventListener('click', e => { if (e.target === overlay) cancel(); });

  document.body.appendChild(overlay);
}

const HIGHLIGHT_STYLE_ID = 'shuck-highlight-style';
function ensureHighlightStyle() {
  if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = HIGHLIGHT_STYLE_ID;
  style.textContent = '.shuck-highlight { background: rgba(255, 235, 59, 0.65); border-radius: 2px; padding: 0 1px; }';
  (document.head || document.documentElement).appendChild(style);
}

// Remove existing Shuck highlights (spans we added)
function clearHighlights() {
  document.querySelectorAll('span.shuck-highlight').forEach(el => {
    const parent = el.parentNode;
    if (parent) parent.replaceChild(document.createTextNode(el.textContent), el);
  });
}

function escapeRegexLiteral(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let highlightEnabled = false;

// Highlight selector matches on the live page
function highlightOnPage(selectors) {
  ensureHighlightStyle();
  clearHighlights();
  highlightEnabled = false;
  if (!selectors || !selectors.length) return;

  const regexes = [];
  for (const sel of selectors) {
    const pattern = (sel.pattern || '').trim();
    if (!pattern) continue;
    try {
      const regex = sel.useRegex ? new RegExp(pattern, 'gi') : new RegExp(escapeRegexLiteral(pattern), 'gi');
      regexes.push({ regex, name: sel.name || pattern });
    } catch (_) {}
  }
  if (!regexes.length) return;

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const tag = (node.parentElement && node.parentElement.tagName) ? node.parentElement.tagName.toUpperCase() : '';
        if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(tag)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const textNodes = [];
  let n;
  while ((n = walker.nextNode())) textNodes.push(n);

  for (const textNode of textNodes) {
    const text = textNode.textContent;
    if (!text || text.length > 50000) continue;

    const ranges = [];
    for (const { regex } of regexes) {
      regex.lastIndex = 0;
      let m;
      while ((m = regex.exec(text)) !== null) {
        ranges.push({ start: m.index, end: m.index + m[0].length });
      }
    }
    ranges.sort((a, b) => a.start - b.start);
    const merged = [];
    for (const r of ranges) {
      if (merged.length && r.start <= merged[merged.length - 1].end) {
        merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, r.end);
      } else merged.push({ start: r.start, end: r.end });
    }
    if (merged.length === 0) continue;

    const frag = document.createDocumentFragment();
    let last = 0;
    for (const r of merged) {
      if (r.start > last) frag.appendChild(document.createTextNode(text.slice(last, r.start)));
      const span = document.createElement('span');
      span.className = 'shuck-highlight';
      span.textContent = text.slice(r.start, r.end);
      frag.appendChild(span);
      last = r.end;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    textNode.parentNode.replaceChild(frag, textNode);
  }
  highlightEnabled = true;
}

function highlightOff() {
  clearHighlights();
  highlightEnabled = false;
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'openNoteDialog') {
    showNoteDialog();
    sendResponse({ ok: true });
  } else if (request.action === 'highlightOnPage') {
    try {
      highlightOnPage(request.selectors);
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, error: String(e.message) });
    }
  } else if (request.action === 'highlightOff') {
    try {
      highlightOff();
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, error: String(e.message) });
    }
  } else if (request.action === 'getHighlightState') {
    sendResponse({ enabled: highlightEnabled });
  }
  return false;
});
