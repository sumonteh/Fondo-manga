import { boxBlur } from './preprocess.js';
import { cleanLineLayers } from './line-cleanup.js';

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
  const mainIntensity = (settings.mainLine ?? 70) / 100;
  const secondaryIntensity = (settings.secondaryLine ?? 65) / 100;
  const fineIntensity = (settings.fineDetail ?? 40) / 100;
  const clean = settings.cleanup / 100;
  const far = settings.farDetail / 100;

  for (let y = 1; y < h - 1; y++) {
    const depth = depthFactor(y, h, settings, far);
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const sky = regions.sky[i];
      const organic = regions.organic[i];
      const architecture = regions.architecture[i];
      const water = regions.water[i];
      const lightTrail = regions.lightTrail[i];
      const dogMain = Math.abs(blur6[i] - blur1[i]);
      const dogFine = Math.abs(blur3[i] - blur1[i]);
      const straightBoost = architecture ? 0.64 : 1;
      const skyPenalty = sky ? 2.3 : 1;
      const waterPenalty = water ? 1.35 : 1;
      const organicBoost = organic ? 0.85 : 1;
      const tMain = (22 + clean * 40 - mainIntensity * 18) * depth * straightBoost * skyPenalty * waterPenalty;
      const tSec = (12 + clean * 24 - secondaryIntensity * 12 - baseDetail * 5) * depth * organicBoost * skyPenalty * (water ? 1.15 : 1);
      const tFine = (9 + clean * 28 - fineIntensity * 12 - baseDetail * 7) * depth * skyPenalty * (water ? 1.7 : 1);
      if (lightTrail || sob.mag[i] > tMain * 6.2 || dogMain > tMain) main[i] = 1;
      else if (sob.mag[i] > tSec * 4.8 || dogFine > tSec || (architecture && sob.mag[i] > tSec * 3.2)) secondary[i] = 1;
      else if (!sky && !water && sob.mag[i] > tFine * 4.2 && fineIntensity > 0.08 && baseDetail > 0.28) detail[i] = 1;
    }
  }

  removeSpecks(main, w, h, settings.cleanup > 60 ? 2 : 1);
  removeSpecks(secondary, w, h, settings.cleanup > 78 ? 2 : 1);
  removeSpecks(detail, w, h, settings.cleanup > 64 ? 2 : 1);
  if (settings.edgeContinuity > 35) bridgeSmallGaps(main, w, h);
  if (settings.edgeContinuity > 55) bridgeSmallGaps(secondary, w, h);

  dilate(main, w, h, Math.max(0, settings.mainLineWeight ?? 2));
  dilate(secondary, w, h, Math.max(0, settings.secondaryLineWeight ?? 1));
  dilate(detail, w, h, Math.max(0, settings.fineDetailWeight ?? 0));
  return cleanLineLayers({ main, secondary, detail, magnitude: sob.mag }, w, h, settings, regions);
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
