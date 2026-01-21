import { useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useExtraction } from '../../hooks/useExtraction';
import { truncate } from '../../utils/helpers';

export function ResultsHeader({ onRerun }) {
  const { state, actions } = useApp();
  const { cancelExtraction, isStreaming } = useExtraction();

  const { currentMarkdown, currentMetadata } = state;
  const title = currentMetadata?.title || 'Current Extraction';

  const handleBackToInput = useCallback((e) => {
    e.preventDefault();
    actions.clearCurrent();
    actions.setView('input');
  }, [actions]);

  const handleCopyMarkdown = useCallback(async () => {
    if (!currentMarkdown) {
      actions.showToast('No content to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(currentMarkdown);
      actions.showToast('Copied to clipboard', 'success');
    } catch (err) {
      actions.showToast('Failed to copy to clipboard');
    }
  }, [currentMarkdown, actions]);

  return (
    <header className="results-header">
      <div className="breadcrumb">
        <a href="#" onClick={handleBackToInput}>
          Home
        </a>
        <span>/</span>
        <span>Extractions</span>
        <span>/</span>
        <span className="current">{truncate(title, 40)}</span>
      </div>

      <div className="header-actions">
        {isStreaming && (
          <button
            className="header-btn danger"
            title="Cancel current request"
            onClick={cancelExtraction}
          >
            <span className="material-symbols-outlined">close</span>
            <span>Cancel</span>
          </button>
        )}
        <button
          className="header-btn secondary"
          title="Re-process with LLM"
          onClick={onRerun}
          disabled={isStreaming}
        >
          <span className="material-symbols-outlined">refresh</span>
          <span>Re-run LLM</span>
        </button>
        <button
          className="header-btn secondary"
          onClick={handleCopyMarkdown}
          disabled={!currentMarkdown}
        >
          <span className="material-symbols-outlined">content_copy</span>
          <span>Copy Markdown</span>
        </button>
      </div>
    </header>
  );
}
