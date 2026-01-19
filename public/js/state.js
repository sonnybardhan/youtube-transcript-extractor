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
  compressionLevel: 50
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
