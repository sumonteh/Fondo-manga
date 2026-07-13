export function texturePixel(x, y, level, settings, regionFlags, w, h) {
  if (level <= 0 || settings.textureMode === 'none' || settings.texture <= 0) return false;
  if (regionFlags.sky && level < 4) return false;
  const density = densityForLevel(level, settings, regionFlags.organic);
  if (density <= 0) return false;
  const scale = Math.max(4, 14 - settings.texture * 0.09);
  switch (settings.textureMode) {
    case 'dots': return dots(x, y, scale, density);
    case 'lines': return lines(x, y, scale, density, Math.PI / 4);
    case 'cross': return lines(x, y, scale * 1.25, density * 0.72, Math.PI / 4)
      || lines(x, y, scale * 1.25, density * 0.64, -Math.PI / 4);
    case 'organic': return valueNoise(x * 0.075, y * 0.075) < density * 0.78;
    case 'concrete': return valueNoise(x * 0.22, y * 0.22) < density * 0.45
      || lines(x, y, scale * 2, density * 0.25, 0);
    case 'foliage': return foliage(x, y, density);
    default: return false;
  }
}

function densityForLevel(level, settings, regionFlag) {
  const base = [0, 0.16, 0.32, 0.55, 1][level] ?? 0;
  const texture = settings.texture / 100;
  return Math.min(1, base * (0.55 + texture) + (regionFlag ? 0.12 : 0));
}

function dots(x, y, cell, density) {
  const c = Math.max(3, cell);
  const u = ((x + y) * Math.SQRT1_2) / c;
  const v = ((y - x) * Math.SQRT1_2) / c;
  const fu = u - Math.floor(u) - 0.5;
  const fv = v - Math.floor(v) - 0.5;
  return (fu * fu + fv * fv) / 0.5 < density;
}

function lines(x, y, cell, density, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const v = (-x * s + y * c) / Math.max(3, cell);
  const f = v - Math.floor(v);
  return Math.abs(f - 0.5) < density * 0.42;
}

function foliage(x, y, density) {
  const a = valueNoise(x * 0.11, y * 0.11);
  const b = valueNoise(x * 0.035 + 21, y * 0.035 - 11);
  return a * 0.65 + b * 0.35 < density * 0.92;
}

export function valueNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

function hash(x, y) {
  let n = x * 374761393 + y * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

function lerp(a, b, t) { return a + (b - a) * t; }
