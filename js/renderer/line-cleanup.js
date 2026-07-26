export function cleanLineLayers(layers, w, h, settings, regions) {
  const simplify = (settings.lineSimplify ?? 50) / 100;
  const connect = (settings.lineConnect ?? 50) / 100;
  const geometry = (settings.perspectiveStrength ?? 0) / 100;

  cleanMask(layers.main, w, h, 1 + Math.round(simplify * 2));
  cleanMask(layers.secondary, w, h, 1 + Math.round(simplify));
  cleanMask(layers.detail, w, h, 2 + Math.round(simplify * 3));
  connectGaps(layers.main, w, h, connect > 0.35 ? 2 : 1, regions, geometry);
  connectGaps(layers.secondary, w, h, connect > 0.68 ? 2 : 1, regions, geometry);
  removeOverlap(layers.secondary, layers.main);
  removeOverlap(layers.detail, layers.main, layers.secondary);
  return layers;
}

function cleanMask(mask, w, h, minNeighbors) {
  const src = new Uint8Array(mask);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!src[i]) continue;
      let n = 0;
      for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) {
        if (xx || yy) n += src[i + yy * w + xx];
      }
      if (n < minNeighbors) mask[i] = 0;
    }
  }
}

function connectGaps(mask, w, h, distance, regions, geometry) {
  const src = new Uint8Array(mask);
  for (let y = distance; y < h - distance; y++) {
    for (let x = distance; x < w - distance; x++) {
      const i = y * w + x;
      if (src[i]) continue;
      const structural = regions.architecture[i] && geometry > 0.25;
      const horizontal = src[i - distance] && src[i + distance];
      const vertical = src[i - distance * w] && src[i + distance * w];
      const diagonalA = src[i - distance * w - distance] && src[i + distance * w + distance];
      const diagonalB = src[i - distance * w + distance] && src[i + distance * w - distance];
      if (horizontal || vertical || (structural && (diagonalA || diagonalB))) mask[i] = 1;
    }
  }
}

function removeOverlap(target, ...stronger) {
  for (let i = 0; i < target.length; i++) {
    if (stronger.some(mask => mask[i])) target[i] = 0;
  }
}
