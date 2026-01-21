/**
 * Application state management
 */
const state = {
  apiConfig: { hasOpenAI: false, hasAnthropic: false, hasOpenRouter: false },
  customPrompt: null,
  defaultPrompt: '',
  currentMarkdown: '',
  originalTranscript: '',
  currentMetadata: null,
  currentFilename: null,
  currentModel: null,
  compressionLevel: 50,
  currentRequest: null,  // Holds abort controller for in-progress request
  processingFilename: null,  // Filename currently being processed (for history spinner)
  streamingState: null,  // Stores streaming state when navigating away { accumulated, lastSections, title }
  restoreStreamingViewFn: null  // Callback to restore streaming view (set by extraction.js)
};

export function getState(key) {
  return state[key];
}

export function setState(key, value) {
  state[key] = value;
}

export function updateState(updates) {
  Object.assign(state, updates);
}

export default state;
