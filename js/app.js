import { downloadConfig, downloadPng, downloadProjectZip, safeBaseName } from './export.js';
import { DEFAULT_SETTINGS, EXPORT_FORMATS, PRESETS } from './presets.js';
import { cloneSettings, HistoryStack, loadCustomPresets, loadSettings, saveCustomPreset, saveSettings } from './state.js';
import {
  drawImageToCanvas,
  drawLayerToCanvas,
  enableImageActions,
  initControls,
  initViewer,
  renderPresets,
  setBusy,
  setStatus,
  syncControls,
  updateExportEstimate,
  updateCompare,
} from './ui.js';

let settings = loadSettings();
let history = new HistoryStack(settings);
let customPresets = loadCustomPresets();
let sourceImage = null;
let sourceName = '';
let latestRender = null;
let worker = createWorker();
let jobSeq = 0;
let activeJob = null;
let renderTimer = 0;
const viewerTools = initViewer();

initControls(settings, {
  onSelect: (key, value) => updateSetting(key, value, true),
  onInput: (key, value) => updateSetting(key, value, false),
  onCommit: (key, value) => updateSetting(key, value, true),
});
renderPresets(customPresets, settings.preset, applyPreset);
wireEvents();
syncControls(settings);
updateExportEstimate(currentFormat());
setStatus(workerSupportsOffscreen() ? 'Listo. Worker activo; OffscreenCanvas disponible para futuras optimizaciones.' : 'Listo. Worker activo con pipeline ImageData.', 0);

function wireEvents() {
  const drop = document.getElementById('drop');
  const file = document.getElementById('file');
  const openPicker = () => {
    file.value = '';
    file.click();
  };
  drop.addEventListener('click', openPicker);
  drop.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker();
    }
  });
  ['dragenter', 'dragover'].forEach(type => drop.addEventListener(type, event => {
    event.preventDefault();
    drop.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach(type => drop.addEventListener(type, event => {
    event.preventDefault();
    drop.classList.remove('over');
  }));
  drop.addEventListener('drop', event => {
    const image = event.dataTransfer.files[0];
    if (image) loadImage(image);
  });
  file.addEventListener('change', () => {
    if (file.files[0]) loadImage(file.files[0]);
  });

  document.getElementById('compareSlider').addEventListener('input', event => updateCompare(Number(event.target.value)));
  document.getElementById('cancelJob').addEventListener('click', cancelActiveJob);
  document.getElementById('downloadFinal').addEventListener('click', downloadCurrentFinal);
  document.getElementById('downloadZip').addEventListener('click', exportZip);
  document.getElementById('exportConfig').addEventListener('click', () => downloadConfig(settings, sourceName));
  document.getElementById('importConfig').addEventListener('change', importConfig);
  document.getElementById('resetSettings').addEventListener('click', () => {
    settings = { ...cloneSettings(DEFAULT_SETTINGS), ...cloneSettings(PRESETS[0].settings) };
    settings.preset = PRESETS[0].id;
    commitSettings();
  });
  document.getElementById('savePreset').addEventListener('click', () => {
    const name = prompt('Nombre del preset personalizado');
    if (!name) return;
    const preset = saveCustomPreset(name, settings);
    customPresets = [...customPresets, preset];
    renderPresets(customPresets, preset.id, applyPreset);
  });
  document.getElementById('undoBtn').addEventListener('click', () => {
    const previous = history.undo();
    if (previous) {
      settings = previous;
      saveSettings(settings);
      syncControls(settings);
      schedulePreview();
    }
  });
  document.getElementById('redoBtn').addEventListener('click', () => {
    const next = history.redo();
    if (next) {
      settings = next;
      saveSettings(settings);
      syncControls(settings);
      schedulePreview();
    }
  });
  document.getElementById('newProject').addEventListener('click', () => {
    sourceImage = null;
    sourceName = '';
    latestRender = null;
    enableImageActions(false);
    document.getElementById('emptyState').hidden = false;
    document.getElementById('resultCanvas').hidden = true;
    document.getElementById('originalCanvas').hidden = true;
    document.getElementById('compareMask').hidden = true;
    setStatus('Proyecto nuevo. Carga una imagen para empezar.', 0);
  });
}

function updateSetting(key, value, commit) {
  settings = { ...settings, [key]: value, preset: commit ? settings.preset : 'custom-live' };
  saveSettings(settings);
  if (commit) history.push(settings);
  if (key === 'exportFormat') updateExportEstimate(currentFormat(), sourceImage ? exportDimensions() : null);
  schedulePreview();
}

function commitSettings() {
  saveSettings(settings);
  history.push(settings);
  syncControls(settings);
  renderPresets(customPresets, settings.preset, applyPreset);
  updateExportEstimate(currentFormat(), sourceImage ? exportDimensions() : null);
  schedulePreview();
}

function applyPreset(preset) {
  settings = { ...settings, ...cloneSettings(preset.settings), preset: preset.id };
  commitSettings();
}

function loadImage(file) {
  if (!file.type.startsWith('image/')) {
    setStatus('El archivo no es una imagen compatible.', 0, 'error');
    return;
  }
  sourceName = file.name;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    sourceImage = img;
    latestRender = null;
    document.getElementById('emptyState').hidden = true;
    document.getElementById('resultCanvas').hidden = false;
    document.getElementById('originalCanvas').hidden = false;
    document.getElementById('compareMask').hidden = false;
    viewerTools.reset();
    updateExportEstimate(currentFormat(), exportDimensions());
    schedulePreview(true);
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    setStatus('No se pudo leer la imagen. Prueba con JPG, PNG o WebP.', 0, 'error');
  };
  img.src = url;
}

function schedulePreview(immediate = false) {
  if (!sourceImage) return;
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => renderPreview(), immediate ? 0 : 180);
}

async function renderPreview() {
  if (!sourceImage) return;
  try {
    const imageData = sourceToImageData('preview');
    drawImageToCanvas(document.getElementById('originalCanvas'), sourceImage, imageData.width, imageData.height);
    const render = await runWorkerRender(imageData, settings, 'Vista previa');
    latestRender = render;
    drawLayerToCanvas(document.getElementById('resultCanvas'), render.layers.final, render.width, render.height);
    enableImageActions(true);
    updateCompare(Number(document.getElementById('compareSlider').value));
    setStatus(`Vista previa v5 · ${render.width}x${render.height}px · ${settings.sceneType}`, 100);
  } catch (error) {
    setStatus(error.message || 'Error al procesar la vista previa.', 0, 'error');
  }
}

async function downloadCurrentFinal() {
  if (!sourceImage) return;
  try {
    const format = currentFormat();
    const dims = exportDimensions();
    guardExportSize(format, dims);
    const imageData = sourceToImageData('export');
    const render = await runWorkerRender(imageData, settings, `Exportando PNG ${format.label}`);
    await downloadPng(
      render.layers.final,
      render.width,
      render.height,
      `${safeBaseName(sourceName || 'fondo-manga')}-resultado-final.png`,
    );
    setStatus(`PNG final exportado · ${render.width}x${render.height}px`, 100);
  } catch (error) {
    setStatus(error.message || 'No se pudo descargar el PNG.', 0, 'error');
  }
}

async function exportZip() {
  if (!sourceImage) return;
  try {
    const format = EXPORT_FORMATS.find(f => f.value === settings.exportFormat) || EXPORT_FORMATS[0];
    const dims = exportDimensions();
    guardExportSize(format, dims);
    const estimatedPixels = dims.w * dims.h;
    const estimatedMb = Math.round((estimatedPixels * 4 * 9) / 1024 / 1024);
    if (format.highResolution || estimatedPixels > 12000000) {
      setStatus(`${format.label}: alta resolución, ${dims.w}x${dims.h}px, memoria estimada ${estimatedMb} MB. Puedes cancelar si tarda.`, 0, 'busy');
    }
    const imageData = sourceToImageData('export');
    const render = await runWorkerRender(imageData, settings, `Exportando ${format.label}`);
    await downloadProjectZip(render, settings, sourceName);
    setStatus('ZIP de capas exportado.', 100);
  } catch (error) {
    setStatus(error.message || 'No se pudo exportar el ZIP.', 0, 'error');
  }
}

async function importConfig(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const json = JSON.parse(await file.text());
    settings = { ...settings, ...(json.settings || json) };
    commitSettings();
    setStatus('Configuración importada.', 100);
  } catch {
    setStatus('El JSON de configuración no es válido.', 0, 'error');
  } finally {
    event.target.value = '';
  }
}

function runWorkerRender(imageData, currentSettings, label) {
  cancelActiveJob(false);
  const jobId = ++jobSeq;
  activeJob = jobId;
  setBusy(true);
  setStatus(`${label}: preparando`, 1, 'busy');
  return new Promise((resolve, reject) => {
    worker.onmessage = event => {
      const msg = event.data;
      if (msg.jobId !== jobId) return;
      if (msg.type === 'progress') {
        setStatus(`${label}: ${msg.label}`, msg.progress, 'busy');
      } else if (msg.type === 'result') {
        activeJob = null;
        setBusy(false);
        resolve(msg.result);
      } else if (msg.type === 'error') {
        activeJob = null;
        setBusy(false);
        reject(new Error(msg.message));
      }
    };
    worker.onerror = event => {
      activeJob = null;
      setBusy(false);
      reject(new Error(event.message || 'El worker falló.'));
    };
    worker.postMessage({ type: 'render', jobId, imageData, settings: currentSettings }, [imageData.data.buffer]);
  });
}

function cancelActiveJob(showMessage = true) {
  if (!activeJob) return;
  worker.terminate();
  worker = createWorker();
  activeJob = null;
  setBusy(false);
  if (showMessage) setStatus('Procesamiento cancelado.', 0);
}

function createWorker() {
  return new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
}

function sourceToImageData(mode) {
  const { w, h } = mode === 'export' ? exportDimensions() : previewDimensions();
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas no disponible en este navegador.');
  ctx.drawImage(sourceImage, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

function previewDimensions() {
  const cap = window.innerWidth < 760 ? 1050 : 1450;
  return dimensionsForLongSide(cap);
}

function exportDimensions() {
  const format = currentFormat();
  return dimensionsForLongSide(format.px);
}

function currentFormat() {
  return EXPORT_FORMATS.find(f => f.value === settings.exportFormat) || EXPORT_FORMATS[0];
}

function guardExportSize(format, dims) {
  const estimatedPixels = dims.w * dims.h;
  const estimatedMb = Math.round((estimatedPixels * 4 * 9) / 1024 / 1024);
  if (estimatedPixels > 36000000) {
    throw new Error(`${format.label} requiere aproximadamente ${estimatedMb} MB durante el render. Prueba A5 600dpi, A4 450dpi o A4 300dpi.`);
  }
}

function dimensionsForLongSide(longSide) {
  const iw = sourceImage.naturalWidth || sourceImage.width;
  const ih = sourceImage.naturalHeight || sourceImage.height;
  const aspect = iw / ih;
  if (aspect >= 1) return { w: longSide, h: Math.max(1, Math.round(longSide / aspect)) };
  return { w: Math.max(1, Math.round(longSide * aspect)), h: longSide };
}

function workerSupportsOffscreen() {
  return typeof OffscreenCanvas !== 'undefined';
}
