// ========================================
// Configuration
// ========================================
const LLM_MODELS = {
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4o', label: 'GPT-4o' }
  ],
  anthropic: [
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { value: 'claude-haiku-4-20250514', label: 'Claude Haiku 4' }
  ]
};

// ========================================
// State
// ========================================
let apiConfig = { hasOpenAI: false, hasAnthropic: false };
let customPrompt = null;
let defaultPrompt = '';
let currentMarkdown = '';

// ========================================
// DOM Elements
// ========================================
const elements = {
  // Views
  inputView: document.getElementById('input-view'),
  resultsView: document.getElementById('results-view'),

  // Input elements
  urlsInput: document.getElementById('urls'),
  providerSelect: document.getElementById('llm-provider'),
  modelSelect: document.getElementById('llm-model'),
  extractBtn: document.getElementById('extract-btn'),
  editPromptBtn: document.getElementById('edit-prompt-btn'),
  newExtractionBtn: document.getElementById('new-extraction-btn'),

  // History
  historyList: document.getElementById('history-list'),

  // Results
  output: document.getElementById('output'),
  currentTitle: document.getElementById('current-title'),
  backToInput: document.getElementById('back-to-input'),
  copyMarkdownBtn: document.getElementById('copy-markdown-btn'),

  // Loading & Status
  loadingOverlay: document.getElementById('loading-overlay'),
  apiStatus: document.getElementById('api-status'),

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

// ========================================
// Initialize
// ========================================
async function init() {
  await loadConfig();
  await loadHistory();
  await loadPrompt();

  setupEventListeners();
  updateLineNumbers();
}

function setupEventListeners() {
  // Provider change
  elements.providerSelect.addEventListener('change', handleProviderChange);

  // Extract button
  elements.extractBtn.addEventListener('click', handleExtract);

  // New extraction button
  elements.newExtractionBtn.addEventListener('click', showInputView);

  // Back to input
  elements.backToInput.addEventListener('click', (e) => {
    e.preventDefault();
    showInputView();
  });

  // Copy markdown
  elements.copyMarkdownBtn.addEventListener('click', handleCopyMarkdown);

  // Modal controls
  elements.editPromptBtn.addEventListener('click', openPromptModal);
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

// ========================================
// API Functions
// ========================================
async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    apiConfig = await res.json();

    // Update provider options
    Array.from(elements.providerSelect.options).forEach(opt => {
      if (opt.value === 'openai' && !apiConfig.hasOpenAI) {
        opt.disabled = true;
        opt.textContent += ' (no key)';
      }
      if (opt.value === 'anthropic' && !apiConfig.hasAnthropic) {
        opt.disabled = true;
        opt.textContent += ' (no key)';
      }
    });

    // Update status
    const hasAnyKey = apiConfig.hasOpenAI || apiConfig.hasAnthropic;
    elements.apiStatus.textContent = hasAnyKey ? 'Operational' : 'No API Keys';
    elements.apiStatus.className = hasAnyKey ? 'status-ok' : 'status-error';
  } catch (err) {
    console.error('Failed to load config:', err);
    elements.apiStatus.textContent = 'Error';
    elements.apiStatus.className = 'status-error';
  }
}

async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    const files = await res.json();
    renderHistory(files);
  } catch (err) {
    console.error('Failed to load history:', err);
  }
}

async function loadPrompt() {
  try {
    const res = await fetch('/api/prompt');
    const data = await res.json();
    defaultPrompt = data.defaultPrompt;
    customPrompt = data.customPrompt;
  } catch (err) {
    console.error('Failed to load prompt:', err);
  }
}

// ========================================
// History Functions
// ========================================
function renderHistory(files) {
  if (files.length === 0) {
    elements.historyList.innerHTML = '<p class="empty-state">No extractions yet</p>';
    return;
  }

  elements.historyList.innerHTML = files.map(file => `
    <button class="history-item" data-filename="${escapeHtml(file.filename)}">
      <div class="history-item-title" title="${escapeHtml(file.title)}">${escapeHtml(file.title)}</div>
      <div class="history-item-meta">${formatDate(file.date)}</div>
      <div class="history-item-actions">
        <button class="delete-btn" data-filename="${escapeHtml(file.filename)}">Delete</button>
      </div>
    </button>
  `).join('');

  // Add click handlers
  elements.historyList.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-btn')) return;
      loadHistoryItem(item.dataset.filename);
    });
  });

  elements.historyList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteHistoryItem(btn.dataset.filename);
    });
  });
}

async function loadHistoryItem(filename) {
  try {
    const res = await fetch(`/api/history/${encodeURIComponent(filename)}`);
    if (!res.ok) throw new Error('Failed to load file');

    const data = await res.json();
    currentMarkdown = data.content;

    // Extract title from markdown
    const titleMatch = data.content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : filename.replace('.md', '');

    showResultsView(data.content, title);

    // Update active state
    elements.historyList.querySelectorAll('.history-item').forEach(item => {
      item.classList.toggle('active', item.dataset.filename === filename);
    });
  } catch (err) {
    showToast(err.message);
  }
}

async function deleteHistoryItem(filename) {
  if (!confirm('Delete this extraction?')) return;

  try {
    const res = await fetch(`/api/history/${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete');

    await loadHistory();
  } catch (err) {
    showToast(err.message);
  }
}

// ========================================
// Extraction Functions
// ========================================
function handleProviderChange() {
  const provider = elements.providerSelect.value;

  if (!provider) {
    elements.modelSelect.disabled = true;
    elements.modelSelect.innerHTML = '<option value="">Select provider</option>';
    return;
  }

  const models = LLM_MODELS[provider] || [];
  elements.modelSelect.disabled = false;
  elements.modelSelect.innerHTML = models.map(m =>
    `<option value="${m.value}">${m.label}</option>`
  ).join('');
}

async function handleExtract() {
  const urlText = elements.urlsInput.value.trim();
  if (!urlText) {
    showToast('Please enter at least one YouTube URL');
    return;
  }

  const urls = urlText.split('\n').map(u => u.trim()).filter(u => u);
  const provider = elements.providerSelect.value;
  const model = elements.modelSelect.value;
  const llm = provider && model ? { provider, model } : null;

  setLoading(true);

  try {
    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls, llm, customPrompt })
    });

    const data = await res.json();

    if (data.errors && data.errors.length > 0) {
      const errorMsgs = data.errors.map(e => `${e.url}: ${e.error}`).join('\n');
      showToast(errorMsgs);
    }

    if (data.results && data.results.length > 0) {
      // Show the first result (or combined if multiple)
      let markdown = data.results[0].markdown;
      let title = data.results[0].title;

      if (data.results.length > 1) {
        markdown = data.results.map(r => r.markdown).join('\n\n---\n\n');
        title = `${data.results.length} Videos`;
      }

      currentMarkdown = markdown;
      showResultsView(markdown, title);
      await loadHistory();
    } else if (!data.errors || data.errors.length === 0) {
      showToast('No results returned');
    }
  } catch (err) {
    showToast(`Request failed: ${err.message}`);
  } finally {
    setLoading(false);
  }
}

// ========================================
// View Management
// ========================================
function showInputView() {
  elements.inputView.classList.remove('hidden');
  elements.resultsView.classList.add('hidden');

  // Clear active history state
  elements.historyList.querySelectorAll('.history-item').forEach(item => {
    item.classList.remove('active');
  });
}

function showResultsView(markdown, title) {
  elements.inputView.classList.add('hidden');
  elements.resultsView.classList.remove('hidden');
  elements.currentTitle.textContent = truncate(title, 40);
  renderMarkdown(markdown);
}

function renderMarkdown(content) {
  elements.output.innerHTML = marked.parse(content);
}

function setLoading(isLoading) {
  elements.loadingOverlay.classList.toggle('hidden', !isLoading);
  elements.extractBtn.disabled = isLoading;
}

// ========================================
// Modal Functions
// ========================================
function openPromptModal() {
  elements.promptTextarea.value = customPrompt || defaultPrompt;
  elements.promptModal.classList.remove('hidden');
  updateLineNumbers();
  elements.promptTextarea.focus();
}

function closePromptModal() {
  elements.promptModal.classList.add('hidden');
}

async function savePrompt() {
  const newPrompt = elements.promptTextarea.value.trim();

  try {
    const res = await fetch('/api/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: newPrompt })
    });

    if (!res.ok) throw new Error('Failed to save prompt');

    customPrompt = newPrompt === defaultPrompt ? null : newPrompt;
    closePromptModal();
    showToast('Prompt saved successfully', 'success');
  } catch (err) {
    showToast(err.message);
  }
}

function updateLineNumbers() {
  const lines = elements.promptTextarea.value.split('\n').length;
  const lineNumbersHtml = Array.from({ length: Math.max(lines, 20) }, (_, i) =>
    `<span>${i + 1}</span>`
  ).join('');
  elements.lineNumbers.innerHTML = lineNumbersHtml;
}

function syncLineNumbersScroll() {
  elements.lineNumbers.scrollTop = elements.promptTextarea.scrollTop;
}

// ========================================
// Utility Functions
// ========================================
function handleCopyMarkdown() {
  if (!currentMarkdown) return;

  navigator.clipboard.writeText(currentMarkdown).then(() => {
    showToast('Copied to clipboard', 'success');
  }).catch(() => {
    showToast('Failed to copy');
  });
}

function handleKeyboardShortcuts(e) {
  // Escape to close modal
  if (e.key === 'Escape' && !elements.promptModal.classList.contains('hidden')) {
    closePromptModal();
  }

  // Cmd/Ctrl + Enter to save prompt
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !elements.promptModal.classList.contains('hidden')) {
    e.preventDefault();
    savePrompt();
  }
}

function showToast(message, type = 'error') {
  elements.errorMessage.textContent = message;
  elements.errorToast.style.borderColor = type === 'success' ? 'var(--success)' : 'var(--error)';
  elements.errorToast.querySelector('.material-symbols-outlined').textContent = type === 'success' ? 'check_circle' : 'error';
  elements.errorToast.querySelector('.material-symbols-outlined').style.color = type === 'success' ? 'var(--success)' : 'var(--error)';
  elements.errorToast.classList.remove('hidden');

  setTimeout(() => {
    elements.errorToast.classList.add('hidden');
  }, 4000);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function truncate(str, length) {
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
}

function formatDate(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

// ========================================
// Start App
// ========================================
init();
