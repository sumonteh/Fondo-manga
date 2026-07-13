import { renderManga } from './renderer/manga-renderer.js';

self.addEventListener('message', event => {
  const { type, jobId, imageData, settings } = event.data;
  if (type !== 'render') return;
  try {
    const result = renderManga(imageData, settings, (progress, label) => {
      self.postMessage({ type: 'progress', jobId, progress, label });
    });
    const transfers = Object.values(result.layers);
    self.postMessage({ type: 'result', jobId, result }, transfers);
  } catch (error) {
    self.postMessage({
      type: 'error',
      jobId,
      message: error && error.message ? error.message : 'Error desconocido durante el procesamiento.',
    });
  }
});
