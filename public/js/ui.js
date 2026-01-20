/**
 * UI utilities: theme, loading, modal, toast
 */
import { getElements } from './elements.js';
import { getState, setState } from './state.js';

// ----------------------------------------
// Theme
// ----------------------------------------
export function loadSavedTheme() {
  const elements = getElements();
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') {
    document.documentElement.classList.add('light');
    elements.themeToggleBtn.querySelector('.material-symbols-outlined').textContent = 'dark_mode';
    elements.themeToggleBtn.title = 'Switch to dark mode';
  }
}

export function toggleTheme() {
  const elements = getElements();
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

// ----------------------------------------
// Loading
// ----------------------------------------
export function setLoading(isLoading, resultsOnly = false) {
  const elements = getElements();

  if (resultsOnly) {
    elements.resultsLoading.classList.toggle('hidden', !isLoading);
    if (elements.resultsMain) {
      elements.resultsMain.style.overflow = isLoading ? 'hidden' : '';
    }
  } else {
    elements.loadingOverlay.classList.toggle('hidden', !isLoading);
  }

  elements.extractBtn.disabled = isLoading;
  elements.rerunLlmBtn.disabled = isLoading;
}

// ----------------------------------------
// Toast
// ----------------------------------------
export function showToast(message, type = 'error') {
  const elements = getElements();

  elements.errorMessage.textContent = message;
  elements.errorToast.style.borderColor = type === 'success' ? 'var(--success)' : 'var(--error)';

  const icon = elements.errorToast.querySelector('.material-symbols-outlined');
  icon.textContent = type === 'success' ? 'check_circle' : 'error';
  icon.style.color = type === 'success' ? 'var(--success)' : 'var(--error)';

  elements.errorToast.classList.remove('hidden');

  setTimeout(() => {
    elements.errorToast.classList.add('hidden');
  }, 4000);
}

// ----------------------------------------
// Modal
// ----------------------------------------
export function openPromptModal() {
  const elements = getElements();
  const customPrompt = getState('customPrompt');
  const defaultPrompt = getState('defaultPrompt');

  elements.promptTextarea.value = customPrompt || defaultPrompt;
  elements.promptModal.classList.remove('hidden');
  updateLineNumbers();
  elements.promptTextarea.focus();
}

export function closePromptModal() {
  const elements = getElements();
  elements.promptModal.classList.add('hidden');
}

export async function savePrompt() {
  const elements = getElements();
  const newPrompt = elements.promptTextarea.value.trim();
  const defaultPrompt = getState('defaultPrompt');

  try {
    const res = await fetch('/api/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: newPrompt })
    });

    if (!res.ok) throw new Error('Failed to save prompt');

    setState('customPrompt', newPrompt === defaultPrompt ? null : newPrompt);
    closePromptModal();
    showToast('Prompt saved successfully', 'success');
  } catch (err) {
    showToast(err.message);
  }
}

export function updateLineNumbers() {
  const elements = getElements();
  const lines = elements.promptTextarea.value.split('\n').length;

  // Clear existing line numbers
  elements.lineNumbers.textContent = '';

  // Create line number elements safely
  const count = Math.max(lines, 20);
  for (let i = 1; i <= count; i++) {
    const span = document.createElement('span');
    span.textContent = i;
    elements.lineNumbers.appendChild(span);
  }
}

export function syncLineNumbersScroll() {
  const elements = getElements();
  elements.lineNumbers.scrollTop = elements.promptTextarea.scrollTop;
}

// ----------------------------------------
// Info Pane
// ----------------------------------------
export function switchInfoTab(tabName) {
  const elements = getElements();

  if (elements.infoPane.classList.contains('collapsed')) {
    elements.infoPane.classList.remove('collapsed');
    const icon = elements.toggleInfoPane.querySelector('.material-symbols-outlined');
    icon.textContent = 'chevron_right';
    elements.toggleInfoPane.title = 'Collapse';
  }

  elements.infoPaneTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  elements.transcriptTab.classList.toggle('active', tabName === 'transcript');
  elements.metadataTab.classList.toggle('active', tabName === 'metadata');
  elements.signalTab.classList.toggle('active', tabName === 'signal');
}

export function toggleInfoPane() {
  const elements = getElements();

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

// ----------------------------------------
// Keyboard Shortcuts
// ----------------------------------------
export function handleKeyboardShortcuts(e) {
  const elements = getElements();

  if (e.key === 'Escape' && !elements.promptModal.classList.contains('hidden')) {
    closePromptModal();
  }

  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !elements.promptModal.classList.contains('hidden')) {
    e.preventDefault();
    savePrompt();
  }
}

// ----------------------------------------
// Clipboard
// ----------------------------------------
export function handleCopyMarkdown() {
  const currentMarkdown = getState('currentMarkdown');
  if (!currentMarkdown) return;

  navigator.clipboard.writeText(currentMarkdown).then(() => {
    showToast('Copied to clipboard', 'success');
  }).catch(() => {
    showToast('Failed to copy');
  });
}
