/**
 * History management functions
 */
import { getElements } from './elements.js';
import { setState } from './state.js';
import { escapeHtml, formatDate } from './utils.js';
import { showToast } from './ui.js';
import { showResultsView } from './views.js';

export async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    const files = await res.json();
    renderHistory(files);
  } catch (err) {
    console.error('Failed to load history:', err);
  }
}

export function renderHistory(files) {
  const elements = getElements();

  if (files.length === 0) {
    elements.historyList.textContent = '';
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'No extractions yet';
    elements.historyList.appendChild(emptyState);
    return;
  }

  elements.historyList.textContent = '';

  files.forEach(file => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.dataset.filename = file.filename;

    const content = document.createElement('div');
    content.className = 'history-item-content';

    const title = document.createElement('div');
    title.className = 'history-item-title';
    title.title = file.title;
    title.textContent = file.title;

    const meta = document.createElement('div');
    meta.className = 'history-item-meta';
    meta.textContent = formatDate(file.date);

    content.appendChild(title);
    content.appendChild(meta);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.dataset.filename = file.filename;
    deleteBtn.title = 'Delete';
    const deleteIcon = document.createElement('span');
    deleteIcon.className = 'material-symbols-outlined';
    deleteIcon.textContent = 'delete';
    deleteBtn.appendChild(deleteIcon);

    item.appendChild(content);
    item.appendChild(deleteBtn);

    // Click handler for loading item
    item.addEventListener('click', (e) => {
      if (e.target.closest('.delete-btn')) return;
      loadHistoryItem(file.filename);
    });

    // Click handler for delete button
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteHistoryItem(file.filename);
    });

    elements.historyList.appendChild(item);
  });
}

export async function loadHistoryItem(filename) {
  const elements = getElements();

  try {
    const res = await fetch(`/api/history/${encodeURIComponent(filename)}`);
    if (!res.ok) throw new Error('Failed to load file');

    const data = await res.json();
    setState('currentMarkdown', data.content);
    setState('currentFilename', filename);
    setState('currentModel', null); // Model info not available for historical items

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

export async function deleteHistoryItem(filename) {
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
