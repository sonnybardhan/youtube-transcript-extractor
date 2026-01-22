import { useState, useMemo } from 'react';

export function MetadataSection({ title, icon, terms, type, selectedTerms, onToggle, isSelected, hasActiveFilter, onClearCategory }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const selectedCount = selectedTerms?.length || 0;

  const handleClearClick = (e) => {
    e.stopPropagation();
    onClearCategory?.(type);
  };

  // Filter out unavailable terms, but always keep selected ones visible
  const visibleTerms = useMemo(() => {
    if (!hasActiveFilter) return terms;
    return terms.filter((t) => t.available !== false);
  }, [terms, hasActiveFilter]);

  if (visibleTerms.length === 0) {
    return null;
  }

  return (
    <div className={`metadata-section ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <button
        className="section-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="section-header-left">
          <span className="material-symbols-outlined section-icon">{icon}</span>
          <span className="section-title">{title}</span>
          <span className="section-count">({visibleTerms.length})</span>
        </div>
        <div className="section-header-right">
          {selectedCount > 0 && (
            <>
              <span className="selected-badge">{selectedCount}</span>
              <button
                className="section-clear-btn"
                onClick={handleClearClick}
                title={`Clear ${title.toLowerCase()} filter`}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </>
          )}
          <span className="material-symbols-outlined expand-icon">
            {isExpanded ? 'expand_less' : 'expand_more'}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="section-content">
          {visibleTerms.map((termData) => {
            const checked = isSelected(type, termData.term);
            // Show filtered count when filter is active, otherwise original count
            const displayCount = hasActiveFilter && termData.filteredCount !== undefined
              ? termData.filteredCount
              : termData.count;
            return (
              <label
                key={termData.term}
                className={`term-item ${checked ? 'selected' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(type, termData.term)}
                />
                <span className="term-name">{termData.term}</span>
                <span className="term-count">{displayCount}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
