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

let apiConfig = { hasOpenAI: false, hasAnthropic: false };
let customPrompt = null;
let defaultPrompt = '';

// DOM Elements
const urlsInput = document.getElementById('urls');
const providerSelect = document.getElementById('llm-provider');
const modelSelect = document.getElementById('llm-model');
const extractBtn = document.getElementById('extract-btn');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const outputEl = document.getElementById('output');
const historyList = document.getElementById('history-list');

// Modal Elements
const promptModal = document.getElementById('prompt-modal');
const promptTextarea = document.getElementById('prompt-textarea');
const promptEditorBtn = document.getElementById('prompt-editor-btn');
const modalCloseBtn = document.getElementById('modal-close');
const promptSaveBtn = document.getElementById('prompt-save');
const promptResetBtn = document.getElementById('prompt-reset');

// Initialize
async function init() {
  await loadConfig();
  await loadHistory();
  await loadPrompt();

  providerSelect.addEventListener('change', handleProviderChange);
  extractBtn.addEventListener('click', handleExtract);

  // Modal event listeners
  promptEditorBtn.addEventListener('click', openPromptModal);
  modalCloseBtn.addEventListener('click', closePromptModal);
  promptSaveBtn.addEventListener('click', savePrompt);
  promptResetBtn.addEventListener('click', resetPrompt);
  promptModal.addEventListener('click', (e) => {
    if (e.target === promptModal) closePromptModal();
  });
}

async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    apiConfig = await res.json();

    // Disable providers without API keys
    Array.from(providerSelect.options).forEach(opt => {
      if (opt.value === 'openai' && !apiConfig.hasOpenAI) {
        opt.disabled = true;
        opt.textContent += ' (no API key)';
      }
      if (opt.value === 'anthropic' && !apiConfig.hasAnthropic) {
        opt.disabled = true;
        opt.textContent += ' (no API key)';
      }
    });
  } catch (err) {
    console.error('Failed to load config:', err);
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

function renderHistory(files) {
  if (files.length === 0) {
    historyList.innerHTML = '<p class="empty-state">No extractions yet</p>';
    return;
  }

  historyList.innerHTML = files.map(file => `
    <div class="history-item" data-filename="${escapeHtml(file.filename)}">
      <div class="history-item-title" title="${escapeHtml(file.title)}">${escapeHtml(file.title)}</div>
      <div class="history-item-date">${formatDate(file.date)}</div>
      <div class="history-item-actions">
        <button class="delete-btn" data-filename="${escapeHtml(file.filename)}">Delete</button>
      </div>
    </div>
  `).join('');

  // Add click handlers
  historyList.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-btn')) return;
      loadHistoryItem(item.dataset.filename);
    });
  });

  historyList.querySelectorAll('.delete-btn').forEach(btn => {
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
    renderMarkdown(data.content);

    // Update active state
    historyList.querySelectorAll('.history-item').forEach(item => {
      item.classList.toggle('active', item.dataset.filename === filename);
    });
  } catch (err) {
    showError(err.message);
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
    showError(err.message);
  }
}

function handleProviderChange() {
  const provider = providerSelect.value;

  if (!provider) {
    modelSelect.disabled = true;
    modelSelect.innerHTML = '<option value="">Select provider first</option>';
    return;
  }

  const models = LLM_MODELS[provider] || [];
  modelSelect.disabled = false;
  modelSelect.innerHTML = models.map(m =>
    `<option value="${m.value}">${m.label}</option>`
  ).join('');
}

async function handleExtract() {
  const urlText = urlsInput.value.trim();
  if (!urlText) {
    showError('Please enter at least one YouTube URL');
    return;
  }

  const urls = urlText.split('\n').map(u => u.trim()).filter(u => u);

  const provider = providerSelect.value;
  const model = modelSelect.value;

  const llm = provider && model ? { provider, model } : null;

  setLoading(true);
  hideError();

  try {
    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls, llm, customPrompt })
    });

    const data = await res.json();

    if (data.errors && data.errors.length > 0) {
      const errorMsgs = data.errors.map(e => `${e.url}: ${e.error}`).join('\n');
      showError(errorMsgs);
    }

    if (data.results && data.results.length > 0) {
      // Show the first result
      renderMarkdown(data.results[0].markdown);

      // If multiple results, combine them
      if (data.results.length > 1) {
        const combined = data.results.map(r => r.markdown).join('\n\n---\n\n');
        renderMarkdown(combined);
      }

      // Refresh history
      await loadHistory();
    } else if (!data.errors || data.errors.length === 0) {
      showError('No results returned');
    }
  } catch (err) {
    showError(`Request failed: ${err.message}`);
  } finally {
    setLoading(false);
  }
}

function renderMarkdown(content) {
  // Note: marked library renders markdown. Content comes from our own extractor
  // which processes YouTube metadata. For production use, consider DOMPurify.
  outputEl.innerHTML = marked.parse(content);
}

function setLoading(isLoading) {
  loadingEl.classList.toggle('hidden', !isLoading);
  extractBtn.disabled = isLoading;
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function hideError() {
  errorEl.classList.add('hidden');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Prompt functions
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

function openPromptModal() {
  promptTextarea.value = customPrompt || defaultPrompt;
  promptModal.classList.remove('hidden');
}

function closePromptModal() {
  promptModal.classList.add('hidden');
}

async function savePrompt() {
  const newPrompt = promptTextarea.value.trim();

  try {
    const res = await fetch('/api/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: newPrompt })
    });

    if (!res.ok) throw new Error('Failed to save prompt');

    customPrompt = newPrompt === defaultPrompt ? null : newPrompt;
    closePromptModal();
  } catch (err) {
    showError(err.message);
  }
}

async function resetPrompt() {
  promptTextarea.value = defaultPrompt;
  customPrompt = null;

  try {
    await fetch('/api/prompt', {
      method: 'DELETE'
    });
  } catch (err) {
    console.error('Failed to reset prompt:', err);
  }
}

init();
