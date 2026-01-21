/**
 * YouTube Extractor - Main Application Entry Point
 *
 * This module initializes the application and sets up all event listeners.
 */
import { initElements, getElements } from './elements.js';
import { loadConfig, loadPrompt } from './api.js';
import { loadHistory, initHistorySelection } from './history.js';
import { handleExtract, handleRerunLLM, handleProviderChange, handleCompressionChange, cancelCurrentRequest } from './extraction.js';
import { showInputView } from './views.js';
import {
  loadSavedTheme,
  toggleTheme,
  setLoading,
  showToast,
  openPromptModal,
  closePromptModal,
  savePrompt,
  updateLineNumbers,
  syncLineNumbersScroll,
  switchInfoTab,
  toggleInfoPane,
  handleKeyboardShortcuts,
  handleCopyMarkdown
} from './ui.js';

/**
 * Initialize the application
 */
async function init() {
  // Initialize DOM element references
  initElements();

  // Load saved theme preference
  loadSavedTheme();

  // Load configuration and data from server
  await loadConfig();
  await loadHistory();
  await loadPrompt();

  // Set up all event listeners
  setupEventListeners();

  // Initialize history selection controls
  initHistorySelection();

  // Initialize line numbers in prompt editor
  updateLineNumbers();
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  const elements = getElements();

  // Provider change
  elements.providerSelect.addEventListener('change', handleProviderChange);

  // Compression slider
  elements.compressionSlider.addEventListener('input', handleCompressionChange);

  // Extract button
  elements.extractBtn.addEventListener('click', handleExtract);

  // New extraction button
  elements.newExtractionBtn.addEventListener('click', () => {
    showInputView();
    elements.urlsInput.focus();
  });

  // Back to input
  elements.backToInput.addEventListener('click', (e) => {
    e.preventDefault();
    showInputView();
  });

  // Copy markdown
  elements.copyMarkdownBtn.addEventListener('click', handleCopyMarkdown);

  // Rerun LLM button
  elements.rerunLlmBtn.addEventListener('click', handleRerunLLM);

  // Cancel buttons
  elements.cancelExtractBtn.addEventListener('click', cancelCurrentRequest);
  elements.cancelStreamBtn.addEventListener('click', cancelCurrentRequest);

  // Info pane tabs and toggle
  elements.infoPaneTabs.forEach(tab => {
    tab.addEventListener('click', () => switchInfoTab(tab.dataset.tab));
  });
  elements.toggleInfoPane.addEventListener('click', toggleInfoPane);

  // Theme toggle
  elements.themeToggleBtn.addEventListener('click', toggleTheme);

  // Settings button opens prompt modal
  elements.settingsBtn.addEventListener('click', openPromptModal);

  // Modal controls
  elements.modalClose.addEventListener('click', closePromptModal);
  elements.promptCancel.addEventListener('click', closePromptModal);
  elements.promptSave.addEventListener('click', savePrompt);
  elements.promptModal.addEventListener('click', (e) => {
    if (e.target === elements.promptModal) closePromptModal();
  });

  // Line numbers sync
  elements.promptTextarea.addEventListener('input', updateLineNumbers);
  elements.promptTextarea.addEventListener('scroll', syncLineNumbersScroll);

  // Variable chips
  elements.variableChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const variable = chip.dataset.var;
      navigator.clipboard.writeText(variable);
      showToast(`Copied ${variable} to clipboard`, 'success');
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

// Start the application
init();
