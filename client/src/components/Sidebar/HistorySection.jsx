import { useRef, useCallback } from 'react';
import { useHistory } from '../../hooks/useHistory';
import { useMultiSummaryAnalysis } from '../../hooks/useMultiSummaryAnalysis';
import { HistoryItem } from './HistoryItem';

export function HistorySection() {
  const {
    history,
    selectedItems,
    loadHistoryItem,
    deleteItem,
    deleteSelectedItems,
    toggleItemSelection,
    toggleSelectAll,
    handleRangeSelection,
    selectAllState,
    setSearchQuery,
    searchQuery,
    currentFilename,
    processingFilename,
  } = useHistory();

  const { openModal: openAnalyzeModal } = useMultiSummaryAnalysis();
  const lastClickedRef = useRef(null);

  const handleSelect = useCallback((filename) => {
    loadHistoryItem(filename);
    lastClickedRef.current = filename;
  }, [loadHistoryItem]);

  const handleToggleSelection = useCallback((filename, checked) => {
    toggleItemSelection(filename, checked);
    lastClickedRef.current = filename;
  }, [toggleItemSelection]);

  const handleRange = useCallback((currentFilename) => {
    handleRangeSelection(currentFilename, lastClickedRef.current);
    lastClickedRef.current = currentFilename;
  }, [handleRangeSelection]);

  const handleSelectAllChange = useCallback((e) => {
    toggleSelectAll(e.target.checked);
  }, [toggleSelectAll]);

  return (
    <div className="history-section">
      <div className="history-header">
        <div className="history-header-left">
          <input
            type="checkbox"
            className="history-checkbox"
            title="Select all"
            checked={selectAllState.checked}
            ref={(el) => {
              if (el) el.indeterminate = selectAllState.indeterminate;
            }}
            onChange={handleSelectAllChange}
          />
          <span className="history-label">SUMMARIES</span>
        </div>
        <div className="history-header-actions">
          <button
            className={`analyze-btn ${selectedItems.size < 2 ? 'hidden' : ''}`}
            title="Analyze selected summaries"
            onClick={openAnalyzeModal}
          >
            <span className="material-symbols-outlined">query_stats</span>
            <span>Analyze</span>
          </button>
          <button
            className={`bulk-delete-btn ${selectedItems.size === 0 ? 'hidden' : ''}`}
            title="Delete selected"
            onClick={deleteSelectedItems}
          >
            <span className="material-symbols-outlined">delete</span>
            <span>{selectedItems.size}</span>
          </button>
        </div>
      </div>

      <div className="history-search">
        <span className="material-symbols-outlined">search</span>
        <input
          type="text"
          placeholder="Search summaries..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="history-list">
        {history.length === 0 ? (
          <p className="empty-state">
            {searchQuery ? 'No matching results' : 'No extractions yet'}
          </p>
        ) : (
          history.map((file) => (
            <HistoryItem
              key={file.filename}
              file={file}
              isActive={file.filename === currentFilename}
              isSelected={selectedItems.has(file.filename)}
              isProcessing={file.filename === processingFilename}
              onSelect={handleSelect}
              onDelete={deleteItem}
              onToggleSelection={handleToggleSelection}
              onRangeSelection={handleRange}
            />
          ))
        )}
      </div>
    </div>
  );
}
