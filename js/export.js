export function canvasFromLayer(layerBuffer, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear el contexto Canvas.');
  ctx.putImageData(new ImageData(new Uint8ClampedArray(layerBuffer), width, height), 0, 0);
  return canvas;
}

export async function layerToPngBytes(layerBuffer, width, height) {
  const canvas = canvasFromLayer(layerBuffer, width, height);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('El navegador no pudo crear el PNG.');
  return new Uint8Array(await blob.arrayBuffer());
}

export async function downloadPng(layerBuffer, width, height, filename) {
  const bytes = await layerToPngBytes(layerBuffer, width, height);
  downloadBlob(new Blob([bytes], { type: 'image/png' }), filename);
}

export async function downloadProjectZip(render, settings, sourceName) {
  const base = safeBaseName(sourceName || 'fondo-manga');
  const files = [
    ['01_original-ajustado.png', await layerToPngBytes(render.layers.adjusted, render.width, render.height)],
    ['02_escala-de-grises.png', await layerToPngBytes(render.layers.grayscale, render.width, render.height)],
    ['03_monocromatico.png', await layerToPngBytes(render.layers.monochrome, render.width, render.height)],
    ['04_threshold.png', await layerToPngBytes(render.layers.threshold, render.width, render.height)],
    ['05_trama-60L.png', await layerToPngBytes(render.layers.screen60, render.width, render.height)],
    ['06_resultado-final.png', await layerToPngBytes(render.layers.final, render.width, render.height)],
    ['configuracion.json', new TextEncoder().encode(JSON.stringify({ version: 5, sourceName, settings }, null, 2))],
  ];
  const zip = makeZip(files);
  downloadBlob(new Blob([zip], { type: 'application/zip' }), `${base}-fondo-manga-proyecto.zip`);
}

export function downloadConfig(settings, sourceName) {
  const blob = new Blob([JSON.stringify({ version: 5, sourceName, settings }, null, 2)], {
    type: 'application/json',
  });
  downloadBlob(blob, `${safeBaseName(sourceName || 'fondo-manga')}-configuracion.json`);
}

export function safeBaseName(name) {
  return name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'fondo-manga';
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function makeZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const [name, bytes] of files) {
    const nameBytes = encoder.encode(name);
    const crc = crc32(bytes);
    const local = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, dosTime(), true);
    view.setUint16(14, dosDate(), true);
    view.setUint32(16, crc, true);
    view.setUint32(20, bytes.length, true);
    view.setUint32(24, bytes.length, true);
    view.setUint16(28, nameBytes.length, true);
    local.set(nameBytes, 30);
    localParts.push(local, bytes);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, dosTime(), true);
    cv.setUint16(16, dosDate(), true);
    cv.setUint32(18, crc, true);
    cv.setUint32(22, bytes.length, true);
    cv.setUint32(26, bytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);
    offset += local.length + bytes.length;
  }

  const centralSize = centralParts.reduce((sum, p) => sum + p.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  return concatBytes([...localParts, ...centralParts, end]);
}

function concatBytes(parts) {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function crc32(bytes) {
  let crc = -1;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function dosTime() {
  const d = new Date();
  return (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() / 2);
}

function dosDate() {
  const d = new Date();
  return ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
}
