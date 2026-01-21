import { memo, useRef } from 'react';
import { formatDate } from '../../utils/helpers';

export const HistoryItem = memo(function HistoryItem({
  file,
  isActive,
  isSelected,
  isProcessing,
  onSelect,
  onDelete,
  onToggleSelection,
  onRangeSelection,
}) {
  const wasShiftClickRef = useRef(false);

  const handleClick = (e) => {
    if (e.target.closest('.delete-btn') || e.target.closest('.history-checkbox-label')) {
      return;
    }
    onSelect(file.filename);
  };

  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    wasShiftClickRef.current = e.shiftKey;
  };

  const handleCheckboxChange = (e) => {
    if (wasShiftClickRef.current) {
      onRangeSelection(file.filename);
    } else {
      onToggleSelection(file.filename, e.target.checked);
    }
    wasShiftClickRef.current = false;
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    onDelete(file.filename);
  };

  const className = [
    'history-item',
    isActive && 'active',
    isSelected && 'selected',
    isProcessing && 'processing',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} data-filename={file.filename} onClick={handleClick}>
      <label className="history-checkbox-label" title="Select for bulk delete (Shift+Click to select range)">
        <input
          type="checkbox"
          className="history-checkbox"
          checked={isSelected}
          onClick={handleCheckboxClick}
          onChange={handleCheckboxChange}
        />
      </label>

      <div className="history-item-content">
        <div className="history-item-title" title={file.title}>
          {file.title}
          {isProcessing && <span className="mini-spinner history-spinner" />}
        </div>
        <div className="history-item-meta">
          {isProcessing ? 'Processing...' : formatDate(file.date)}
        </div>
      </div>

      <button
        className="delete-btn"
        title="Delete"
        onClick={handleDeleteClick}
      >
        <span className="material-symbols-outlined">delete</span>
      </button>
    </div>
  );
});
