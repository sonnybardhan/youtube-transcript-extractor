import { useEffect } from 'react';
import { useMetadataStreamliner } from '../../hooks/useMetadataStreamliner';
import { AnalysisProgress } from './AnalysisProgress';
import { ChangesReview } from './ChangesReview';
import { LLM_MODELS } from '../../utils/config';

export function StreamlinerModal() {
  const {
    isOpen,
    phase,
    progress,
    proposedChanges,
    result,
    signalFileCount,
    metadataPreview,
    isLoadingStats,
    provider,
    model,
    changeSummary,
    selectedNormalizations,
    applyProgress,
    selectedFilesCount,
    closeModal,
    startAnalysis,
    cancelAnalysis,
    applyChanges,
    resetToSetup,
    toggleItem,
    toggleAll,
  } = useMetadataStreamliner();

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeModal]);

  // Handle click outside
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  };

  if (!isOpen) return null;

  const modelInfo = provider && model
    ? LLM_MODELS[provider]?.find((m) => m.value === model)
    : null;

  const canStartAnalysis = provider && model && signalFileCount > 0 && selectedFilesCount > 0;
  const hasNoChanges = changeSummary && changeSummary.totalMerges === 0;
  const hasNoSelected = changeSummary && changeSummary.selectedMerges === 0;

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal streamliner-modal">
        <div className="modal-header">
          <div className="modal-title">
            <h2>
              <span className="material-symbols-outlined">auto_fix_high</span>
              Metadata Streamliner
            </h2>
            <p>Normalize and standardize metadata across all your summaries</p>
          </div>
          <button className="modal-close" onClick={closeModal}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="modal-body">
          {/* Setup Phase */}
          {phase === 'setup' && (
            <div className="streamliner-setup">
              <div className="setup-info">
                <div className="setup-stat">
                  <span className="material-symbols-outlined">description</span>
                  <div>
                    <span className="stat-value">
                      {isLoadingStats ? '...' : selectedFilesCount}
                    </span>
                    <span className="stat-label">Selected summaries</span>
                  </div>
                </div>

                {modelInfo && (
                  <div className="setup-stat">
                    <span className="material-symbols-outlined">smart_toy</span>
                    <div>
                      <span className="stat-value">{modelInfo.label}</span>
                      <span className="stat-label">LLM Model</span>
                    </div>
                  </div>
                )}

                {!provider && (
                  <div className="setup-warning">
                    <span className="material-symbols-outlined">warning</span>
                    <p>Please select an LLM provider and model in the sidebar settings.</p>
                  </div>
                )}

                {signalFileCount === 0 && !isLoadingStats && selectedFilesCount > 0 && (
                  <div className="setup-warning">
                    <span className="material-symbols-outlined">info</span>
                    <p>No signal files found. Extract some videos first to generate metadata.</p>
                  </div>
                )}

                {selectedFilesCount === 0 && !isLoadingStats && (
                  <div className="setup-warning">
                    <span className="material-symbols-outlined">info</span>
                    <p>No summaries selected. Check the summaries you want to analyze in the sidebar.</p>
                  </div>
                )}
              </div>

              <div className="setup-description">
                <h3>What this does:</h3>
                <ul>
                  <li>
                    <span className="material-symbols-outlined">merge</span>
                    Finds and merges duplicate terms (e.g., "AI tools" → "ai-tools")
                  </li>
                  <li>
                    <span className="material-symbols-outlined">spellcheck</span>
                    Fixes spelling variations and inconsistent formatting
                  </li>
                  <li>
                    <span className="material-symbols-outlined">edit_document</span>
                    Updates your signal files with canonical terms
                  </li>
                  <li>
                    <span className="material-symbols-outlined">inventory_2</span>
                    Creates a metadata index for better filtering
                  </li>
                </ul>
              </div>

              {/* Metadata Preview */}
              {metadataPreview && (
                <div className="metadata-preview">
                  <h3>Current Metadata to Analyze</h3>

                  {metadataPreview.categories.length > 0 && (
                    <div className="preview-section">
                      <div className="preview-label">
                        <span className="material-symbols-outlined category-color">category</span>
                        Categories ({metadataPreview.categories.length})
                      </div>
                      <div className="preview-chips">
                        {metadataPreview.categories.map((cat, i) => (
                          <span key={i} className="preview-chip category-chip">{cat}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {metadataPreview.concepts.length > 0 && (
                    <div className="preview-section">
                      <div className="preview-label">
                        <span className="material-symbols-outlined concept-color">lightbulb</span>
                        Concepts ({metadataPreview.concepts.length})
                      </div>
                      <div className="preview-chips">
                        {metadataPreview.concepts.map((concept, i) => (
                          <span key={i} className="preview-chip concept-chip">{concept}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {metadataPreview.entities.length > 0 && (
                    <div className="preview-section">
                      <div className="preview-label">
                        <span className="material-symbols-outlined entity-color">person</span>
                        Entities ({metadataPreview.entities.length})
                      </div>
                      <div className="preview-chips">
                        {metadataPreview.entities.map((entity, i) => (
                          <span key={i} className="preview-chip entity-chip">{entity}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {metadataPreview.tags.length > 0 && (
                    <div className="preview-section">
                      <div className="preview-label">
                        <span className="material-symbols-outlined tag-color">sell</span>
                        Tags ({metadataPreview.tags.length})
                      </div>
                      <div className="preview-chips">
                        {metadataPreview.tags.map((tag, i) => (
                          <span key={i} className="preview-chip tag-chip">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Analyzing Phase */}
          {phase === 'analyzing' && (
            <AnalysisProgress progress={progress} onCancel={cancelAnalysis} />
          )}

          {/* Review Phase */}
          {phase === 'review' && (
            <ChangesReview
              proposedChanges={proposedChanges}
              changeSummary={changeSummary}
              selectedNormalizations={selectedNormalizations}
              onToggleItem={toggleItem}
              onToggleAll={toggleAll}
            />
          )}

          {/* Applying Phase */}
          {phase === 'applying' && (
            <div className="streamliner-applying">
              <div className="applying-icon">
                <span className="material-symbols-outlined spinning">sync</span>
              </div>
              <h3>Applying Changes</h3>
              {applyProgress && applyProgress.total > 0 ? (
                <>
                  <p className="apply-progress-text">
                    Updating file {applyProgress.current} of {applyProgress.total}
                  </p>
                  {applyProgress.currentFile && (
                    <p className="apply-current-file">{applyProgress.currentFile}</p>
                  )}
                  <div className="apply-progress-bar">
                    <div
                      className="apply-progress-fill"
                      style={{ width: `${(applyProgress.current / applyProgress.total) * 100}%` }}
                    />
                  </div>
                </>
              ) : (
                <p>Updating signal files...</p>
              )}
            </div>
          )}

          {/* Complete Phase */}
          {phase === 'complete' && result && (
            <div className="streamliner-complete">
              <div className="complete-icon">
                <span className="material-symbols-outlined">check_circle</span>
              </div>
              <h3>Normalization Complete!</h3>
              <div className="complete-stats">
                <div className="complete-stat">
                  <span className="stat-value">{result.updatedFiles}</span>
                  <span className="stat-label">Files updated</span>
                </div>
                <div className="complete-stat">
                  <span className="stat-value">{result.indexFile}</span>
                  <span className="stat-label">Index created</span>
                </div>
              </div>
              <p className="complete-message">
                Your metadata is now standardized and consistent.
              </p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <div className="modal-footer-left">
            {phase === 'review' && modelInfo && (
              <div className="model-tag">
                <span className="material-symbols-outlined">smart_toy</span>
                {modelInfo.label}
              </div>
            )}
            {phase === 'review' && progress?.fieldIndex && progress.fieldIndex < progress.totalFields && (
              <div className="analysis-progress-tag">
                <span className="material-symbols-outlined spinning">sync</span>
                Analyzing {progress.fieldIndex}/{progress.totalFields}...
              </div>
            )}
          </div>
          <div className="modal-actions">
            {phase === 'setup' && (
              <>
                <button className="modal-btn secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button
                  className="modal-btn primary"
                  onClick={startAnalysis}
                  disabled={!canStartAnalysis}
                >
                  <span className="material-symbols-outlined">play_arrow</span>
                  Start Analysis
                </button>
              </>
            )}

            {phase === 'review' && (
              <>
                <button className="modal-btn secondary" onClick={resetToSetup}>
                  Back
                </button>
                {hasNoChanges ? (
                  <button className="modal-btn primary" onClick={closeModal}>
                    Done
                  </button>
                ) : (
                  <button
                    className="modal-btn primary"
                    onClick={applyChanges}
                    disabled={hasNoSelected || (progress?.fieldIndex && progress.fieldIndex < progress.totalFields)}
                  >
                    <span className="material-symbols-outlined">check</span>
                    Apply {changeSummary?.selectedMerges || 0} Changes
                  </button>
                )}
              </>
            )}

            {phase === 'complete' && (
              <button className="modal-btn primary" onClick={closeModal}>
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
