import { boxBlur } from './preprocess.js';

export function sobel(gray, w, h) {
  const mag = new Float32Array(w * h);
  const angle = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    const r0 = (y - 1) * w;
    const r1 = y * w;
    const r2 = (y + 1) * w;
    for (let x = 1; x < w - 1; x++) {
      const gx = -gray[r0 + x - 1] - 2 * gray[r1 + x - 1] - gray[r2 + x - 1]
        + gray[r0 + x + 1] + 2 * gray[r1 + x + 1] + gray[r2 + x + 1];
      const gy = -gray[r0 + x - 1] - 2 * gray[r0 + x] - gray[r0 + x + 1]
        + gray[r2 + x - 1] + 2 * gray[r2 + x] + gray[r2 + x + 1];
      const i = r1 + x;
      mag[i] = Math.sqrt(gx * gx + gy * gy);
      angle[i] = Math.atan2(gy, gx);
    }
  }
  return { mag, angle };
}

export function multiScaleEdges(gray, w, h, settings, regions) {
  const blur1 = boxBlur(gray, w, h, 1);
  const blur3 = boxBlur(gray, w, h, 3);
  const blur6 = boxBlur(gray, w, h, 6);
  const sob = sobel(blur1, w, h);
  const main = new Uint8Array(w * h);
  const secondary = new Uint8Array(w * h);
  const detail = new Uint8Array(w * h);
  const baseDetail = settings.detail / 100;
  const clean = settings.cleanup / 100;
  const far = settings.farDetail / 100;

  for (let y = 1; y < h - 1; y++) {
    const depth = depthFactor(y, h, settings, far);
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const sky = regions.sky[i];
      const organic = regions.organic[i];
      const dogMain = Math.abs(blur6[i] - blur1[i]);
      const dogFine = Math.abs(blur3[i] - blur1[i]);
      const straightBoost = regions.architecture[i] ? 0.82 : 1;
      const skyPenalty = sky ? 1.85 : 1;
      const organicBoost = organic ? 0.85 : 1;
      const tMain = (18 + clean * 35 - baseDetail * 11) * depth * straightBoost * skyPenalty;
      const tSec = (10 + clean * 28 - baseDetail * 9) * depth * organicBoost * skyPenalty;
      const tFine = (7 + clean * 26 - baseDetail * 12) * depth * skyPenalty;
      if (sob.mag[i] > tMain * 7 || dogMain > tMain) main[i] = 1;
      else if (sob.mag[i] > tSec * 6 || dogFine > tSec) secondary[i] = 1;
      else if (sob.mag[i] > tFine * 5 && baseDetail > 0.4) detail[i] = 1;
    }
  }

  removeSpecks(main, w, h, settings.cleanup > 60 ? 2 : 1);
  removeSpecks(secondary, w, h, settings.cleanup > 70 ? 2 : 1);
  if (settings.edgeContinuity > 35) bridgeSmallGaps(main, w, h);

  dilate(main, w, h, Math.max(0, settings.mainLine));
  dilate(secondary, w, h, Math.max(0, settings.secondaryLine));
  return { main, secondary, detail, magnitude: sob.mag };
}

function depthFactor(y, h, settings, farDetail) {
  if (!settings.depthEnabled) return 1;
  const t = y / Math.max(1, h - 1);
  if (t < 0.34) return 1.2 - farDetail * 0.55;
  if (t > 0.72) return 0.82;
  return 1;
}

function removeSpecks(mask, w, h, minNeighbors) {
  const copy = new Uint8Array(mask);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!copy[i]) continue;
      const n = copy[i - 1] + copy[i + 1] + copy[i - w] + copy[i + w]
        + copy[i - w - 1] + copy[i - w + 1] + copy[i + w - 1] + copy[i + w + 1];
      if (n < minNeighbors) mask[i] = 0;
    }
  }
}

function bridgeSmallGaps(mask, w, h) {
  const copy = new Uint8Array(mask);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (copy[i]) continue;
      if ((copy[i - 1] && copy[i + 1]) || (copy[i - w] && copy[i + w])) mask[i] = 1;
    }
  }
}

function dilate(mask, w, h, passes) {
  const iterations = Math.min(8, Math.round(passes));
  for (let p = 0; p < iterations; p++) {
    const copy = new Uint8Array(mask);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (copy[i] || copy[i - 1] || copy[i + 1] || copy[i - w] || copy[i + w]) mask[i] = 1;
      }
    }
  }
}
