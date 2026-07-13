export function luminanceFromImage(data, settings) {
  const n = data.length / 4;
  const gray = new Float32Array(n);
  const contrast = settings.contrast ?? 0;
  const brightness = settings.brightness ?? 0;
  const fc = (259 * (contrast + 255)) / (255 * (259 - contrast));
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    let g = data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114;
    g = fc * (g - 128) + 128 + brightness;
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

export function normalizeTones(gray) {
  const sorted = Array.from(gray).sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * 0.03)] ?? 0;
  const hi = sorted[Math.floor(sorted.length * 0.97)] ?? 255;
  const span = Math.max(1, hi - lo);
  const out = new Float32Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    out[i] = clamp(((gray[i] - lo) / span) * 255, 0, 255);
  }
  return out;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function clampInt(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v | 0;
}
