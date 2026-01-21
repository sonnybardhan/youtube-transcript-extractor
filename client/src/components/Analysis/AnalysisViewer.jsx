import { useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { useApp } from '../../context/AppContext';
import { useAnalysisPage } from '../../hooks/useAnalysisPage';

export function AnalysisViewer() {
  const { state, actions } = useApp();
  const { deleteAnalysis } = useAnalysisPage();
  const contentRef = useRef(null);

  const { currentAnalysis, history } = state;

  // Get title for a filename
  const getFileTitle = (filename) => {
    const historyItem = history.find((h) => h.filename === filename);
    if (historyItem?.title) {
      return historyItem.title;
    }
    return filename.replace('.md', '').substring(0, 40);
  };

  // Handle clicking a source chip to navigate to that summary
  const handleSourceClick = (filename) => {
    actions.setCurrentPage('main');
    actions.updateState({
      view: 'results',
      currentFilename: filename,
    });
  };

  // Render markdown content - sanitized with DOMPurify to prevent XSS
  useEffect(() => {
    if (contentRef.current && currentAnalysis?.content) {
      let html;
      if (window.marked) {
        html = window.marked.parse(currentAnalysis.content);
      } else {
        html = `<p>${currentAnalysis.content.replace(/\n/g, '<br/>')}</p>`;
      }
      // Sanitize HTML with DOMPurify before rendering to prevent XSS
      const sanitized = DOMPurify.sanitize(html, {
        ADD_ATTR: ['target', 'rel'],
      });
      contentRef.current.innerHTML = sanitized;
    }
  }, [currentAnalysis?.content]);

  const handleBack = () => {
    actions.setCurrentAnalysis(null);
  };

  const handleCopy = async () => {
    if (!currentAnalysis?.content) return;
    try {
      await navigator.clipboard.writeText(currentAnalysis.content);
      actions.showToast('Copied to clipboard', 'success');
    } catch (err) {
      actions.showToast('Failed to copy to clipboard');
    }
  };

  const handleDelete = () => {
    if (currentAnalysis?.filename) {
      actions.setDeleteModal(true, {
        title: 'Delete Analysis?',
        message: `Are you sure you want to delete "${currentAnalysis.title || 'this analysis'}"? This action cannot be undone.`,
        onConfirm: async () => {
          await deleteAnalysis(currentAnalysis.filename);
          actions.setCurrentAnalysis(null);
          actions.setDeleteModal(false);
        },
      });
    }
  };

  if (!currentAnalysis) return null;

  return (
    <div className="analysis-viewer">
      <div className="analysis-viewer-toolbar">
        <div className="toolbar-left">
          <button className="toolbar-btn" onClick={handleBack}>
            <span className="material-symbols-outlined">arrow_back</span>
            Back
          </button>
          <span className="viewer-title">{currentAnalysis.title}</span>
        </div>
        <div className="toolbar-actions">
          <button className="toolbar-btn" onClick={handleCopy}>
            <span className="material-symbols-outlined">content_copy</span>
            Copy
          </button>
          <button className="toolbar-btn danger" onClick={handleDelete}>
            <span className="material-symbols-outlined">delete</span>
            Delete
          </button>
        </div>
      </div>

      {currentAnalysis.sourceFiles?.length > 0 && (
        <div className="analysis-sources">
          <span className="sources-label">Sources:</span>
          {currentAnalysis.sourceFiles.map((source, idx) => (
            <button
              key={idx}
              className="source-chip clickable"
              title={getFileTitle(source)}
              onClick={() => handleSourceClick(source)}
            >
              {getFileTitle(source).substring(0, 25)}
              {getFileTitle(source).length > 25 && '...'}
            </button>
          ))}
        </div>
      )}

      <div className="analysis-viewer-scroll">
        <div className="output-container" ref={contentRef} />
      </div>
    </div>
  );
}
