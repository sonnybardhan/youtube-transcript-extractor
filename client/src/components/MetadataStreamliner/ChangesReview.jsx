import { useState, useCallback, useMemo, useEffect } from 'react';

function NormalizationSection({
  title,
  icon,
  items,
  colorClass,
  sectionKey,
  selectedIndices,
  onToggleItem,
  onToggleAll
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Only show items with actual merges (more than 1 alias)
  const mergeItems = useMemo(() =>
    items.filter((item) => item.aliases.length > 1),
    [items]
  );

  if (mergeItems.length === 0) return null;

  const allSelected = mergeItems.length > 0 &&
    mergeItems.every((_, idx) => selectedIndices.includes(idx));
  const someSelected = mergeItems.some((_, idx) => selectedIndices.includes(idx));
  const selectedCount = selectedIndices.length;

  const handleSectionToggle = (e) => {
    e.stopPropagation();
    onToggleAll(sectionKey, !allSelected);
  };

  return (
    <div className="normalization-section">
      <button
        className="normalization-section-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="normalization-section-header-content">
          <label
            className="section-select-all"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected && !allSelected;
              }}
              onChange={handleSectionToggle}
            />
            <span>{allSelected ? 'Deselect' : 'Select'} all</span>
          </label>
          <div className="normalization-section-title">
            <span className={`material-symbols-outlined ${colorClass}`}>{icon}</span>
            <span>{title}</span>
            <span className="normalization-count">{mergeItems.length} normalizations</span>
          </div>
          {selectedCount < mergeItems.length && (
            <span className="selection-count">
              {selectedCount}/{mergeItems.length} selected
            </span>
          )}
        </div>
        <span className={`material-symbols-outlined collapse-icon ${isExpanded ? '' : 'collapsed'}`}>
          expand_more
        </span>
      </button>

      {isExpanded && (
        <div className="normalization-items">
          {mergeItems.map((item, idx) => {
            const isSelected = selectedIndices.includes(idx);
            return (
              <div key={idx} className="normalization-item-row">
                <label className="normalization-checkbox">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleItem(sectionKey, idx)}
                  />
                </label>
                <div className={`normalization-item ${isSelected ? '' : 'excluded'}`}>
                  <div className="normalization-canonical">
                    <span className={`canonical-badge ${colorClass}-bg`}>
                      {item.canonical}
                    </span>
                    <span className="file-count">
                      {item.files.length} file{item.files.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="normalization-aliases">
                    <span className="aliases-label">Merging:</span>
                    {item.aliases
                      .filter((a) => a !== item.canonical)
                      .map((alias, aIdx) => (
                        <span key={aIdx} className="alias-chip">
                          {alias}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ChangesReview({
  proposedChanges,
  changeSummary,
  selectedNormalizations,
  onToggleItem,
  onToggleAll
}) {
  if (!proposedChanges || !changeSummary) return null;

  const { concepts, entities, tags, categories } = proposedChanges;
  const { totalMerges, affectedFileCount, selectedMerges, selectedFileCount } = changeSummary;

  if (totalMerges === 0) {
    return (
      <div className="changes-review">
        <div className="no-changes">
          <span className="material-symbols-outlined">check_circle</span>
          <h3>No Normalizations Needed</h3>
          <p>Your metadata is already consistent! No duplicate terms were found.</p>
        </div>
      </div>
    );
  }

  const displayedMerges = selectedMerges !== undefined ? selectedMerges : totalMerges;
  const displayedFiles = selectedFileCount !== undefined ? selectedFileCount : affectedFileCount;

  return (
    <div className="changes-review">
      <div className="changes-summary">
        <div className="summary-stat">
          <span className="stat-value">
            {displayedMerges}
            {displayedMerges !== totalMerges && (
              <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/{totalMerges}</span>
            )}
          </span>
          <span className="stat-label">Normalizations Selected</span>
        </div>
        <div className="summary-stat">
          <span className="stat-value">
            {displayedFiles}
            {displayedFiles !== affectedFileCount && (
              <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/{affectedFileCount}</span>
            )}
          </span>
          <span className="stat-label">Files to Update</span>
        </div>
      </div>

      <div className="changes-list">
        <NormalizationSection
          title="Concepts"
          icon="lightbulb"
          items={concepts}
          colorClass="concept-color"
          sectionKey="concepts"
          selectedIndices={selectedNormalizations?.concepts || []}
          onToggleItem={onToggleItem}
          onToggleAll={onToggleAll}
        />
        <NormalizationSection
          title="Entities"
          icon="person"
          items={entities}
          colorClass="entity-color"
          sectionKey="entities"
          selectedIndices={selectedNormalizations?.entities || []}
          onToggleItem={onToggleItem}
          onToggleAll={onToggleAll}
        />
        <NormalizationSection
          title="Tags"
          icon="sell"
          items={tags}
          colorClass="tag-color"
          sectionKey="tags"
          selectedIndices={selectedNormalizations?.tags || []}
          onToggleItem={onToggleItem}
          onToggleAll={onToggleAll}
        />
        <NormalizationSection
          title="Categories"
          icon="category"
          items={categories}
          colorClass="category-color"
          sectionKey="categories"
          selectedIndices={selectedNormalizations?.categories || []}
          onToggleItem={onToggleItem}
          onToggleAll={onToggleAll}
        />
      </div>
    </div>
  );
}
