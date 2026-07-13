export const SCENE_TYPES = [
  { value: 'urban', label: 'Urbano' },
  { value: 'interior', label: 'Interior' },
  { value: 'vegetation', label: 'Vegetación' },
  { value: 'riverbank', label: 'Ribera' },
  { value: 'general', label: 'General' },
];

export const TEXTURE_MODES = [
  { value: 'dots', label: 'Puntos' },
  { value: 'lines', label: 'Líneas' },
  { value: 'cross', label: 'Trama cruzada' },
  { value: 'organic', label: 'Orgánica' },
  { value: 'concrete', label: 'Grano concreto' },
  { value: 'foliage', label: 'Masa vegetal' },
  { value: 'none', label: 'Sin trama' },
];

export const EXPORT_FORMATS = [
  { value: 'web', label: 'Web 2000px', px: 2000, inches: 6.67 },
  { value: 'a5', label: 'A5 · 300dpi', px: 2480, inches: 8.27 },
  { value: 'a4', label: 'A4 · 300dpi', px: 3508, inches: 11.69 },
];

export const CONTROL_DEFS = {
  detail: { label: 'Detalle', min: 0, max: 100, step: 1 },
  cleanup: { label: 'Limpieza', min: 0, max: 100, step: 1 },
  mainLine: { label: 'Línea principal', min: 0, max: 8, step: 1 },
  secondaryLine: { label: 'Línea secundaria', min: 0, max: 6, step: 1 },
  edgeContinuity: { label: 'Continuidad de contornos', min: 0, max: 100, step: 1 },
  farDetail: { label: 'Detalle lejano', min: 0, max: 100, step: 1 },
  whiteReserve: { label: 'Reserva de blanco', min: 0, max: 80, step: 1 },
  blackMass: { label: 'Masas negras', min: 0, max: 100, step: 1 },
  shadowThreshold: { label: 'Umbral de sombra', min: 0, max: 100, step: 1 },
  toneCount: { label: 'Cantidad de tonos', min: 3, max: 5, step: 1 },
  transitionHardness: { label: 'Dureza tonal', min: 0, max: 100, step: 1 },
  texture: { label: 'Textura', min: 0, max: 100, step: 1 },
};

export const DEFAULT_SETTINGS = {
  preset: 'urban-clean',
  sceneType: 'urban',
  exportFormat: 'web',
  textureMode: 'cross',
  detail: 58,
  cleanup: 55,
  mainLine: 3,
  secondaryLine: 1,
  edgeContinuity: 45,
  farDetail: 38,
  whiteReserve: 46,
  blackMass: 34,
  shadowThreshold: 52,
  toneCount: 4,
  transitionHardness: 58,
  texture: 28,
  depthEnabled: true,
  skyProtect: true,
  architectureBoost: true,
  organicRegions: true,
};

export const PRESETS = [
  {
    id: 'urban-clean',
    name: 'Urbano limpio',
    settings: {
      sceneType: 'urban', textureMode: 'lines', detail: 52, cleanup: 72, mainLine: 3,
      secondaryLine: 1, edgeContinuity: 62, farDetail: 28, whiteReserve: 58,
      blackMass: 24, shadowThreshold: 58, toneCount: 4, transitionHardness: 65,
      texture: 18, depthEnabled: true, skyProtect: true, architectureBoost: true,
      organicRegions: false,
    },
  },
  {
    id: 'urban-dramatic',
    name: 'Urbano dramático',
    settings: {
      sceneType: 'urban', textureMode: 'cross', detail: 64, cleanup: 50, mainLine: 5,
      secondaryLine: 2, edgeContinuity: 70, farDetail: 35, whiteReserve: 32,
      blackMass: 72, shadowThreshold: 43, toneCount: 4, transitionHardness: 78,
      texture: 32, depthEnabled: true, skyProtect: true, architectureBoost: true,
      organicRegions: false,
    },
  },
  {
    id: 'seinen-detail',
    name: 'Seinen detallado',
    settings: {
      sceneType: 'urban', textureMode: 'dots', detail: 78, cleanup: 42, mainLine: 2,
      secondaryLine: 1, edgeContinuity: 56, farDetail: 46, whiteReserve: 38,
      blackMass: 42, shadowThreshold: 50, toneCount: 5, transitionHardness: 52,
      texture: 45, depthEnabled: true, skyProtect: true, architectureBoost: true,
      organicRegions: true,
    },
  },
  {
    id: 'vegetation-manga',
    name: 'Vegetación manga',
    settings: {
      sceneType: 'vegetation', textureMode: 'foliage', detail: 68, cleanup: 34, mainLine: 3,
      secondaryLine: 2, edgeContinuity: 36, farDetail: 44, whiteReserve: 28,
      blackMass: 64, shadowThreshold: 46, toneCount: 4, transitionHardness: 46,
      texture: 72, depthEnabled: true, skyProtect: false, architectureBoost: false,
      organicRegions: true,
    },
  },
  {
    id: 'riverbank',
    name: 'Ribera',
    settings: {
      sceneType: 'riverbank', textureMode: 'organic', detail: 54, cleanup: 58, mainLine: 3,
      secondaryLine: 1, edgeContinuity: 42, farDetail: 32, whiteReserve: 54,
      blackMass: 50, shadowThreshold: 52, toneCount: 4, transitionHardness: 48,
      texture: 42, depthEnabled: true, skyProtect: true, architectureBoost: false,
      organicRegions: true,
    },
  },
  {
    id: 'blue-sketch',
    name: 'Boceto azul',
    settings: {
      sceneType: 'general', textureMode: 'none', detail: 72, cleanup: 58, mainLine: 1,
      secondaryLine: 0, edgeContinuity: 38, farDetail: 48, whiteReserve: 74,
      blackMass: 0, shadowThreshold: 70, toneCount: 3, transitionHardness: 40,
      texture: 0, depthEnabled: true, skyProtect: true, architectureBoost: true,
      organicRegions: false, blueSketch: true,
    },
  },
];
