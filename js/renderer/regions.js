import { sobel } from './edges.js';

export function classifyRegions(gray, w, h, settings) {
  const sky = new Uint8Array(w * h);
  const architecture = new Uint8Array(w * h);
  const organic = new Uint8Array(w * h);
  const water = new Uint8Array(w * h);
  const smoothSurface = new Uint8Array(w * h);
  const lightTrail = new Uint8Array(w * h);
  const deepShadow = new Uint8Array(w * h);
  const edges = sobel(gray, w, h).mag;

  for (let y = 0; y < h; y++) {
    const yt = y / Math.max(1, h - 1);
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const g = gray[i];
      const e = edges[i];
      const skyBias = (settings.skyInfluence ?? 100) / 100;
      const architectureBias = (settings.architectureInfluence ?? 100) / 100;
      const waterBias = (settings.waterInfluence ?? 100) / 100;
      const organicBias = (settings.vegetationInfluence ?? 100) / 100;
      if (settings.skyProtect && skyBias > 0 && yt < 0.46 && g > 178 - skyBias * 24 && e < 65 + skyBias * 28) sky[i] = 1;
      if (settings.architectureBoost && architectureBias > 0 && e > 38 - architectureBias * 14 && isLikelyStructural(edges, w, h, x, y)) architecture[i] = 1;
      if (settings.organicRegions && settings.vegetationEnabled !== false && organicBias > 0 && e > 22 && e < 135 && localVariance(gray, w, h, x, y) > 280 - organicBias * 120) organic[i] = 1;
      if ((settings.sceneType === 'riverbank' || settings.waterClean) && waterBias > 0 && yt > 0.50 && g > 110 - waterBias * 24 && e < 48 + waterBias * 18) water[i] = 1;
      if (settings.preserveLightTrails && settings.lightsEnabled !== false && g > 210 && e > 34 && yt > 0.28) lightTrail[i] = 1;
      if (settings.shadowsEnabled !== false && g < 54 && !sky[i] && !water[i]) deepShadow[i] = 1;
      if (!organic[i] && e < 28 && g > 132) smoothSurface[i] = 1;
    }
  }

  if (settings.sceneType === 'vegetation') {
    for (let i = 0; i < organic.length; i++) if (!sky[i]) organic[i] = 1;
  }
  if (settings.sceneType === 'interior') {
    sky.fill(0);
  }

  return { sky, architecture, organic, water, smoothSurface, lightTrail, deepShadow };
}

function isLikelyStructural(edges, w, h, x, y) {
  if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) return false;
  const i = y * w + x;
  const horizontal = edges[i - 2] + edges[i - 1] + edges[i + 1] + edges[i + 2];
  const vertical = edges[i - 2 * w] + edges[i - w] + edges[i + w] + edges[i + 2 * w];
  const diagA = edges[i - 2 * w - 2] + edges[i - w - 1] + edges[i + w + 1] + edges[i + 2 * w + 2];
  const diagB = edges[i - 2 * w + 2] + edges[i - w + 1] + edges[i + w - 1] + edges[i + 2 * w - 2];
  return horizontal > 125 || vertical > 125 || diagA > 145 || diagB > 145;
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
