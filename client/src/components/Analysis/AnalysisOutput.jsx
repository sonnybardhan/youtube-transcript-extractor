import { useEffect, useRef, useState, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { useApp } from '../../context/AppContext';
import { useAnalysisPage } from '../../hooks/useAnalysisPage';
import { LLM_MODELS } from '../../utils/config';

export function AnalysisOutput() {
  const { state, actions } = useApp();
  const { cancelAnalysis, copyToClipboard, saveAnalysis } = useAnalysisPage();
  const contentRef = useRef(null);
  const [saveTitle, setSaveTitle] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const {
    analyzeResponse,
    analyzeIsStreaming,
    provider,
    model,
    analyzeSelectedPrompt,
    selectedItems,
    analyzeSourceFilenames,
    history,
  } = state;

  // Get model info
  const modelInfo = useMemo(() => {
    if (!provider || !model) return null;
    return LLM_MODELS[provider]?.find((m) => m.value === model);
  }, [provider, model]);

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
    // Navigate to main page and load the summary
    actions.setCurrentPage('main');
    // Load the file by updating state (handled by the main page)
    actions.updateState({
      view: 'results',
      currentFilename: filename,
    });
  };

  // Render markdown content - sanitized with DOMPurify to prevent XSS
  useEffect(() => {
    if (contentRef.current && analyzeResponse) {
      let html;
      if (window.marked) {
        html = window.marked.parse(analyzeResponse);
      } else {
        html = `<p>${analyzeResponse.replace(/\n/g, '<br/>')}</p>`;
      }
      // Sanitize HTML with DOMPurify before rendering to prevent XSS
      const sanitized = DOMPurify.sanitize(html, {
        ADD_ATTR: ['target', 'rel'],
      });
      contentRef.current.innerHTML = sanitized;
    }
  }, [analyzeResponse]);

  const handleNewAnalysis = () => {
    actions.resetAnalyze();
  };

  // Extract title from markdown content (first # heading)
  const extractTitleFromContent = (content) => {
    if (!content) return null;
    const titleMatch = content.match(/^#\s+(.+)$/m);
    return titleMatch ? titleMatch[1].trim() : null;
  };

  const handleSaveClick = () => {
    if (!showSaveInput) {
      // Try to extract title from generated content first
      const extractedTitle = extractTitleFromContent(analyzeResponse);
      if (extractedTitle) {
        setSaveTitle(extractedTitle);
      } else {
        // Fallback to prompt-based title
        const promptName = analyzeSelectedPrompt === 'custom'
          ? 'Custom Analysis'
          : analyzeSelectedPrompt.charAt(0).toUpperCase() + analyzeSelectedPrompt.slice(1);
        setSaveTitle(`${promptName} - ${selectedItems.size} Summaries`);
      }
      setShowSaveInput(true);
    } else {
      saveAnalysis(saveTitle);
      setShowSaveInput(false);
      setSaveTitle('');
    }
  };

  const handleCancelSave = () => {
    setShowSaveInput(false);
    setSaveTitle('');
  };

  return (
    <div className="analysis-output">
      <div className="analysis-output-toolbar">
        <div className="toolbar-left">
          {analyzeIsStreaming ? (
            <span className="status-indicator streaming">
              <span className="material-symbols-outlined spinning">sync</span>
              Analyzing...
            </span>
          ) : (
            <span className="status-indicator complete">
              <span className="material-symbols-outlined">check_circle</span>
              Complete
            </span>
          )}
          {modelInfo && (
            <span className="model-tag">
              <span className="material-symbols-outlined">smart_toy</span>
              {modelInfo.label}
            </span>
          )}
        </div>
        <div className="toolbar-actions">
          {analyzeIsStreaming ? (
            <button className="toolbar-btn" onClick={cancelAnalysis}>
              <span className="material-symbols-outlined">stop</span>
              Cancel
            </button>
          ) : (
            <>
              <button className="toolbar-btn" onClick={handleNewAnalysis}>
                <span className="material-symbols-outlined">refresh</span>
                New
              </button>
              <button className="toolbar-btn" onClick={copyToClipboard}>
                <span className="material-symbols-outlined">content_copy</span>
                Copy
              </button>
              {showSaveInput ? (
                <div className="save-input-group">
                  <input
                    type="text"
                    className="save-title-input"
                    value={saveTitle}
                    onChange={(e) => setSaveTitle(e.target.value)}
                    placeholder="Analysis title..."
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveClick();
                      if (e.key === 'Escape') handleCancelSave();
                    }}
                  />
                  <button className="toolbar-btn primary" onClick={handleSaveClick}>
                    <span className="material-symbols-outlined">save</span>
                  </button>
                  <button className="toolbar-btn" onClick={handleCancelSave}>
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
              ) : (
                <button className="toolbar-btn primary" onClick={handleSaveClick}>
                  <span className="material-symbols-outlined">save</span>
                  Save
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Source chips showing which summaries are being analyzed */}
      {analyzeSourceFilenames.length > 0 && (
        <div className="analysis-sources">
          <span className="sources-label">Sources:</span>
          {analyzeSourceFilenames.map((filename) => (
            <button
              key={filename}
              className="source-chip clickable"
              title={getFileTitle(filename)}
              onClick={() => handleSourceClick(filename)}
            >
              {getFileTitle(filename).substring(0, 25)}
              {getFileTitle(filename).length > 25 && '...'}
            </button>
          ))}
        </div>
      )}

      <div className="analysis-output-scroll">
        {/* Loading spinner when streaming but no response yet */}
        {analyzeIsStreaming && !analyzeResponse && (
          <div className="analysis-loading">
            <div className="loading-spinner">
              <span className="material-symbols-outlined spinning">progress_activity</span>
            </div>
            <p>Analyzing {analyzeSourceFilenames.length} summaries...</p>
          </div>
        )}

        <div className="output-container" ref={contentRef}>
          {!analyzeIsStreaming && !analyzeResponse && (
            <p><em>Waiting for response...</em></p>
          )}
        </div>
      </div>
    </div>
  );
}
