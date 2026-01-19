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
let originalTranscript = '';
let currentMetadata = null;

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

  // Info Pane
  infoPane: document.getElementById('info-pane'),
  infoPaneTabs: document.querySelectorAll('.info-tab'),
  transcriptTab: document.getElementById('transcript-tab'),
  metadataTab: document.getElementById('metadata-tab'),
  toggleInfoPane: document.getElementById('toggle-info-pane'),

  // Theme
  themeToggleBtn: document.getElementById('theme-toggle-btn'),

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
  loadSavedTheme();
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

  // Info pane tabs and toggle
  elements.infoPaneTabs.forEach(tab => {
    tab.addEventListener('click', () => switchInfoTab(tab.dataset.tab));
  });
  elements.toggleInfoPane.addEventListener('click', toggleInfoPane);

  // Theme toggle
  elements.themeToggleBtn.addEventListener('click', toggleTheme);

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
    <div class="history-item" data-filename="${escapeHtml(file.filename)}">
      <div class="history-item-content">
        <div class="history-item-title" title="${escapeHtml(file.title)}">${escapeHtml(file.title)}</div>
        <div class="history-item-meta">${formatDate(file.date)}</div>
      </div>
      <button class="delete-btn" data-filename="${escapeHtml(file.filename)}" title="Delete">
        <span class="material-symbols-outlined">delete</span>
      </button>
    </div>
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
  // Extract original transcript from <details> section
  let detailsMatch = content.match(/<details>\s*<summary>Original Transcript<\/summary>([\s\S]*?)<\/details>/i);

  if (detailsMatch) {
    originalTranscript = detailsMatch[1].trim();
    content = content.replace(/<details>\s*<summary>Original Transcript<\/summary>[\s\S]*?<\/details>/i, '');
  } else {
    originalTranscript = '';
  }

  // Extract metadata section
  const metadataMatch = content.match(/## Metadata\n\n([\s\S]*?)(?=\n## |$)/);
  if (metadataMatch) {
    currentMetadata = parseMetadata(metadataMatch[1]);
    content = content.replace(/## Metadata\n\n[\s\S]*?(?=\n## |$)/, '');
  } else {
    currentMetadata = null;
  }

  // Extract description section (also goes to right pane)
  const descMatch = content.match(/## Description\n\n([\s\S]*?)(?=\n## |$)/);
  if (descMatch && currentMetadata) {
    currentMetadata.description = descMatch[1].trim();
    content = content.replace(/## Description\n\n[\s\S]*?(?=\n## |$)/, '');
  }

  // Check for empty Key Insights and Action Items sections and add "n/a" placeholder
  content = content.replace(/## Key Insights\n\n(?=## |$)/g, '## Key Insights\n\nn/a\n\n');
  content = content.replace(/## Action Items & Takeaways\n\n(?=## |$)/g, '## Action Items & Takeaways\n\nn/a\n\n');

  // Remove other truly empty sections (but not Key Insights or Action Items)
  content = content.replace(/^## (?!Transcript|Key Insights|Action Items)[^\n]+\n+(?=## |$)/gm, '');
  content = content.replace(/^(## (?!Transcript|Key Insights|Action Items)[^\n]+)\n+---\n*(?=## |$)/gm, '');

  // Parse markdown
  let html = marked.parse(content);

  // Make all links open in new tabs
  html = html.replace(/<a\s+href=/g, '<a target="_blank" rel="noopener noreferrer" href=');

  // Make sections collapsible
  html = makeCollapsibleSections(html);

  elements.output.innerHTML = html;

  // Set up collapsible section click handlers
  elements.output.querySelectorAll('.collapsible-section-header').forEach(header => {
    header.addEventListener('click', () => {
      header.parentElement.classList.toggle('collapsed');
    });
  });

  // Display info in right pane
  displayOriginalTranscript();
  displayMetadata();
}

function parseMetadata(metadataText) {
  const metadata = {};
  const lines = metadataText.split('\n');

  lines.forEach(line => {
    const match = line.match(/^-\s+\*\*([^:]+):\*\*\s*(.+)$/);
    if (match) {
      const key = match[1].toLowerCase().trim();
      metadata[key] = match[2].trim();
    }
  });

  return metadata;
}

function makeCollapsibleSections(html) {
  // Split by h2 tags and wrap each section
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const container = doc.body.firstChild;

  const result = [];
  let currentSection = null;
  let currentContent = [];

  // Sections that should NOT be collapsible (parent sections or key info sections)
  const nonCollapsibleSections = ['tldr', 'metadata', 'description', 'transcript'];

  function hasContent(contentArray) {
    const combined = contentArray.join('').trim();
    // Check if there's actual content (not just whitespace, empty tags, or hr)
    const stripped = combined.replace(/<hr\s*\/?>/gi, '').replace(/<[^>]*>/g, '').trim();
    return stripped.length > 0;
  }

  function addSection() {
    if (!currentSection) return;

    const sectionTitle = currentSection.textContent.toLowerCase().replace(/[^a-z]/g, '');
    const isCollapsible = !nonCollapsibleSections.some(s => sectionTitle.includes(s));
    const contentExists = hasContent(currentContent);

    // Skip collapsible sections with no content, but keep non-collapsible headers (like "Transcript")
    if (!contentExists && isCollapsible) return;

    if (isCollapsible && contentExists) {
      result.push(wrapInCollapsible(currentSection.outerHTML, currentContent.join('')));
    } else {
      // For non-collapsible sections, just render the header and any content
      result.push(currentSection.outerHTML);
      if (contentExists) {
        result.push(currentContent.join(''));
      }
    }
  }

  Array.from(container.childNodes).forEach(node => {
    if (node.nodeName === 'H2') {
      // Save previous section if exists
      addSection();
      currentSection = node;
      currentContent = [];
    } else {
      if (currentSection) {
        currentContent.push(node.outerHTML || node.textContent);
      } else {
        result.push(node.outerHTML || node.textContent);
      }
    }
  });

  // Don't forget the last section
  addSection();

  return result.join('');
}

function wrapInCollapsible(headerHtml, contentHtml) {
  // Extract just the text from the h2
  const titleMatch = headerHtml.match(/<h2[^>]*>(.*?)<\/h2>/i);
  const title = titleMatch ? titleMatch[1] : 'Section';

  return `
    <div class="collapsible-section">
      <div class="collapsible-section-header">
        <h2>${title}</h2>
        <span class="collapse-icon">
          <span class="material-symbols-outlined">expand_more</span>
        </span>
      </div>
      <div class="collapsible-section-content">
        ${contentHtml}
      </div>
    </div>
  `;
}

function displayOriginalTranscript() {
  if (originalTranscript) {
    const paragraphs = originalTranscript
      .split('\n\n')
      .filter(p => p.trim())
      .map(p => `<p>${escapeHtml(p.trim())}</p>`)
      .join('');
    elements.transcriptTab.innerHTML = paragraphs || '<p>' + escapeHtml(originalTranscript) + '</p>';
  } else {
    elements.transcriptTab.innerHTML = `
      <div class="no-content">
        <span class="material-symbols-outlined">subtitles_off</span>
        <p>No transcript available</p>
      </div>
    `;
  }
}

function displayMetadata() {
  if (currentMetadata && Object.keys(currentMetadata).length > 0) {
    const items = [];

    if (currentMetadata.channel) {
      items.push(`<div class="metadata-item"><span class="label">Channel</span><span class="value">${escapeHtml(currentMetadata.channel)}</span></div>`);
    }
    if (currentMetadata.published) {
      items.push(`<div class="metadata-item"><span class="label">Published</span><span class="value">${escapeHtml(currentMetadata.published)}</span></div>`);
    }
    if (currentMetadata.duration) {
      items.push(`<div class="metadata-item"><span class="label">Duration</span><span class="value">${escapeHtml(currentMetadata.duration)}</span></div>`);
    }
    if (currentMetadata.views) {
      items.push(`<div class="metadata-item"><span class="label">Views</span><span class="value">${escapeHtml(currentMetadata.views)}</span></div>`);
    }
    if (currentMetadata.url) {
      items.push(`<div class="metadata-item"><span class="label">URL</span><span class="value"><a href="${escapeHtml(currentMetadata.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(currentMetadata.url)}</a></span></div>`);
    }
    if (currentMetadata.description) {
      items.push(`<div class="metadata-item"><span class="label">Description</span><span class="value">${escapeHtml(currentMetadata.description)}</span></div>`);
    }

    elements.metadataTab.innerHTML = `<div class="metadata-list">${items.join('')}</div>`;
  } else {
    elements.metadataTab.innerHTML = `
      <div class="no-content">
        <span class="material-symbols-outlined">info</span>
        <p>No metadata available</p>
      </div>
    `;
  }
}

function switchInfoTab(tabName) {
  // Expand pane if collapsed
  if (elements.infoPane.classList.contains('collapsed')) {
    elements.infoPane.classList.remove('collapsed');
    const icon = elements.toggleInfoPane.querySelector('.material-symbols-outlined');
    icon.textContent = 'chevron_right';
    elements.toggleInfoPane.title = 'Collapse';
  }

  // Update tab buttons
  elements.infoPaneTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  // Update tab content
  elements.transcriptTab.classList.toggle('active', tabName === 'transcript');
  elements.metadataTab.classList.toggle('active', tabName === 'metadata');
}

function toggleInfoPane() {
  elements.infoPane.classList.toggle('collapsed');
  const icon = elements.toggleInfoPane.querySelector('.material-symbols-outlined');
  if (elements.infoPane.classList.contains('collapsed')) {
    icon.textContent = 'chevron_left';
    elements.toggleInfoPane.title = 'Expand';
  } else {
    icon.textContent = 'chevron_right';
    elements.toggleInfoPane.title = 'Collapse';
  }
}

function toggleTheme() {
  const html = document.documentElement;
  const isLight = html.classList.toggle('light');
  const icon = elements.themeToggleBtn.querySelector('.material-symbols-outlined');

  if (isLight) {
    icon.textContent = 'dark_mode';
    elements.themeToggleBtn.title = 'Switch to dark mode';
    localStorage.setItem('theme', 'light');
  } else {
    icon.textContent = 'light_mode';
    elements.themeToggleBtn.title = 'Switch to light mode';
    localStorage.setItem('theme', 'dark');
  }
}

function loadSavedTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    document.documentElement.classList.add('light');
    elements.themeToggleBtn.querySelector('.material-symbols-outlined').textContent = 'dark_mode';
    elements.themeToggleBtn.title = 'Switch to dark mode';
  }
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
