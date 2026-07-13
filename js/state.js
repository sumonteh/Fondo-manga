import { DEFAULT_SETTINGS } from './presets.js';

const STORAGE_KEY = 'fondo-manga-v5-settings';
const CUSTOM_PRESETS_KEY = 'fondo-manga-v5-custom-presets';

export function cloneSettings(settings) {
  return JSON.parse(JSON.stringify(settings));
}

export function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return cloneSettings(DEFAULT_SETTINGS);
    const parsed = JSON.parse(saved);
    return normalizeSettings({ ...DEFAULT_SETTINGS, ...parsed }, parsed);
  } catch {
    return cloneSettings(DEFAULT_SETTINGS);
  }
}

export function saveSettings(settings) {
  const copy = { ...settings };
  delete copy.imageName;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(copy));
}

export function loadCustomPresets() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_PRESETS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveCustomPreset(name, settings) {
  const presets = loadCustomPresets();
  const id = `custom-${Date.now()}`;
  const copy = cloneSettings(settings);
  delete copy.imageName;
  presets.push({ id, name, settings: copy, custom: true });
  localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets));
  return { id, name, settings: copy, custom: true };
}

function normalizeSettings(settings, raw = {}) {
  const out = { ...settings };
  if (out.exportFormat === 'a5') out.exportFormat = 'a5-300';
  if (out.exportFormat === 'a4') out.exportFormat = 'a4-300';
  if (raw.mainLine <= 8 && raw.mainLineWeight == null) {
    out.mainLineWeight = out.mainLine;
    out.mainLine = DEFAULT_SETTINGS.mainLine;
  }
  if (raw.secondaryLine <= 6 && raw.secondaryLineWeight == null) {
    out.secondaryLineWeight = out.secondaryLine;
    out.secondaryLine = DEFAULT_SETTINGS.secondaryLine;
  }
  return out;
}

export class HistoryStack {
  constructor(initial) {
    this.undoStack = [];
    this.redoStack = [];
    this.current = cloneSettings(initial);
  }

  push(next) {
    this.undoStack.push(cloneSettings(this.current));
    this.current = cloneSettings(next);
    this.redoStack = [];
  }

  undo() {
    if (!this.undoStack.length) return null;
    this.redoStack.push(cloneSettings(this.current));
    this.current = this.undoStack.pop();
    return cloneSettings(this.current);
  }

  redo() {
    if (!this.redoStack.length) return null;
    this.undoStack.push(cloneSettings(this.current));
    this.current = this.redoStack.pop();
    return cloneSettings(this.current);
  }
}
