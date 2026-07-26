import { clamp } from './preprocess.js';

export function buildTonalWorkflow(source, gray, regions, w, h, settings) {
  const n = w * h;
  const adjusted = new Uint8ClampedArray(n * 4);
  const grayscale = new Uint8ClampedArray(n * 4);
  const monochrome = new Uint8ClampedArray(n * 4);
  const threshold = new Uint8ClampedArray(n * 4);
  const screen60 = new Uint8ClampedArray(n * 4);
  const final = new Uint8ClampedArray(n * 4);
  const thresholdValue = settings.thresholdValue ?? 128;
  const thresholdFeather = Math.max(0, settings.thresholdFeather ?? 10);
  const monoEnabled = !!settings.monochromeEnabled;
  const thresholdEnabled = !!settings.thresholdEnabled;
  const screenEnabled = !!settings.screen60Enabled;
  const cell = screenCellSize(settings.renderDpi);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const p = i * 4;
      const g = clamp(gray[i], 0, 255);
      const compressed = compressBlack(g, settings.blackCompression ?? settings.shadowCompression ?? 0);
      const reserved = compressed >= 255 - (settings.whiteReserve ?? 0) * 0.7 ? 255 : compressed;
      const monoValue = controlledMono(reserved, thresholdValue, thresholdFeather);
      const thresholdOut = reserved >= thresholdValue ? 255 : 0;
      const screenTarget = selectedForScreen(i, reserved, regions, settings.screenTarget);
      const screened = screenEnabled && screenTarget
        ? screenPixel(x, y, reserved, cell, settings.screenAngle ?? 45)
        : reserved;
      const base = thresholdEnabled ? thresholdOut : monoEnabled ? monoValue : reserved;
      const finalValue = screenEnabled && screenTarget ? (base === 0 ? 0 : screened) : base;

      const sourceGray = Math.max(1, source[p] * 0.299 + source[p + 1] * 0.587 + source[p + 2] * 0.114);
      const ratio = reserved / sourceGray;
      setRgb(adjusted, p, clamp(source[p] * ratio, 0, 255), clamp(source[p + 1] * ratio, 0, 255), clamp(source[p + 2] * ratio, 0, 255));
      setGray(grayscale, p, reserved);
      setGray(monochrome, p, monoValue);
      setGray(threshold, p, thresholdOut);
      setGray(screen60, p, screened);
      setGray(final, p, finalValue);
    }
  }

  return {
    final: final.buffer,
    adjusted: adjusted.buffer,
    grayscale: grayscale.buffer,
    monochrome: monochrome.buffer,
    threshold: threshold.buffer,
    screen60: screen60.buffer,
  };
}

export function screenCellSize(dpi = 300) {
  return Math.max(2, (dpi || 300) / 60);
}

function controlledMono(value, threshold, feather) {
  if (feather <= 0) return value >= threshold ? 255 : 0;
  if (value <= threshold - feather) return 0;
  if (value >= threshold + feather) return 255;
  return 128;
}

function compressBlack(value, amount) {
  const mix = Math.max(0, Math.min(1, amount / 100));
  if (value >= 128) return value;
  const lifted = 128 * Math.pow(value / 128, 0.72);
  return value * (1 - mix) + lifted * mix;
}

function selectedForScreen(i, value, regions, target = 'midtones') {
  if (value < 48 || value > 222) return false;
  if (target === 'architecture') return !!regions.architecture[i];
  if (target === 'water') return !!regions.water[i];
  if (target === 'vegetation') return !!regions.organic[i];
  return true;
}

function screenPixel(x, y, value, cell, angleDegrees) {
  const angle = angleDegrees * Math.PI / 180;
  const u = (x * Math.cos(angle) + y * Math.sin(angle)) / cell;
  const v = (-x * Math.sin(angle) + y * Math.cos(angle)) / cell;
  const fx = u - Math.floor(u) - 0.5;
  const fy = v - Math.floor(v) - 0.5;
  const radius = Math.sqrt(fx * fx + fy * fy);
  const ink = 1 - value / 255;
  return radius < Math.sqrt(ink / Math.PI) ? 0 : 255;
}

function setGray(arr, p, value) {
  setRgb(arr, p, value, value, value);
}

function setRgb(arr, p, r, g, b) {
  arr[p] = r;
  arr[p + 1] = g;
  arr[p + 2] = b;
  arr[p + 3] = 255;
}
