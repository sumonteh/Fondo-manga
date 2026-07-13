export function simplifyTones(gray, w, h, settings, regions) {
  const levels = new Uint8Array(w * h);
  const whiteCut = 138 + settings.whiteReserve * 1.05;
  const shadowCut = 170 - settings.shadowThreshold * 0.9;
  const blackCut = 94 + (100 - settings.blackMass) * 0.62;
  const hardness = settings.transitionHardness / 100;
  const count = Math.max(3, Math.min(5, settings.toneCount | 0));

  for (let y = 0; y < h; y++) {
    const depth = settings.depthEnabled ? y / Math.max(1, h - 1) : 0.5;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let g = gray[i];
      if (regions.sky[i]) g += 46;
      if (regions.water[i]) g += 24;
      if (regions.organic[i]) g -= 18;
      if (depth < 0.34) g += settings.farDetail * 0.18;
      if (depth > 0.72) g -= settings.blackMass * 0.10;

      if (g >= whiteCut) levels[i] = 0;
      else if (g <= blackCut) levels[i] = 4;
      else if (g <= shadowCut) levels[i] = 3;
      else if (count <= 3) levels[i] = g > (whiteCut + shadowCut) / 2 ? 1 : 3;
      else if (count === 4) levels[i] = g > (whiteCut + shadowCut) / 2 ? 1 : 2;
      else {
        const t = (whiteCut - g) / Math.max(1, whiteCut - blackCut);
        levels[i] = Math.min(4, Math.max(1, Math.round(1 + t * (2.2 + hardness))));
      }
    }
  }

  mergeTinyToneRegions(levels, w, h, settings.cleanup > 55 ? 2 : 1);
  return levels;
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
