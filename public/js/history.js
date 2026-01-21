/**
 * History management functions
 */
import { getElements } from './elements.js';
import { getState, setState } from './state.js';
import { formatDate } from './utils.js';
import { showToast } from './ui.js';
import { showResultsView, showInputView, updateSignalPane, updateInfoPane } from './views.js';

// Selection state
let selectedItems = new Set();
let lastClickedFilename = null; // Track last clicked checkbox for Shift+Click

// Full history data for filtering
let allFiles = [];

// Delete confirmation promise resolver
let deleteConfirmResolver = null;

/**
 * Show custom delete confirmation modal
 * @param {string} title - Modal title
 * @param {string} message - Modal message
 * @returns {Promise<boolean>} - Resolves true if confirmed, false if cancelled
 */
function showDeleteConfirm(title, message) {
  const elements = getElements();

  elements.deleteModalTitle.textContent = title;
  elements.deleteModalMessage.textContent = message;
  elements.deleteModal.classList.remove('hidden');

  return new Promise((resolve) => {
    deleteConfirmResolver = resolve;
  });
}

function handleDeleteConfirm() {
  const elements = getElements();
  elements.deleteModal.classList.add('hidden');
  if (deleteConfirmResolver) {
    deleteConfirmResolver(true);
    deleteConfirmResolver = null;
  }
}

function handleDeleteCancel() {
  const elements = getElements();
  elements.deleteModal.classList.add('hidden');
  if (deleteConfirmResolver) {
    deleteConfirmResolver(false);
    deleteConfirmResolver = null;
  }
}

export function initHistorySelection() {
  const elements = getElements();

  // Select-all checkbox handler
  elements.selectAllHistory.addEventListener('change', (e) => {
    toggleSelectAll(e.target.checked);
  });

  // Bulk delete button handler
  elements.bulkDeleteBtn.addEventListener('click', deleteSelectedItems);

  // Delete modal handlers
  elements.deleteConfirmBtn.addEventListener('click', handleDeleteConfirm);
  elements.deleteCancelBtn.addEventListener('click', handleDeleteCancel);
  elements.deleteModal.addEventListener('click', (e) => {
    if (e.target === elements.deleteModal) handleDeleteCancel();
  });

  // Search input handler
  elements.historySearchInput.addEventListener('input', (e) => {
    filterHistory(e.target.value);
  });
}

function filterHistory(query) {
  const normalizedQuery = query.toLowerCase().trim();

  if (!normalizedQuery) {
    // Show all items when search is empty
    renderHistory(allFiles);
    return;
  }

  const filtered = allFiles.filter(file =>
    file.title.toLowerCase().includes(normalizedQuery)
  );

  renderHistory(filtered, true);
}

function toggleSelectAll(checked) {
  const elements = getElements();
  const historyItems = elements.historyList.querySelectorAll('.history-item');

  selectedItems.clear();

  historyItems.forEach(item => {
    const filename = item.dataset.filename;
    const checkbox = item.querySelector('.history-checkbox');

    if (checked) {
      selectedItems.add(filename);
      item.classList.add('selected');
      if (checkbox) checkbox.checked = true;
    } else {
      item.classList.remove('selected');
      if (checkbox) checkbox.checked = false;
    }
  });

  updateBulkDeleteUI();
}

function toggleItemSelection(filename, checked) {
  const elements = getElements();
  const item = elements.historyList.querySelector(`.history-item[data-filename="${filename}"]`);

  if (checked) {
    selectedItems.add(filename);
    if (item) item.classList.add('selected');
  } else {
    selectedItems.delete(filename);
    if (item) item.classList.remove('selected');
  }

  updateSelectAllState();
  updateBulkDeleteUI();
}

/**
 * Handle Shift+Click range selection
 * Selects/deselects all items between last clicked and current
 * @param {string} currentFilename - Filename of the currently clicked item
 * @param {HTMLElement[]} items - Array of history item elements
 */
function handleRangeSelection(currentFilename, items) {
  if (!lastClickedFilename || !items.length) {
    lastClickedFilename = currentFilename;
    return;
  }

  // Find indices of anchor and current items
  let anchorIndex = -1;
  let currentIndex = -1;

  for (let i = 0; i < items.length; i++) {
    const filename = items[i].dataset.filename;
    if (filename === lastClickedFilename) anchorIndex = i;
    if (filename === currentFilename) currentIndex = i;
  }

  if (anchorIndex === -1 || currentIndex === -1) {
    lastClickedFilename = currentFilename;
    return;
  }

  const start = Math.min(anchorIndex, currentIndex);
  const end = Math.max(anchorIndex, currentIndex);

  // Determine action based on the anchor item's state
  const shouldSelect = selectedItems.has(lastClickedFilename);

  // Select/deselect all items in range (inclusive of both ends)
  for (let i = start; i <= end; i++) {
    const item = items[i];
    const filename = item.dataset.filename;
    const checkbox = item.querySelector('input.history-checkbox');

    if (shouldSelect) {
      selectedItems.add(filename);
      item.classList.add('selected');
      if (checkbox) checkbox.checked = true;
    } else {
      selectedItems.delete(filename);
      item.classList.remove('selected');
      if (checkbox) checkbox.checked = false;
    }
  }

  // Update anchor for next shift-click
  lastClickedFilename = currentFilename;

  updateSelectAllState();
  updateBulkDeleteUI();
}

function updateSelectAllState() {
  const elements = getElements();
  const historyItems = elements.historyList.querySelectorAll('.history-item');
  const totalItems = historyItems.length;

  if (totalItems === 0) {
    elements.selectAllHistory.checked = false;
    elements.selectAllHistory.indeterminate = false;
  } else if (selectedItems.size === 0) {
    elements.selectAllHistory.checked = false;
    elements.selectAllHistory.indeterminate = false;
  } else if (selectedItems.size === totalItems) {
    elements.selectAllHistory.checked = true;
    elements.selectAllHistory.indeterminate = false;
  } else {
    elements.selectAllHistory.checked = false;
    elements.selectAllHistory.indeterminate = true;
  }
}

function updateBulkDeleteUI() {
  const elements = getElements();
  const count = selectedItems.size;

  if (count > 0) {
    elements.bulkDeleteBtn.classList.remove('hidden');
    elements.bulkDeleteCount.textContent = count;
  } else {
    elements.bulkDeleteBtn.classList.add('hidden');
  }
}

async function deleteSelectedItems() {
  const count = selectedItems.size;
  if (count === 0) return;

  const confirmed = await showDeleteConfirm(
    `Delete ${count} Extraction${count > 1 ? 's' : ''}?`,
    `This will permanently delete ${count} selected item${count > 1 ? 's' : ''}. This action cannot be undone.`
  );
  if (!confirmed) return;

  const elements = getElements();
  const currentFilename = getState('currentFilename');
  const itemsToDelete = [...selectedItems];
  const deletingCurrent = itemsToDelete.includes(currentFilename);

  // Find first non-deleted item to select after bulk delete
  let nextFilename = null;
  if (deletingCurrent) {
    const items = Array.from(elements.historyList.querySelectorAll('.history-item'));
    for (const item of items) {
      if (!itemsToDelete.includes(item.dataset.filename)) {
        nextFilename = item.dataset.filename;
        break;
      }
    }
  }

  let errors = [];

  for (const filename of itemsToDelete) {
    try {
      const res = await fetch(`/api/history/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        errors.push(filename);
      }
    } catch (err) {
      errors.push(filename);
    }
  }

  clearSelection();
  await loadHistory();

  // Auto-select next available item if current was deleted
  if (deletingCurrent && !errors.includes(currentFilename)) {
    if (nextFilename && !itemsToDelete.includes(nextFilename)) {
      await loadHistoryItem(nextFilename);
    } else {
      // Check if any items remain after reload
      const remainingItems = elements.historyList.querySelectorAll('.history-item');
      if (remainingItems.length > 0) {
        await loadHistoryItem(remainingItems[0].dataset.filename);
      } else {
        showInputView();
      }
    }
  }

  if (errors.length > 0) {
    showToast(`Failed to delete ${errors.length} item${errors.length > 1 ? 's' : ''}`);
  }
}

function clearSelection() {
  const elements = getElements();
  selectedItems.clear();
  lastClickedFilename = null;
  elements.selectAllHistory.checked = false;
  elements.selectAllHistory.indeterminate = false;
  updateBulkDeleteUI();
}

export async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    const files = await res.json();
    allFiles = files; // Store for filtering
    renderHistory(files);

    // Clear search input when reloading
    const elements = getElements();
    if (elements.historySearchInput) {
      elements.historySearchInput.value = '';
    }
  } catch (err) {
    console.error('Failed to load history:', err);
  }
}

export function renderHistory(files, isFiltered = false) {
  const elements = getElements();
  const processingFilename = getState('processingFilename');

  // Clear selection state when re-rendering
  selectedItems.clear();
  updateSelectAllState();
  updateBulkDeleteUI();

  if (files.length === 0) {
    elements.historyList.textContent = '';
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent = isFiltered ? 'No matching results' : 'No extractions yet';
    elements.historyList.appendChild(emptyState);
    return;
  }

  elements.historyList.textContent = '';

  files.forEach(file => {
    const isProcessing = file.filename === processingFilename;
    const item = document.createElement('div');
    item.className = 'history-item' + (isProcessing ? ' processing' : '');
    item.dataset.filename = file.filename;

    // Checkbox for selection
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'history-checkbox';
    checkbox.title = 'Select for bulk delete (Shift+Click to select range)';
    // Track if shift was held during click
    let wasShiftClick = false;

    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
      wasShiftClick = e.shiftKey;
    });

    checkbox.addEventListener('change', (e) => {
      if (wasShiftClick && lastClickedFilename && lastClickedFilename !== file.filename) {
        // Shift+Click with different anchor: select/deselect range
        const items = Array.from(elements.historyList.querySelectorAll('.history-item'));
        const shouldSelect = selectedItems.has(lastClickedFilename);

        // Find indices
        let anchorIdx = -1, currentIdx = -1;
        items.forEach((itm, i) => {
          if (itm.dataset.filename === lastClickedFilename) anchorIdx = i;
          if (itm.dataset.filename === file.filename) currentIdx = i;
        });

        if (anchorIdx !== -1 && currentIdx !== -1) {
          const start = Math.min(anchorIdx, currentIdx);
          const end = Math.max(anchorIdx, currentIdx);

          for (let i = start; i <= end; i++) {
            const itm = items[i];
            const fname = itm.dataset.filename;
            const cb = itm.querySelector('input.history-checkbox');

            if (shouldSelect) {
              selectedItems.add(fname);
              itm.classList.add('selected');
              if (cb) cb.checked = true;
            } else {
              selectedItems.delete(fname);
              itm.classList.remove('selected');
              if (cb) cb.checked = false;
            }
          }

          updateSelectAllState();
          updateBulkDeleteUI();
        }

        // Update anchor
        lastClickedFilename = file.filename;
      } else {
        // Normal click: just toggle this item
        toggleItemSelection(file.filename, e.target.checked);
        lastClickedFilename = file.filename;
      }

      wasShiftClick = false;
    });

    const content = document.createElement('div');
    content.className = 'history-item-content';

    const titleRow = document.createElement('div');
    titleRow.className = 'history-item-title';
    titleRow.title = file.title;
    titleRow.textContent = file.title;

    // Add spinner for processing items
    if (isProcessing) {
      const spinner = document.createElement('span');
      spinner.className = 'mini-spinner history-spinner';
      titleRow.appendChild(spinner);
    }

    const meta = document.createElement('div');
    meta.className = 'history-item-meta';
    meta.textContent = isProcessing ? 'Processing...' : formatDate(file.date);

    content.appendChild(titleRow);
    content.appendChild(meta);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.dataset.filename = file.filename;
    deleteBtn.title = 'Delete';
    const deleteIcon = document.createElement('span');
    deleteIcon.className = 'material-symbols-outlined';
    deleteIcon.textContent = 'delete';
    deleteBtn.appendChild(deleteIcon);

    item.appendChild(checkbox);
    item.appendChild(content);
    item.appendChild(deleteBtn);

    // Click handler for loading item
    item.addEventListener('click', (e) => {
      if (e.target.closest('.delete-btn') || e.target.closest('.history-checkbox')) return;
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

/**
 * Parse Knowledge Graph section from markdown content
 * @param {string} markdown - The markdown content
 * @returns {object|null} - Parsed metadata or null if not found
 */
function parseKnowledgeGraph(markdown) {
  const kgMatch = markdown.match(/## Knowledge Graph\n\n([\s\S]*?)(?=\n## |$)/);
  if (!kgMatch) return null;

  const kgSection = kgMatch[1];
  const metadata = {};

  // Parse category
  const categoryMatch = kgSection.match(/\*\*Category:\*\*\s*(.+)/);
  if (categoryMatch) {
    metadata.category = categoryMatch[1].trim();
  }

  // Parse concepts (comma-separated)
  const conceptsMatch = kgSection.match(/\*\*Concepts:\*\*\s*(.+)/);
  if (conceptsMatch) {
    metadata.concepts = conceptsMatch[1].split(',').map(c => c.trim()).filter(c => c);
  }

  // Parse entities (comma-separated)
  const entitiesMatch = kgSection.match(/\*\*Entities:\*\*\s*(.+)/);
  if (entitiesMatch) {
    metadata.entities = entitiesMatch[1].split(',').map(e => e.trim()).filter(e => e);
  }

  // Parse tags (comma-separated)
  const tagsMatch = kgSection.match(/\*\*Tags:\*\*\s*(.+)/);
  if (tagsMatch) {
    metadata.suggestedTags = tagsMatch[1].split(',').map(t => t.trim()).filter(t => t);
  }

  return metadata;
}

/**
 * Parse metadata from markdown content for reprocessing
 * @param {string} markdown - The markdown content
 * @param {string} title - The video title
 * @returns {object} - Parsed basicInfo-like object
 */
function parseMetadataForRerun(markdown, title) {
  const metadata = { title, hasTranscript: false };

  // Extract original transcript from details section
  const detailsMatch = markdown.match(
    /<details>\s*<summary>Original Transcript<\/summary>([\s\S]*?)<\/details>/i
  );
  if (detailsMatch) {
    metadata.transcript = detailsMatch[1].trim();
    metadata.transcriptFormatted = metadata.transcript;
    metadata.hasTranscript = true;
  }

  // Parse metadata section
  const metadataMatch = markdown.match(/## Metadata\n\n([\s\S]*?)(?=\n## |$)/);
  if (metadataMatch) {
    const section = metadataMatch[1];

    const channelMatch = section.match(/\*\*Channel:\*\*\s*(.+)/);
    if (channelMatch) metadata.channel = channelMatch[1].trim();

    const publishMatch = section.match(/\*\*Published:\*\*\s*(.+)/);
    if (publishMatch) metadata.publishDate = publishMatch[1].trim();

    const durationMatch = section.match(/\*\*Duration:\*\*\s*(.+)/);
    if (durationMatch) metadata.duration = durationMatch[1].trim();

    const viewsMatch = section.match(/\*\*Views:\*\*\s*(.+)/);
    if (viewsMatch) metadata.views = viewsMatch[1].trim();

    const urlMatch = section.match(/\*\*URL:\*\*\s*https:\/\/youtube\.com\/watch\?v=([^\s\n]+)/);
    if (urlMatch) metadata.videoId = urlMatch[1].trim();
  }

  // Parse description section
  const descMatch = markdown.match(/## Description\n\n([\s\S]*?)(?=\n## |$)/);
  if (descMatch) {
    metadata.description = descMatch[1].trim();
  }

  return metadata;
}

export async function loadHistoryItem(filename) {
  const elements = getElements();
  const processingFilename = getState('processingFilename');

  // If clicking on the currently processing item, restore streaming view
  if (filename === processingFilename) {
    const restoreStreamingViewFn = getState('restoreStreamingViewFn');
    if (restoreStreamingViewFn && restoreStreamingViewFn()) {
      // Update active state
      elements.historyList.querySelectorAll('.history-item').forEach(item => {
        item.classList.toggle('active', item.dataset.filename === filename);
      });
      return;
    }
  }

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

    // Parse metadata for rerun capability
    const parsedMetadata = parseMetadataForRerun(data.content, title);
    setState('currentMetadata', parsedMetadata);

    showResultsView(data.content, title);

    // Update info pane with transcript and metadata
    updateInfoPane(parsedMetadata);

    // Display signal data if available (from .signal.json file)
    // Falls back to parsing from markdown for backwards compatibility
    if (data.signal) {
      updateSignalPane(data.signal);
    } else {
      const knowledgeGraph = parseKnowledgeGraph(data.content);
      updateSignalPane(knowledgeGraph);
    }

    // Update active state
    elements.historyList.querySelectorAll('.history-item').forEach(item => {
      item.classList.toggle('active', item.dataset.filename === filename);
    });
  } catch (err) {
    showToast(err.message);
  }
}

export async function deleteHistoryItem(filename) {
  // Extract title from filename for better UX
  const title = filename.replace(/\.md$/, '').slice(0, 50);
  const confirmed = await showDeleteConfirm(
    'Delete Extraction?',
    `"${title}${filename.length > 53 ? '...' : ''}" will be permanently deleted.`
  );
  if (!confirmed) return;

  const elements = getElements();
  const currentFilename = getState('currentFilename');
  const wasActive = filename === currentFilename;

  // Find next/previous item before deletion
  let nextFilename = null;
  if (wasActive) {
    const items = Array.from(elements.historyList.querySelectorAll('.history-item'));
    const currentIndex = items.findIndex(item => item.dataset.filename === filename);
    if (currentIndex !== -1) {
      // Prefer next item, fallback to previous
      const nextItem = items[currentIndex + 1] || items[currentIndex - 1];
      nextFilename = nextItem?.dataset.filename || null;
    }
  }

  try {
    const res = await fetch(`/api/history/${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete');

    await loadHistory();

    // Auto-select next/previous item if the deleted item was active
    if (wasActive) {
      if (nextFilename) {
        await loadHistoryItem(nextFilename);
      } else {
        // No items left - go back to input view
        showInputView();
      }
    }
  } catch (err) {
    showToast(err.message);
  }
}
