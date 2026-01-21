import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useMetadataExplorer } from '../../hooks/useMetadataExplorer';
import { MetadataSection } from './MetadataSection';
import { MatchingFilesList } from './MatchingFilesList';

export function MetadataExplorerPage() {
  const { actions } = useApp();
  const {
    metadataIndex,
    indexedTerms,
    selectedTerms,
    filterMode,
    matchingFiles,
    selectedTermCount,
    isLoading,
    isRebuilding,
    error,
    loadIndex,
    rebuildIndex,
    toggleTerm,
    isTermSelected,
    clearAllSelections,
    toggleFilterMode,
    navigateToFile,
  } = useMetadataExplorer();

  const [searchQuery, setSearchQuery] = useState('');

  // Load the index when the page mounts
  useEffect(() => {
    if (!metadataIndex) {
      loadIndex();
    }
  }, [metadataIndex, loadIndex]);

  const handleBack = () => {
    actions.setCurrentPage('main');
  };

  // Filter terms by search query
  const filterTerms = (terms) => {
    if (!searchQuery.trim()) return terms;
    const query = searchQuery.toLowerCase();
    return terms.filter((t) => t.term.toLowerCase().includes(query));
  };

  const totalTerms =
    indexedTerms.concepts.length +
    indexedTerms.entities.length +
    indexedTerms.tags.length +
    indexedTerms.categories.length;

  return (
    <div className="metadata-explorer-page">
      {error && !metadataIndex && (
        <div className="explorer-error">
          <span className="material-symbols-outlined">error</span>
          <p>{error}</p>
          <button className="rebuild-btn primary" onClick={rebuildIndex} disabled={isRebuilding}>
            {isRebuilding ? (
              <>
                <span className="spinner" />
                Building...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">build</span>
                Build Index
              </>
            )}
          </button>
        </div>
      )}

      {isLoading && !metadataIndex && (
        <div className="explorer-loading">
          <span className="spinner" />
          <p>Loading metadata index...</p>
        </div>
      )}

      {metadataIndex && (
        <div className="explorer-content">
          <div className="explorer-sidebar">
            <div className="explorer-sidebar-top">
              <button className="back-btn" onClick={handleBack}>
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <div className="explorer-sidebar-actions">
                <button
                  className={`filter-mode-btn ${filterMode.toLowerCase()}`}
                  onClick={toggleFilterMode}
                  title={filterMode === 'AND' ? 'Match ALL selected terms' : 'Match ANY selected term'}
                >
                  <span className="material-symbols-outlined">
                    {filterMode === 'AND' ? 'join_inner' : 'join_full'}
                  </span>
                  {filterMode}
                </button>
                <button
                  className="clear-all-btn"
                  onClick={clearAllSelections}
                  disabled={selectedTermCount === 0}
                >
                  <span className="material-symbols-outlined">clear_all</span>
                  Clear All
                </button>
              </div>
            </div>
            <div className="explorer-sidebar-header">
              <div className="search-box">
                <span className="material-symbols-outlined">search</span>
                <input
                  type="text"
                  placeholder="Filter terms..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button className="clear-search" onClick={() => setSearchQuery('')}>
                    <span className="material-symbols-outlined">close</span>
                  </button>
                )}
              </div>
              <button
                className="rebuild-btn"
                onClick={rebuildIndex}
                disabled={isRebuilding}
                title="Rebuild index from signal files"
              >
                {isRebuilding ? (
                  <span className="spinner small" />
                ) : (
                  <span className="material-symbols-outlined">refresh</span>
                )}
              </button>
            </div>

            {metadataIndex.updatedAt && (
              <div className="index-timestamp">
                Updated: {new Date(metadataIndex.updatedAt).toLocaleString()}
              </div>
            )}

            <div className="metadata-sections">
              <MetadataSection
                title="Concepts"
                icon="lightbulb"
                terms={filterTerms(indexedTerms.concepts)}
                type="concepts"
                selectedTerms={selectedTerms.concepts}
                onToggle={toggleTerm}
                isSelected={isTermSelected}
              />
              <MetadataSection
                title="Entities"
                icon="person"
                terms={filterTerms(indexedTerms.entities)}
                type="entities"
                selectedTerms={selectedTerms.entities}
                onToggle={toggleTerm}
                isSelected={isTermSelected}
              />
              <MetadataSection
                title="Tags"
                icon="sell"
                terms={filterTerms(indexedTerms.tags)}
                type="tags"
                selectedTerms={selectedTerms.tags}
                onToggle={toggleTerm}
                isSelected={isTermSelected}
              />
              <MetadataSection
                title="Categories"
                icon="category"
                terms={filterTerms(indexedTerms.categories)}
                type="categories"
                selectedTerms={selectedTerms.categories}
                onToggle={toggleTerm}
                isSelected={isTermSelected}
              />
            </div>

            {totalTerms === 0 && (
              <div className="no-terms">
                <span className="material-symbols-outlined">inventory_2</span>
                <p>No metadata terms found</p>
                <p className="hint">Extract videos with LLM processing to generate metadata</p>
              </div>
            )}
          </div>

          <div className="explorer-main">
            <MatchingFilesList
              files={matchingFiles}
              selectedTermCount={selectedTermCount}
              filterMode={filterMode}
              onFileClick={navigateToFile}
            />
          </div>
        </div>
      )}
    </div>
  );
}
