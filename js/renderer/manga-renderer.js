import { edgePreservingSmooth, luminanceFromImage, normalizeTones } from './preprocess.js';
import { classifyRegions } from './regions.js';
import { multiScaleEdges } from './edges.js';
import { simplifyTones } from './tones.js';
import { texturePixel } from './textures.js';

export function renderManga(imageData, settings, progress = () => {}) {
  const { width: w, height: h, data } = imageData;
  progress(6, 'Convirtiendo a escala de grises');
  const gray = luminanceFromImage(data, settings);
  progress(16, 'Reduciendo ruido sin borrar bordes');
  const smooth = edgePreservingSmooth(gray, w, h, settings.cleanup);
  const normalized = normalizeTones(smooth, settings);
  progress(28, 'Clasificando regiones');
  const regions = classifyRegions(normalized, w, h, settings);
  progress(42, 'Extrayendo líneas multiescala');
  const edges = multiScaleEdges(normalized, w, h, settings, regions);
  progress(58, 'Simplificando masas tonales');
  const tones = simplifyTones(normalized, w, h, settings, regions);
  progress(72, 'Aplicando tramas localizadas');
  const layers = composeLayers(data, normalized, tones, edges, regions, w, h, settings);
  progress(100, 'Render completo');
  return { width: w, height: h, layers };
}

function composeLayers(src, gray, tones, edges, regions, w, h, settings) {
  const n = w * h;
  const final = new Uint8ClampedArray(n * 4);
  const mainLines = new Uint8ClampedArray(n * 4);
  const secondaryLines = new Uint8ClampedArray(n * 4);
  const fineDetails = new Uint8ClampedArray(n * 4);
  const blueSketch = new Uint8ClampedArray(n * 4);
  const blacks = new Uint8ClampedArray(n * 4);
  const toneLayer = new Uint8ClampedArray(n * 4);
  const textureLayer = new Uint8ClampedArray(n * 4);
  const adjusted = new Uint8ClampedArray(n * 4);
  const blue = !!settings.blueSketch;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const p = i * 4;
      const main = !!(settings.showMainLine && edges.main[i]);
      const secondary = !!(settings.showSecondaryLine && edges.secondary[i] && !main);
      const detail = !!(settings.showFineDetail && edges.detail[i] && !main && !secondary && !regions.sky[i]);
      const line = main || secondary || detail;
      const level = tones[i];
      const regionFlags = {
        sky: !!regions.sky[i],
        organic: !!(regions.organic[i] || regions.water[i] || regions.smoothSurface[i]),
      };
      const textured = !blue && !line && level > 0
        && level < 4
        && texturePixel(x, y, level, settings, regionFlags, w, h);
      const protectedStructure = regions.architecture[i] || regions.water[i] || regions.sky[i] || line;
      const solidBlack = !blue && !protectedStructure
        && (level === 4 || (regions.organic[i] && level >= 3 && settings.blackMass > 56));

      const toneValue = toneValueFor(level);
      setOpaque(adjusted, p, gray[i], gray[i], gray[i]);
      setOpaque(toneLayer, p, toneValue, toneValue, toneValue);

      if (solidBlack) {
        setOpaque(blacks, p, 18, 18, 18);
      } else {
        setTransparent(blacks, p);
      }

      if (textured) {
        setOpaque(textureLayer, p, 18, 18, 18);
      } else {
        setTransparent(textureLayer, p);
      }

      if (main) setOpaque(mainLines, p, blue ? 120 : 10, blue ? 170 : 10, blue ? 220 : 10);
      else setTransparent(mainLines, p);

      if (secondary) setOpaque(secondaryLines, p, blue ? 145 : 58, blue ? 185 : 58, blue ? 225 : 58);
      else setTransparent(secondaryLines, p);

      if (detail) setOpaque(fineDetails, p, blue ? 170 : 112, blue ? 200 : 112, blue ? 230 : 112);
      else setTransparent(fineDetails, p);

      if (line) setOpaque(blueSketch, p, 120, 170, 220);
      else setTransparent(blueSketch, p);

      if (blue) {
        if (line) setOpaque(final, p, 120, 170, 220);
        else setOpaque(final, p, 255, 255, 255);
      } else if (main) {
        setOpaque(final, p, 10, 10, 10);
      } else if (secondary) {
        setOpaque(final, p, 58, 58, 58);
      } else if (detail) {
        setOpaque(final, p, 112, 112, 112);
      } else if (solidBlack || textured) {
        setOpaque(final, p, 18, 18, 18);
      } else {
        const paper = level === 0 ? 255 : level === 1 ? 246 : level === 2 ? 232 : 212;
        setOpaque(final, p, paper, paper, paper);
      }
    }
  }

  return {
    final: final.buffer,
    mainLines: mainLines.buffer,
    secondaryLines: secondaryLines.buffer,
    fineDetails: fineDetails.buffer,
    blacks: blacks.buffer,
    tones: toneLayer.buffer,
    textures: textureLayer.buffer,
    blueSketch: blueSketch.buffer,
    adjusted: adjusted.buffer,
  };
}

function toneValueFor(level) {
  return [255, 238, 214, 176, 24][level] ?? 255;
}

function setOpaque(arr, p, r, g, b) {
  arr[p] = r;
  arr[p + 1] = g;
  arr[p + 2] = b;
  arr[p + 3] = 255;
}

function setTransparent(arr, p) {
  arr[p] = 0;
  arr[p + 1] = 0;
  arr[p + 2] = 0;
  arr[p + 3] = 0;
}
