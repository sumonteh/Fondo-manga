import { CONTROL_DEFS, EXPORT_FORMATS, PRESETS, SCENE_TYPES, SCREEN_TARGETS, TEXTURE_MODES, WORKFLOW_MODES } from './presets.js';

const CHECKBOX_IDS = [
  'depthEnabled',
  'skyProtect',
  'architectureBoost',
  'organicRegions',
  'waterClean',
  'preserveLightTrails',
  'showMainLine',
  'showSecondaryLine',
  'showFineDetail',
  'blueSketch',
  'grayscaleEnabled',
  'shadowsEnabled',
  'vegetationEnabled',
  'lightsEnabled',
  'monochromeEnabled',
  'thresholdEnabled',
  'screen60Enabled',
];

export function initControls(settings, callbacks) {
  fillSelect('sceneType', SCENE_TYPES, settings.sceneType, callbacks.onSelect);
  fillSelect('exportFormat', EXPORT_FORMATS, settings.exportFormat, callbacks.onSelect);
  fillSelect('textureMode', TEXTURE_MODES, settings.textureMode, callbacks.onSelect);
  fillSelect('workflowMode', WORKFLOW_MODES, settings.workflowMode, callbacks.onSelect);
  fillSelect('screenTarget', SCREEN_TARGETS, settings.screenTarget, callbacks.onSelect);

  document.querySelectorAll('.control').forEach(node => {
    const key = node.dataset.key;
    const def = CONTROL_DEFS[key];
    node.innerHTML = `
      <div class="row"><label for="${key}">${def.label}</label><output id="${key}Out">${settings[key]}</output></div>
      <input id="${key}" type="range" min="${def.min}" max="${def.max}" step="${def.step}" value="${settings[key]}">
    `;
    node.querySelector('input').addEventListener('input', event => {
      document.getElementById(`${key}Out`).textContent = event.target.value;
      callbacks.onInput(key, Number(event.target.value));
    });
    node.querySelector('input').addEventListener('change', event => callbacks.onCommit(key, Number(event.target.value)));
  });

  CHECKBOX_IDS.forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;
    input.checked = !!settings[id];
    input.addEventListener('change', event => callbacks.onCommit(id, event.target.checked));
  });

  document.querySelectorAll('.tabs button').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
      button.classList.add('active');
      document.getElementById(`tab-${button.dataset.tab}`)?.classList.add('active');
    });
  });
}

export function renderPresets(customPresets, currentId, onSelect) {
  const grid = document.getElementById('presetGrid');
  grid.innerHTML = '';
  [...PRESETS, ...customPresets].forEach(preset => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = preset.name;
    button.className = preset.id === currentId ? 'active' : '';
    button.addEventListener('click', () => onSelect(preset));
    grid.append(button);
  });
}

export function syncControls(settings) {
  Object.keys(CONTROL_DEFS).forEach(key => {
    const input = document.getElementById(key);
    const out = document.getElementById(`${key}Out`);
    if (input) input.value = settings[key];
    if (out) out.textContent = settings[key];
  });
  ['sceneType', 'exportFormat', 'textureMode', 'workflowMode', 'screenTarget'].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.value = settings[id];
  });
  CHECKBOX_IDS.forEach(id => {
    const input = document.getElementById(id);
    if (input) input.checked = !!settings[id];
  });
}

export function updateExportEstimate(format, dimensions = null) {
  const target = document.getElementById('exportEstimate');
  if (!target || !format) return;
  const pixels = dimensions ? dimensions.w * dimensions.h : format.px * Math.round(format.px / 1.414);
  const mb = Math.round((pixels * 4 * 12) / 1024 / 1024);
  const size = dimensions ? `${dimensions.w}x${dimensions.h}px` : `lado mayor ${format.px}px`;
  const warning = format.highResolution ? ' · Alta resolución: más memoria y tiempo' : '';
  target.textContent = `${format.label} · ${size} · memoria estimada ${mb} MB${warning}`;
  target.classList.toggle('warning', !!format.highResolution);
  const screen = document.getElementById('screenEstimate');
  if (screen) {
    const dpi = format.dpi || 300;
    screen.textContent = `60L · ${dpi} dpi · celda ${formatNumber(dpi / 60)} px`;
  }
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function setStatus(text, progress = null, mode = 'ready') {
  document.getElementById('statusText').textContent = text;
  const pill = document.getElementById('workerStatus');
  pill.textContent = mode === 'busy' ? 'Procesando' : mode === 'error' ? 'Error' : 'Motor listo';
  pill.className = `status-pill ${mode === 'busy' ? 'busy' : mode === 'error' ? 'error' : ''}`;
  if (progress !== null) {
    document.getElementById('progressBar').value = progress;
    document.getElementById('progressText').textContent = `${Math.round(progress)}%`;
  }
}

export function setBusy(isBusy) {
  document.getElementById('cancelJob').disabled = !isBusy;
}

export function enableImageActions(enabled) {
  document.getElementById('downloadFinal').disabled = !enabled;
  document.getElementById('downloadZip').disabled = !enabled;
  document.getElementById('compareSlider').disabled = !enabled;
}

export function drawLayerToCanvas(canvas, layerBuffer, w, h) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible.');
  canvas.width = w;
  canvas.height = h;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(layerBuffer), w, h), 0, 0);
  resizeCanvasDisplay(canvas, w, h);
}

export function drawImageToCanvas(canvas, image, w, h) {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible.');
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(image, 0, 0, w, h);
  resizeCanvasDisplay(canvas, w, h);
}

export function updateCompare(value) {
  const original = document.getElementById('originalCanvas');
  const mask = document.getElementById('compareMask');
  original.style.clipPath = `inset(0 ${100 - value}% 0 0)`;
  mask.hidden = value <= 0 || value >= 100;
  mask.style.left = `calc(6px + ${value}%)`;
}

export function initViewer() {
  const frame = document.getElementById('frame');
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const paint = () => {
    frame.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    document.getElementById('zoomLabel').textContent = `${Math.round(zoom * 100)}%`;
  };
  const setZoom = value => {
    zoom = Math.min(3, Math.max(0.35, value));
    paint();
  };

  document.getElementById('zoomIn').addEventListener('click', () => setZoom(zoom + 0.15));
  document.getElementById('zoomOut').addEventListener('click', () => setZoom(zoom - 0.15));
  document.getElementById('fitBtn').addEventListener('click', () => { zoom = 1; panX = 0; panY = 0; paint(); });
  document.getElementById('panReset').addEventListener('click', () => { panX = 0; panY = 0; paint(); });
  frame.addEventListener('pointerdown', event => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    frame.setPointerCapture(event.pointerId);
  });
  frame.addEventListener('pointermove', event => {
    if (!dragging) return;
    panX += event.clientX - lastX;
    panY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    paint();
  });
  frame.addEventListener('pointerup', () => { dragging = false; });
  return { reset: () => { zoom = 1; panX = 0; panY = 0; paint(); } };
}

function fillSelect(id, options, value, onSelect) {
  const select = document.getElementById(id);
  select.innerHTML = '';
  for (const option of options) {
    const el = document.createElement('option');
    el.value = option.value;
    el.textContent = option.label;
    select.append(el);
  }
  select.value = value;
  select.addEventListener('change', event => onSelect(id, event.target.value));
}

function resizeCanvasDisplay(canvas, w, h) {
  const maxW = Math.min(900, window.innerWidth > 900 ? window.innerWidth - 460 : window.innerWidth * 0.84);
  const maxH = window.innerHeight * (window.innerWidth > 900 ? 0.72 : 0.62);
  const scale = Math.min(1, maxW / w, maxH / h);
  canvas.style.width = `${Math.round(w * scale)}px`;
  canvas.style.height = `${Math.round(h * scale)}px`;
}
