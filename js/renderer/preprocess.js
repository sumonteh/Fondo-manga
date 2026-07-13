export function luminanceFromImage(data, settings) {
  const n = data.length / 4;
  const gray = new Float32Array(n);
  const contrast = settings.contrast ?? 0;
  const brightness = settings.brightness ?? 0;
  const value = settings.value ?? 0;
  const fc = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const pivot = 128 + value * 0.9;
  const black = Math.min((settings.blackPoint ?? 0), (settings.whitePoint ?? 255) - 2);
  const white = Math.max((settings.whitePoint ?? 255), black + 2);
  const gamma = Math.max(0.4, (settings.gamma ?? 100) / 100);
  const grayMix = settings.grayscaleEnabled === false ? 0 : (settings.grayscaleMix ?? 100) / 100;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const perceptual = data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114;
    const neutral = (data[p] + data[p + 1] + data[p + 2]) / 3;
    let g = neutral * (1 - grayMix) + perceptual * grayMix;
    g = fc * (g - pivot) + pivot + brightness + value * 0.55;
    g = clamp((g - black) * 255 / (white - black), 0, 255);
    g = 255 * Math.pow(g / 255, 1 / gamma);
    gray[i] = clamp(g, 0, 255);
  }
  return gray;
}

export function boxBlur(src, w, h, radius) {
  if (radius <= 0) return new Float32Array(src);
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const size = radius * 2 + 1;

  for (let y = 0; y < h; y++) {
    let sum = 0;
    const row = y * w;
    for (let x = -radius; x <= radius; x++) sum += src[row + clampInt(x, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / size;
      const oldX = clampInt(x - radius, 0, w - 1);
      const newX = clampInt(x + radius + 1, 0, w - 1);
      sum += src[row + newX] - src[row + oldX];
    }
  }

  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -radius; y <= radius; y++) sum += tmp[clampInt(y, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / size;
      const oldY = clampInt(y - radius, 0, h - 1);
      const newY = clampInt(y + radius + 1, 0, h - 1);
      sum += tmp[newY * w + x] - tmp[oldY * w + x];
    }
  }
  return out;
}

export function edgePreservingSmooth(gray, w, h, cleanup) {
  const radius = cleanup > 70 ? 3 : cleanup > 42 ? 2 : 1;
  const blur = boxBlur(gray, w, h, radius);
  const out = new Float32Array(gray.length);
  const edgeKeep = 18 + (100 - cleanup) * 0.45;
  for (let i = 0; i < gray.length; i++) {
    const diff = Math.abs(gray[i] - blur[i]);
    const mix = diff > edgeKeep ? 0.28 : 0.82;
    out[i] = gray[i] * (1 - mix) + blur[i] * mix;
  }
  return out;
}

export function normalizeTones(gray, settings = {}) {
  const sorted = Array.from(gray).sort((a, b) => a - b);
  const softness = (settings.toneSoftness ?? 55) / 100;
  const loPct = 0.01 + (1 - softness) * 0.035;
  const hiPct = 0.99 - (1 - softness) * 0.035;
  const lo = sorted[Math.floor(sorted.length * loPct)] ?? 0;
  const hi = sorted[Math.floor(sorted.length * hiPct)] ?? 255;
  const span = Math.max(1, hi - lo);
  const out = new Float32Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    const normalized = ((gray[i] - lo) / span) * 255;
    out[i] = clamp(gray[i] * softness + normalized * (1 - softness), 0, 255);
  }
  return out;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function clampInt(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v | 0;
}
