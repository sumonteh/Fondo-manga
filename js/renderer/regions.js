import { sobel } from './edges.js';

export function classifyRegions(gray, w, h, settings) {
  const sky = new Uint8Array(w * h);
  const architecture = new Uint8Array(w * h);
  const organic = new Uint8Array(w * h);
  const water = new Uint8Array(w * h);
  const smoothSurface = new Uint8Array(w * h);
  const edges = sobel(gray, w, h).mag;

  for (let y = 0; y < h; y++) {
    const yt = y / Math.max(1, h - 1);
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const g = gray[i];
      const e = edges[i];
      if (settings.skyProtect && yt < 0.42 && g > 172 && e < 75) sky[i] = 1;
      if (settings.architectureBoost && e > 38 && isLikelyStraight(edges, w, h, x, y)) architecture[i] = 1;
      if (settings.organicRegions && e > 22 && e < 125 && localVariance(gray, w, h, x, y) > 180) organic[i] = 1;
      if (settings.sceneType === 'riverbank' && yt > 0.48 && g > 116 && e < 42) water[i] = 1;
      if (!organic[i] && e < 28 && g > 132) smoothSurface[i] = 1;
    }
  }

  if (settings.sceneType === 'vegetation') {
    for (let i = 0; i < organic.length; i++) if (!sky[i]) organic[i] = 1;
  }
  if (settings.sceneType === 'interior') {
    sky.fill(0);
  }

  return { sky, architecture, organic, water, smoothSurface };
}

function isLikelyStraight(edges, w, h, x, y) {
  if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) return false;
  const i = y * w + x;
  const horizontal = edges[i - 2] + edges[i - 1] + edges[i + 1] + edges[i + 2];
  const vertical = edges[i - 2 * w] + edges[i - w] + edges[i + w] + edges[i + 2 * w];
  return horizontal > 170 || vertical > 170;
}

function localVariance(gray, w, h, x, y) {
  if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) return 0;
  let sum = 0;
  let sum2 = 0;
  let n = 0;
  for (let yy = y - 2; yy <= y + 2; yy++) {
    for (let xx = x - 2; xx <= x + 2; xx++) {
      const v = gray[yy * w + xx];
      sum += v;
      sum2 += v * v;
      n++;
    }
  }
  const mean = sum / n;
  return sum2 / n - mean * mean;
}
