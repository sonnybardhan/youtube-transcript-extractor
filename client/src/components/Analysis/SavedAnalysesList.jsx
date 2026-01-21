import { useState, useMemo } from 'react';
import { SavedAnalysisItem } from './SavedAnalysisItem';

export function SavedAnalysesList({ analyses }) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAnalyses = useMemo(() => {
    if (!analyses || !searchQuery.trim()) return analyses || [];
    const query = searchQuery.toLowerCase();
    return analyses.filter((a) =>
      a.title?.toLowerCase().includes(query) ||
      a.filename?.toLowerCase().includes(query)
    );
  }, [analyses, searchQuery]);

  const isEmpty = !analyses || analyses.length === 0;

  return (
    <div className="saved-analyses-list">
      <div className="saved-analyses-sticky-header">
        <div className="saved-analyses-header">
          <h3>
            <span className="material-symbols-outlined">history</span>
            Saved Analyses
          </h3>
          {!isEmpty && <span className="saved-count">{analyses.length}</span>}
        </div>

        {!isEmpty && (
          <div className="saved-analyses-search">
            <span className="material-symbols-outlined">search</span>
            <input
              type="text"
              placeholder="Search analyses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}
      </div>

      {isEmpty ? (
        <div className="saved-analyses-empty">
          <span className="material-symbols-outlined">folder_open</span>
          <p>No saved analyses yet</p>
          <p className="hint">Run an analysis and save it to see it here</p>
        </div>
      ) : (
        <div className="saved-analyses-items">
          {filteredAnalyses.length === 0 ? (
            <p className="empty-state">No matching results</p>
          ) : (
            filteredAnalyses.map((analysis) => (
              <SavedAnalysisItem key={analysis.filename} analysis={analysis} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
