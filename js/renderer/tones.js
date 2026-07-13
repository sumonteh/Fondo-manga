export function simplifyTones(gray, w, h, settings, regions) {
  const levels = new Uint8Array(w * h);
  const shadows = new Uint8Array(w * h);
  const blacks = new Uint8Array(w * h);
  const whiteCut = 142 + settings.whiteReserve * 0.95;
  const shadowCut = 126 - settings.shadowThreshold * 0.48;
  const blackCut = 10 + settings.blackMass * 0.44;
  const hardness = settings.transitionHardness / 100;
  const softness = settings.toneSoftness / 100;
  const count = Math.max(3, Math.min(5, settings.toneCount | 0));
  const posterize = (settings.posterization ?? 20) / 100;
  const threshold = (settings.thresholdMix ?? 0) / 100;
  const compression = (settings.shadowCompression ?? 50) / 100;
  const blackScores = [];

  for (let y = 0; y < h; y++) {
    const depth = settings.depthEnabled ? y / Math.max(1, h - 1) : 0.5;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let g = gray[i];
      if (regions.sky[i]) g += 70 * ((settings.skyInfluence ?? 100) / 100);
      if (regions.water[i]) g += (settings.waterClean ? 48 : 20) * ((settings.waterInfluence ?? 100) / 100);
      if (regions.architecture[i]) g += 24 * ((settings.architectureInfluence ?? 100) / 100);
      if (regions.organic[i]) g -= 10 + settings.blackMass * 0.10;
      if (depth < 0.34) g += settings.farDetail * 0.25;
      if (depth > 0.72) g -= settings.blackMass * 0.04;
      const usefulStructure = regions.architecture[i] || regions.lightTrail[i];

      const continuous = Math.max(0, Math.min(count - 1, (whiteCut - g) / Math.max(1, whiteCut - blackCut) * (count - 1)));
      const stepped = Math.round(continuous);
      const toneLevel = Math.round(continuous * (1 - posterize) + stepped * posterize);
      if (g >= whiteCut) levels[i] = 0;
      else if (!usefulStructure && !regions.water[i] && !regions.sky[i] && g <= blackCut) {
        levels[i] = Math.max(2, Math.min(4, toneLevel));
        blackScores.push([i, g]);
      }
      else if (g <= shadowCut) levels[i] = usefulStructure ? 2 : 3;
      else if (count <= 3) levels[i] = g > (whiteCut + shadowCut) / 2 ? 1 : 3;
      else if (count === 4) levels[i] = g > (whiteCut + shadowCut) / 2 ? 1 : 2;
      else {
        const t = (whiteCut - g) / Math.max(1, whiteCut - blackCut);
        levels[i] = Math.min(3, Math.max(1, Math.round(1 + t * (2.0 + hardness - softness * 0.75))));
      }
      if (settings.shadowsEnabled !== false && regions.deepShadow[i] && !regions.sky[i] && !regions.water[i]) shadows[i] = 1;
      if (threshold > 0 && g < shadowCut - threshold * 34 && !usefulStructure && !regions.water[i]) shadows[i] = 1;
    }
  }

  const mergePasses = Math.round((settings.regionMerge ?? settings.cleanup) / 35);
  mergeTinyToneRegions(levels, w, h, mergePasses);
  limitBlackCoverage(levels, blackScores, w * h, settings.blackCoverageLimit ?? 8);
  for (const [i] of blackScores) {
    if (levels[i] === 4 && !regions.architecture[i]) blacks[i] = 1;
    if (shadows[i] && compression > 0.35 && levels[i] > 2) levels[i] = 2;
  }
  return { levels, shadows, blacks };
}

function mergeTinyToneRegions(levels, w, h, passes) {
  for (let p = 0; p < passes; p++) {
    const copy = new Uint8Array(levels);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const a = copy[i - 1], b = copy[i + 1], c = copy[i - w], d = copy[i + w];
        if (a === b && b === c) levels[i] = a;
        else if (a === b && c === d) levels[i] = Math.round((a + c) / 2);
      }
    }
  }
}

function limitBlackCoverage(levels, blackScores, totalPixels, limitPercent) {
  const maxBlack = Math.round(totalPixels * Math.max(0, limitPercent) / 100);
  if (blackScores.length <= maxBlack) return;
  blackScores.sort((a, b) => a[1] - b[1]);
  for (let i = maxBlack; i < blackScores.length; i++) {
    levels[blackScores[i][0]] = 3;
  }
}
