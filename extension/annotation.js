// Shuck – Image annotation: highlight areas, add numbers, crop, download, save to case

const ANNOTATION_COLORS_KEY = 'shuck_annotation_colors';
const DEFAULT_COLORS = { stroke: '#ff0000', number: '#ff0000', noFill: true, strokeWidth: 4, numberSize: 26, blurIntensity: 5 };

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let img = null;
let imgWidth = 0;
let imgHeight = 0;
let scale = 1;
let offsetX = 0;
let offsetY = 0;

const highlights = [];
const blurRects = []; // { x, y, w, h } — areas to blur in output
let numberSeq = 0;
const standaloneNumbers = []; // { x, y, n } — only number-mode circles; highlights do not affect this
let cropRect = null;
let pendingCrop = null;

let pendingPageUrl = '';
let pendingPageTitle = '';
let linkToCaptureId = ''; // when annotating from dashboard, link new capture to this capture id
let mode = 'highlight';
let dragStart = null;
let currentRect = null;
let moveTarget = null;
let moveStart = null;
const undoStack = [];
const UNDO_MAX = 50;

let annotationColors = { ...DEFAULT_COLORS };

async function loadAnnotationColors() {
  try {
    const r = await chrome.storage.local.get(ANNOTATION_COLORS_KEY);
    const stored = r[ANNOTATION_COLORS_KEY];
    if (stored && typeof stored === 'object') {
      annotationColors = { ...DEFAULT_COLORS, ...stored };
    }
  } catch (_) {}
  const strokeEl = document.getElementById('colorStroke');
  const numberEl = document.getElementById('colorNumber');
  const noFillEl = document.getElementById('colorNoFill');
  if (strokeEl) strokeEl.value = annotationColors.stroke || DEFAULT_COLORS.stroke;
  if (numberEl) numberEl.value = annotationColors.number || DEFAULT_COLORS.number;
  if (noFillEl) noFillEl.checked = annotationColors.noFill !== false;
  const strokeWidthEl = document.getElementById('strokeWidth');
  const numberSizeEl = document.getElementById('numberSize');
  const strokeWidthVal = document.getElementById('strokeWidthValue');
  const numberSizeVal = document.getElementById('numberSizeValue');
  const sw = Math.max(1, Math.min(12, parseInt(annotationColors.strokeWidth, 10) || 4));
  const ns = Math.max(8, Math.min(48, parseInt(annotationColors.numberSize, 10) || 26));
  const blurVal = Math.max(1, Math.min(10, parseInt(annotationColors.blurIntensity, 10) || 5));
  if (strokeWidthEl) { strokeWidthEl.value = sw; annotationColors.strokeWidth = sw; }
  if (strokeWidthVal) strokeWidthVal.textContent = sw;
  if (numberSizeEl) { numberSizeEl.value = ns; annotationColors.numberSize = ns; }
  if (numberSizeVal) numberSizeVal.textContent = ns;
  const blurEl = document.getElementById('blurIntensity');
  if (blurEl) { blurEl.value = 11 - blurVal; annotationColors.blurIntensity = blurVal; }
}

function saveAnnotationColors() {
  chrome.storage.local.set({ [ANNOTATION_COLORS_KEY]: { ...annotationColors } }).catch(() => {});
}

function getSrc() {
  const params = new URLSearchParams(window.location.search);
  return params.get('src') || '';
}

function getPendingKey() {
  const params = new URLSearchParams(window.location.search);
  return params.get('pending') || '';
}

function getTabId() {
  const params = new URLSearchParams(window.location.search);
  const t = params.get('tabId');
  return t ? parseInt(t, 10) : null;
}

function showPlaceholder(msg) {
  canvas.width = 400;
  canvas.height = 200;
  ctx.fillStyle = '#333';
  ctx.fillRect(0, 0, 400, 200);
  ctx.fillStyle = '#888';
  ctx.font = '16px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(msg || 'Right-click an image → Shuck: Annotate this image', 200, 100);
}

function showError(msg) {
  canvas.width = 400;
  canvas.height = 120;
  ctx.fillStyle = '#522';
  ctx.fillRect(0, 0, 400, 120);
  ctx.fillStyle = '#f88';
  ctx.font = '14px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(msg || 'Could not load image. It may be blocked (CORS).', 200, 60);
}

function loadImageFromDataUrl(dataUrl) {
  const image = new Image();
  image.onload = () => {
    img = image;
    imgWidth = image.naturalWidth;
    imgHeight = image.naturalHeight;
    fitAndDraw();
  };
  image.onerror = () => showError('Could not load image.');
  image.src = dataUrl;
}

function loadImage() {
  const pendingKey = getPendingKey();
  if (pendingKey) {
    chrome.storage.local.get(pendingKey).then((got) => {
      const data = got[pendingKey];
      if (data && data.imageDataUrl) {
        pendingPageUrl = data.url || '';
        pendingPageTitle = data.title || 'Screenshot';
        linkToCaptureId = data.linkToCaptureId || '';
        loadImageFromDataUrl(data.imageDataUrl);
        chrome.storage.local.remove(pendingKey).catch(() => {});
      } else {
        showPlaceholder('Screenshot no longer available.');
      }
    }).catch(() => showPlaceholder('Could not load screenshot.'));
    return;
  }
  const src = getSrc();
  if (!src) {
    showPlaceholder('Right-click an image → Shuck: Annotate this image');
    return;
  }
  const tabId = getTabId();
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => {
    img = image;
    imgWidth = image.naturalWidth;
    imgHeight = image.naturalHeight;
    fitAndDraw();
  };
  image.onerror = () => {
    if (tabId) {
      chrome.runtime.sendMessage({ action: 'getImageDataFromTab', tabId, srcUrl: src }, (response) => {
        if (chrome.runtime.lastError || !response || !response.dataUrl) {
          showError('Could not load image. It may be blocked (CORS). Try opening the page with the image and right‑click the image again.');
          return;
        }
        loadImageFromDataUrl(response.dataUrl);
      });
    } else {
      showError('Could not load image. It may be blocked (CORS). Right‑click the image on the page that shows it and choose Annotate again.');
    }
  };
  image.src = src;
}

function fitAndDraw() {
  if (!img) return;
  const wrap = canvas.parentElement;
  const maxW = wrap.clientWidth;
  const maxH = wrap.clientHeight;
  const r = Math.min(maxW / imgWidth, maxH / imgHeight, 1);
  scale = r;
  canvas.width = Math.round(imgWidth * scale);
  canvas.height = Math.round(imgHeight * scale);
  offsetX = offsetY = 0;
  draw();
}

function toImageCoords(x, y) {
  return {
    x: (x - offsetX) / scale,
    y: (y - offsetY) / scale,
  };
}

function toCanvasCoords(x, y) {
  return {
    x: x * scale + offsetX,
    y: y * scale + offsetY,
  };
}

function pushUndo() {
  undoStack.push({
    highlights: highlights.map(r => ({ ...r })),
    blurRects: blurRects.map(r => ({ ...r })),
    standaloneNumbers: standaloneNumbers.map(n => ({ ...n })),
    numberSeq,
  });
  if (undoStack.length > UNDO_MAX) undoStack.shift();
}

function undo() {
  if (!undoStack.length) return;
  const state = undoStack.pop();
  highlights.length = 0;
  highlights.push(...state.highlights);
  blurRects.length = 0;
  blurRects.push(...state.blurRects);
  standaloneNumbers.length = 0;
  standaloneNumbers.push(...state.standaloneNumbers);
  numberSeq = state.numberSeq;
  draw();
}

function hitTest(imgX, imgY) {
  const numSize = Math.max(8, Math.min(48, parseInt(annotationColors.numberSize, 10) || 26));
  const numRadius = numSize / 2;
  for (let i = standaloneNumbers.length - 1; i >= 0; i--) {
    const n = standaloneNumbers[i];
    if (Math.hypot(imgX - n.x, imgY - n.y) <= numRadius * 1.5) return { type: 'number', index: i };
  }
  for (let i = blurRects.length - 1; i >= 0; i--) {
    const r = blurRects[i];
    const minX = Math.min(r.x, r.x + r.w); const maxX = Math.max(r.x, r.x + r.w);
    const minY = Math.min(r.y, r.y + r.h); const maxY = Math.max(r.y, r.y + r.h);
    if (imgX >= minX && imgX <= maxX && imgY >= minY && imgY <= maxY) return { type: 'blur', index: i };
  }
  for (let i = highlights.length - 1; i >= 0; i--) {
    const r = highlights[i];
    const minX = Math.min(r.x, r.x + r.w); const maxX = Math.max(r.x, r.x + r.w);
    const minY = Math.min(r.y, r.y + r.h); const maxY = Math.max(r.y, r.y + r.h);
    if (imgX >= minX && imgX <= maxX && imgY >= minY && imgY <= maxY) return { type: 'highlight', index: i };
  }
  return null;
}

function draw() {
  if (!img) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const crop = cropRect || { x: 0, y: 0, w: imgWidth, h: imgHeight };
  ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);

  const s = scale;
  const ox = offsetX;
  const oy = offsetY;
  const blurLevel = Math.max(1, Math.min(10, parseInt(annotationColors.blurIntensity, 10) || 5));
  const blurPx = blurLevel * 8;
  blurRects.forEach((r) => {
    const x = r.x * s + ox;
    const y = r.y * s + oy;
    const w = r.w * s;
    const h = r.h * s;
    ctx.save();
    ctx.filter = `blur(${blurPx}px)`;
    ctx.drawImage(img, crop.x + r.x, crop.y + r.y, r.w, r.h, x, y, w, h);
    ctx.restore();
  });
  const strokeColor = annotationColors.stroke || DEFAULT_COLORS.stroke;
  const numberColor = annotationColors.number || DEFAULT_COLORS.number;
  const noFill = annotationColors.noFill !== false;
  const lineW = Math.max(1, Math.min(12, parseInt(annotationColors.strokeWidth, 10) || 4));
  const numSize = Math.max(8, Math.min(48, parseInt(annotationColors.numberSize, 10) || 26));
  const numRadiusCanvas = (numSize / 2) * s;
  const numFontCanvas = Math.round(numSize * s);

  highlights.forEach((r) => {
    const x = r.x * s + ox;
    const y = r.y * s + oy;
    const w = r.w * s;
    const h = r.h * s;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineW;
    if (!noFill) {
      ctx.fillStyle = strokeColor;
      ctx.globalAlpha = 0.2;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
    }
    ctx.strokeRect(x, y, w, h);
  });
  standaloneNumbers.forEach((n) => {
    const x = n.x * s + ox;
    const y = n.y * s + oy;
    const circleRadius = numRadiusCanvas * 1.35;
    ctx.beginPath();
    ctx.arc(x, y, circleRadius, 0, Math.PI * 2);
    ctx.fillStyle = numberColor;
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${numFontCanvas}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n.n), x, y);
  });
  if (currentRect) {
    const x = currentRect.x * s + ox;
    const y = currentRect.y * s + oy;
    const w = currentRect.w * s;
    const h = currentRect.h * s;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineW;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
  }
  if (pendingCrop) {
    const x = pendingCrop.x * s + ox;
    const y = pendingCrop.y * s + oy;
    const w = pendingCrop.w * s;
    const h = pendingCrop.h * s;
    ctx.strokeStyle = 'rgba(0, 200, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
  }
}

function getCanvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

canvas.addEventListener('mousedown', (e) => {
  const p = getCanvasPoint(e);
  const ix = (p.x - offsetX) / scale;
  const iy = (p.y - offsetY) / scale;
  const imgX = ix;
  const imgY = iy;
  if (mode === 'move') {
    moveTarget = hitTest(imgX, imgY);
    if (moveTarget) {
      const item = moveTarget.type === 'highlight' ? highlights[moveTarget.index] : moveTarget.type === 'blur' ? blurRects[moveTarget.index] : standaloneNumbers[moveTarget.index];
      moveStart = { x: imgX - item.x, y: imgY - item.y };
    }
    return;
  }
  if (mode === 'highlight') {
    dragStart = { x: imgX, y: imgY };
    currentRect = { x: imgX, y: imgY, w: 0, h: 0 };
  } else if (mode === 'blur') {
    dragStart = { x: imgX, y: imgY };
    currentRect = { x: imgX, y: imgY, w: 0, h: 0 };
  } else if (mode === 'number') {
    pushUndo();
    numberSeq++;
    standaloneNumbers.push({ x: imgX, y: imgY, n: numberSeq });
    draw();
  } else if (mode === 'crop') {
    pendingCrop = { x: imgX, y: imgY, w: 0, h: 0 };
    dragStart = { x: imgX, y: imgY };
  }
});

canvas.addEventListener('mousemove', (e) => {
  const p = getCanvasPoint(e);
  const ix = (p.x - offsetX) / scale;
  const iy = (p.y - offsetY) / scale;
  const imgX = ix;
  const imgY = iy;
  if (moveTarget && moveStart) {
    const item = moveTarget.type === 'highlight' ? highlights[moveTarget.index] : moveTarget.type === 'blur' ? blurRects[moveTarget.index] : standaloneNumbers[moveTarget.index];
    item.x = imgX - moveStart.x;
    item.y = imgY - moveStart.y;
    draw();
    return;
  }
  if (!dragStart) return;
  if ((mode === 'highlight' || mode === 'blur') && currentRect) {
    currentRect.w = imgX - dragStart.x;
    currentRect.h = imgY - dragStart.y;
    if (currentRect.w < 0) { currentRect.x = imgX; currentRect.w = -currentRect.w; }
    if (currentRect.h < 0) { currentRect.y = imgY; currentRect.h = -currentRect.h; }
    draw();
  } else if (mode === 'crop' && pendingCrop) {
    pendingCrop.w = imgX - dragStart.x;
    pendingCrop.h = imgY - dragStart.y;
    if (pendingCrop.w < 0) { pendingCrop.x = imgX; pendingCrop.w = -pendingCrop.w; }
    if (pendingCrop.h < 0) { pendingCrop.y = imgY; pendingCrop.h = -pendingCrop.h; }
    draw();
  }
});

canvas.addEventListener('mouseup', () => {
  if (moveTarget) {
    moveTarget = null;
    moveStart = null;
    draw();
    return;
  }
  if (mode === 'highlight' && currentRect && (Math.abs(currentRect.w) > 2 || Math.abs(currentRect.h) > 2)) {
    pushUndo();
    highlights.push({ x: currentRect.x, y: currentRect.y, w: currentRect.w, h: currentRect.h });
  }
  if (mode === 'blur' && currentRect && (Math.abs(currentRect.w) > 2 || Math.abs(currentRect.h) > 2)) {
    pushUndo();
    blurRects.push({ x: currentRect.x, y: currentRect.y, w: currentRect.w, h: currentRect.h });
  }
  if (mode === 'crop' && pendingCrop && (Math.abs(pendingCrop.w) > 2 || Math.abs(pendingCrop.h) > 2)) {
    cropRect = { ...pendingCrop };
    pendingCrop = null;
    const c = cropRect;
    undoStack.length = 0;
    highlights.length = 0;
    blurRects.length = 0;
    standaloneNumbers.length = 0;
    numberSeq = 0;
    imgWidth = c.w;
    imgHeight = c.h;
    fitAndDraw();
  }
  dragStart = null;
  currentRect = null;
  draw();
});

canvas.addEventListener('mouseleave', () => {
  dragStart = null;
  currentRect = null;
  moveTarget = null;
  moveStart = null;
  draw();
});

document.getElementById('modeHighlight').addEventListener('click', () => { mode = 'highlight'; document.querySelectorAll('.toolbar .btn').forEach(b => b.classList.remove('active')); document.getElementById('modeHighlight').classList.add('active'); });
document.getElementById('modeNumber').addEventListener('click', () => { mode = 'number'; document.querySelectorAll('.toolbar .btn').forEach(b => b.classList.remove('active')); document.getElementById('modeNumber').classList.add('active'); });
document.getElementById('modeBlur').addEventListener('click', () => { mode = 'blur'; document.querySelectorAll('.toolbar .btn').forEach(b => b.classList.remove('active')); document.getElementById('modeBlur').classList.add('active'); });
document.getElementById('modeMove').addEventListener('click', () => { mode = 'move'; document.querySelectorAll('.toolbar .btn').forEach(b => b.classList.remove('active')); document.getElementById('modeMove').classList.add('active'); });
document.getElementById('modeCrop').addEventListener('click', () => { mode = 'crop'; document.querySelectorAll('.toolbar .btn').forEach(b => b.classList.remove('active')); document.getElementById('modeCrop').classList.add('active'); });
document.getElementById('btnUndo').addEventListener('click', undo);

document.getElementById('btnClear').addEventListener('click', () => {
  undoStack.length = 0;
  highlights.length = 0;
  blurRects.length = 0;
  standaloneNumbers.length = 0;
  numberSeq = 0;
  cropRect = null;
  pendingCrop = null;
  if (img) {
    imgWidth = img.naturalWidth;
    imgHeight = img.naturalHeight;
    fitAndDraw();
  }
});

function drawAnnotationsToContext(octx, scaleOut, strokeCol, numberCol, noFill, strokeW, numSz) {
  const lw = Math.max(1, (strokeW || 2) / (scaleOut || 1));
  const nSize = Math.max(8, Math.min(48, parseInt(numSz, 10) || 14));
  highlights.forEach((r) => {
    const x = r.x, y = r.y, w = r.w, h = r.h;
    octx.strokeStyle = strokeCol;
    octx.lineWidth = lw;
    if (!noFill) {
      octx.fillStyle = strokeCol;
      octx.globalAlpha = 0.2;
      octx.fillRect(x, y, w, h);
      octx.globalAlpha = 1;
    }
    octx.strokeRect(x, y, w, h);
  });
  const numRadiusOut = (nSize / 2) * 1.35;
  standaloneNumbers.forEach((n) => {
    octx.beginPath();
    octx.arc(n.x, n.y, numRadiusOut, 0, Math.PI * 2);
    octx.fillStyle = numberCol;
    octx.fill();
    octx.fillStyle = '#fff';
    octx.font = `bold ${nSize}px system-ui`;
    octx.textAlign = 'center';
    octx.textBaseline = 'middle';
    octx.fillText(String(n.n), n.x, n.y);
  });
}

function getAnnotatedImageDataUrl() {
  if (!img) return null;
  const out = document.createElement('canvas');
  const crop = cropRect || { x: 0, y: 0, w: imgWidth, h: imgHeight };
  out.width = crop.w;
  out.height = crop.h;
  const octx = out.getContext('2d');
  octx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
  const blurLevelOut = Math.max(1, Math.min(10, parseInt(annotationColors.blurIntensity, 10) || 5));
  const blurPxOut = blurLevelOut * 8;
  blurRects.forEach((r) => {
    octx.save();
    octx.filter = `blur(${blurPxOut}px)`;
    octx.drawImage(img, crop.x + r.x, crop.y + r.y, r.w, r.h, r.x, r.y, r.w, r.h);
    octx.restore();
  });
  const scaleOut = crop.w / (canvas.width / scale);
  drawAnnotationsToContext(octx, scaleOut, annotationColors.stroke || DEFAULT_COLORS.stroke, annotationColors.number || DEFAULT_COLORS.number, annotationColors.noFill !== false, annotationColors.strokeWidth, annotationColors.numberSize);
  return out.toDataURL('image/png');
}

document.getElementById('btnDownload').addEventListener('click', () => {
  const dataUrl = getAnnotatedImageDataUrl();
  if (!dataUrl) return;
  const a = document.createElement('a');
  a.download = 'shuck-annotated-' + Date.now() + '.png';
  a.href = dataUrl;
  a.click();
});

async function compressImageToJpeg(dataUrl, quality) {
  try {
    const image = new Image();
    await new Promise((res, rej) => { image.onload = res; image.onerror = rej; image.src = dataUrl; });
    const c = document.createElement('canvas');
    c.width = image.naturalWidth;
    c.height = image.naturalHeight;
    c.getContext('2d').drawImage(image, 0, 0);
    return c.toDataURL('image/jpeg', quality);
  } catch (_) {
    return null;
  }
}

document.getElementById('btnSaveToCase')?.addEventListener('click', async () => {
  let dataUrl = getAnnotatedImageDataUrl();
  if (!dataUrl) return;
  const url = getSrc() || pendingPageUrl;
  const title = getSrc() ? 'Annotated screenshot' : (pendingPageTitle ? 'Annotated: ' + pendingPageTitle : 'Annotated image');
  const pendingKey = 'shuck_pending_annotated_' + Date.now();
  try {
    try {
      await chrome.storage.local.set({ [pendingKey]: { imageDataUrl: dataUrl, url, title } });
    } catch (storageErr) {
      // Storage quota hit (often with large PNGs). Try JPEG compression at decreasing quality.
      let compressed = null;
      for (const q of [0.85, 0.7, 0.5, 0.3]) {
        compressed = await compressImageToJpeg(dataUrl, q);
        if (compressed && compressed.length < dataUrl.length * 0.8) break;
      }
      if (!compressed) throw storageErr;
      dataUrl = compressed;
      await chrome.storage.local.set({ [pendingKey]: { imageDataUrl: dataUrl, url, title } });
    }
    const res = await chrome.runtime.sendMessage({
      action: 'addCaptureImageOnly',
      pendingImageKey: pendingKey,
      url,
      title,
      linkToCaptureId: linkToCaptureId || undefined,
    });
    if (res && res.id) {
      alert(linkToCaptureId ? 'Saved as annotation linked to the capture.' : 'Saved to current case.');
    } else {
      alert(res?.error || 'Failed to save.');
    }
  } catch (e) {
    await chrome.storage.local.remove(pendingKey).catch(() => {});
    alert('Failed to save: ' + (e?.message || 'unknown error'));
  }
});

function setupColorInputs() {
  const strokeEl = document.getElementById('colorStroke');
  const numberEl = document.getElementById('colorNumber');
  const noFillEl = document.getElementById('colorNoFill');
  const strokeWidthEl = document.getElementById('strokeWidth');
  const numberSizeEl = document.getElementById('numberSize');
  const strokeWidthVal = document.getElementById('strokeWidthValue');
  const numberSizeVal = document.getElementById('numberSizeValue');
  const blurEl = document.getElementById('blurIntensity');
  function updateColors() {
    if (strokeEl) annotationColors.stroke = strokeEl.value;
    if (numberEl) annotationColors.number = numberEl.value;
    if (noFillEl) annotationColors.noFill = noFillEl.checked;
    if (strokeWidthEl) { annotationColors.strokeWidth = parseInt(strokeWidthEl.value, 10) || 4; if (strokeWidthVal) strokeWidthVal.textContent = annotationColors.strokeWidth; }
    if (numberSizeEl) { annotationColors.numberSize = parseInt(numberSizeEl.value, 10) || 26; if (numberSizeVal) numberSizeVal.textContent = annotationColors.numberSize; }
    if (blurEl) {
      const raw = Math.max(1, Math.min(10, parseInt(blurEl.value, 10) || 5));
      annotationColors.blurIntensity = 11 - raw;
    }
    saveAnnotationColors();
    draw();
  }
  strokeEl?.addEventListener('input', updateColors);
  strokeEl?.addEventListener('change', updateColors);
  numberEl?.addEventListener('input', updateColors);
  numberEl?.addEventListener('change', updateColors);
  noFillEl?.addEventListener('change', updateColors);
  strokeWidthEl?.addEventListener('input', updateColors);
  strokeWidthEl?.addEventListener('change', updateColors);
  numberSizeEl?.addEventListener('input', updateColors);
  numberSizeEl?.addEventListener('change', updateColors);
  blurEl?.addEventListener('input', updateColors);
  blurEl?.addEventListener('change', updateColors);
}

window.addEventListener('resize', () => { if (img) fitAndDraw(); });

loadAnnotationColors().then(() => {
  setupColorInputs();
  if (img) draw();
});
loadImage();
