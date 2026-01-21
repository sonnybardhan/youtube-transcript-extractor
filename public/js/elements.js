/**
 * DOM element references
 * Initialized after DOM is ready
 */
let elements = null;

export function initElements() {
  elements = {
    // Views
    inputView: document.getElementById('input-view'),
    resultsView: document.getElementById('results-view'),

    // Input elements
    urlsInput: document.getElementById('urls'),
    providerSelect: document.getElementById('llm-provider'),
    modelSelect: document.getElementById('llm-model'),
    compressionSlider: document.getElementById('compression-slider'),
    compressionValue: document.getElementById('compression-value'),
    extractBtn: document.getElementById('extract-btn'),
    newExtractionBtn: document.getElementById('new-extraction-btn'),

    // History
    historyList: document.getElementById('history-list'),
    selectAllHistory: document.getElementById('select-all-history'),
    bulkDeleteBtn: document.getElementById('bulk-delete-btn'),
    bulkDeleteCount: document.getElementById('bulk-delete-count'),
    historySearchInput: document.getElementById('history-search-input'),

    // Results
    output: document.getElementById('output'),
    currentTitle: document.getElementById('current-title'),
    backToInput: document.getElementById('back-to-input'),
    copyMarkdownBtn: document.getElementById('copy-markdown-btn'),
    rerunLlmBtn: document.getElementById('rerun-llm-btn'),
    cancelStreamBtn: document.getElementById('cancel-stream-btn'),

    // Info Pane
    infoPane: document.getElementById('info-pane'),
    infoPaneTabs: document.querySelectorAll('.info-tab'),
    transcriptTab: document.getElementById('transcript-tab'),
    metadataTab: document.getElementById('metadata-tab'),
    signalTab: document.getElementById('signal-tab'),
    toggleInfoPane: document.getElementById('toggle-info-pane'),

    // Theme & Settings
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    settingsBtn: document.getElementById('settings-btn'),

    // Loading & Status
    loadingOverlay: document.getElementById('loading-overlay'),
    resultsLoading: document.getElementById('results-loading'),
    resultsMain: document.getElementById('results-main'),
    apiStatus: document.getElementById('api-status'),
    cancelExtractBtn: document.getElementById('cancel-extract-btn'),

    // Modal
    promptModal: document.getElementById('prompt-modal'),
    promptTextarea: document.getElementById('prompt-textarea'),
    modalClose: document.getElementById('modal-close'),
    promptSave: document.getElementById('prompt-save'),
    promptCancel: document.getElementById('prompt-cancel'),
    lineNumbers: document.getElementById('line-numbers'),
    variableChips: document.querySelectorAll('.variable-chip'),

    // Toast
    errorToast: document.getElementById('error-toast'),
    errorMessage: document.getElementById('error-message')
  };

  return elements;
}

export function getElements() {
  return elements;
}

export default elements;
