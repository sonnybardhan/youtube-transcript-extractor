import { useState } from 'react';

export function MetadataSection({ title, icon, terms, type, selectedTerms, onToggle, isSelected }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const selectedCount = selectedTerms?.length || 0;

  if (terms.length === 0) {
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
          <span className="section-count">({terms.length})</span>
        </div>
        <div className="section-header-right">
          {selectedCount > 0 && (
            <span className="selected-badge">{selectedCount}</span>
          )}
          <span className="material-symbols-outlined expand-icon">
            {isExpanded ? 'expand_less' : 'expand_more'}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="section-content">
          {terms.map((termData) => {
            const checked = isSelected(type, termData.term);
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
                <span className="term-count">{termData.count}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
