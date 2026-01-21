import { useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { fetchHistoryItem, deleteHistoryItem as apiDeleteHistoryItem, fetchAnnotations, rebuildMetadataIndex } from '../utils/api';
import { parseMetadataForRerun, parseKnowledgeGraph } from '../utils/markdown';

export function useHistory() {
  const { state, actions, reloadHistory } = useApp();
  const { history, selectedItems, searchQuery, currentFilename, processingFilename } = state;

  // Filter history based on search query
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) {
      return history;
    }
    const normalizedQuery = searchQuery.toLowerCase().trim();
    return history.filter((file) =>
      file.title.toLowerCase().includes(normalizedQuery)
    );
  }, [history, searchQuery]);

  const loadHistoryItem = useCallback(async (filename) => {
    // If clicking on the currently processing item, restore streaming view
    if (filename === processingFilename && state.streamingState) {
      actions.setView('results');
      // The streaming state will be restored via the component
      return { streaming: true };
    }

    try {
      // Fetch both file content and annotations in parallel
      const [data, annotations] = await Promise.all([
        fetchHistoryItem(filename),
        fetchAnnotations(filename).catch(() => []), // Don't fail if no annotations
      ]);

      // Extract title from markdown
      const titleMatch = data.content.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1] : filename.replace('.md', '');

      // Parse metadata for rerun capability
      const parsedMetadata = parseMetadataForRerun(data.content, title);

      actions.setCurrentExtraction({
        markdown: data.content,
        filename,
        metadata: parsedMetadata,
        transcript: parsedMetadata.transcript || '',
        model: null, // Model info not available for historical items
      });

      // Display signal data if available
      if (data.signal) {
        actions.setSignalData(data.signal);
      } else {
        const knowledgeGraph = parseKnowledgeGraph(data.content);
        actions.setSignalData(knowledgeGraph);
      }

      // Load annotations
      actions.setAnnotations(annotations);

      actions.setView('results');
      actions.setCurrentPage('main'); // Navigate to main page to view summary
      return { success: true, content: data.content, title };
    } catch (err) {
      actions.showToast(err.message);
      return { error: err.message };
    }
  }, [state.streamingState, processingFilename, actions]);

  const deleteItem = useCallback(async (filename) => {
    const title = filename.replace(/\.md$/, '').slice(0, 50);

    actions.setDeleteModal(true, {
      title: 'Delete Extraction?',
      message: `"${title}${filename.length > 53 ? '...' : ''}" will be permanently deleted.`,
      filename,
      onConfirm: async () => {
        const wasActive = filename === currentFilename;

        try {
          await apiDeleteHistoryItem(filename);
          await reloadHistory();

          // Rebuild metadata index after deletion
          rebuildMetadataIndex().catch(() => {});

          // If the deleted item was active, clear or select next
          if (wasActive) {
            const remainingHistory = history.filter((h) => h.filename !== filename);
            if (remainingHistory.length > 0) {
              await loadHistoryItem(remainingHistory[0].filename);
            } else {
              actions.clearCurrent();
              actions.setView('input');
            }
          }
        } catch (err) {
          actions.showToast(err.message);
        }

        actions.setDeleteModal(false);
      },
    });
  }, [currentFilename, history, actions, reloadHistory, loadHistoryItem]);

  const deleteSelectedItems = useCallback(async () => {
    const count = selectedItems.size;
    if (count === 0) return;

    actions.setDeleteModal(true, {
      title: `Delete ${count} Extraction${count > 1 ? 's' : ''}?`,
      message: `This will permanently delete ${count} selected item${count > 1 ? 's' : ''}. This action cannot be undone.`,
      onConfirm: async () => {
        const itemsToDelete = [...selectedItems];
        const deletingCurrent = itemsToDelete.includes(currentFilename);
        let errors = [];

        for (const filename of itemsToDelete) {
          try {
            await apiDeleteHistoryItem(filename);
          } catch (err) {
            errors.push(filename);
          }
        }

        actions.setSelectedItems(new Set());
        await reloadHistory();

        // Rebuild metadata index after deletion
        rebuildMetadataIndex().catch(() => {});

        // Auto-select next available item if current was deleted
        if (deletingCurrent && !errors.includes(currentFilename)) {
          const remaining = history.filter((h) => !itemsToDelete.includes(h.filename));
          if (remaining.length > 0) {
            await loadHistoryItem(remaining[0].filename);
          } else {
            actions.clearCurrent();
            actions.setView('input');
          }
        }

        if (errors.length > 0) {
          actions.showToast(`Failed to delete ${errors.length} item${errors.length > 1 ? 's' : ''}`);
        }

        actions.setDeleteModal(false);
      },
    });
  }, [selectedItems, currentFilename, history, actions, reloadHistory, loadHistoryItem]);

  const toggleItemSelection = useCallback((filename, checked) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(filename);
    } else {
      newSelected.delete(filename);
    }
    actions.setSelectedItems(newSelected);
  }, [selectedItems, actions]);

  const toggleSelectAll = useCallback((checked) => {
    if (checked) {
      const allFilenames = filteredHistory.map((h) => h.filename);
      actions.setSelectedItems(new Set(allFilenames));
    } else {
      actions.setSelectedItems(new Set());
    }
  }, [filteredHistory, actions]);

  const handleRangeSelection = useCallback((currentFilename, lastFilename) => {
    if (!lastFilename) return;

    const items = filteredHistory;
    let anchorIndex = -1;
    let currentIndex = -1;

    for (let i = 0; i < items.length; i++) {
      if (items[i].filename === lastFilename) anchorIndex = i;
      if (items[i].filename === currentFilename) currentIndex = i;
    }

    if (anchorIndex === -1 || currentIndex === -1) return;

    const start = Math.min(anchorIndex, currentIndex);
    const end = Math.max(anchorIndex, currentIndex);
    const shouldSelect = selectedItems.has(lastFilename);

    const newSelected = new Set(selectedItems);
    for (let i = start; i <= end; i++) {
      const filename = items[i].filename;
      if (shouldSelect) {
        newSelected.add(filename);
      } else {
        newSelected.delete(filename);
      }
    }

    actions.setSelectedItems(newSelected);
  }, [filteredHistory, selectedItems, actions]);

  const selectAllState = useMemo(() => {
    const total = filteredHistory.length;
    const selected = selectedItems.size;

    if (total === 0 || selected === 0) {
      return { checked: false, indeterminate: false };
    }
    if (selected === total) {
      return { checked: true, indeterminate: false };
    }
    return { checked: false, indeterminate: true };
  }, [filteredHistory.length, selectedItems.size]);

  return {
    history: filteredHistory,
    selectedItems,
    loadHistoryItem,
    deleteItem,
    deleteSelectedItems,
    toggleItemSelection,
    toggleSelectAll,
    handleRangeSelection,
    selectAllState,
    setSearchQuery: actions.setSearchQuery,
    searchQuery,
    currentFilename,
    processingFilename,
  };
}
