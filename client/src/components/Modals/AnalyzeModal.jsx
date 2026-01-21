import { useEffect, useMemo, useRef } from 'react';
import DOMPurify from 'dompurify';
import { useMultiSummaryAnalysis, ANALYSIS_PROMPT_OPTIONS } from '../../hooks/useMultiSummaryAnalysis';
import { LLM_MODELS } from '../../utils/config';

// Component to render the analysis response with markdown
function AnalyzeResponse({ response, isStreaming }) {
  const contentRef = useRef(null);

  useEffect(() => {
    if (contentRef.current && response) {
      // Use marked.js if available, otherwise render as plain text
      let html;
      if (window.marked) {
        html = window.marked.parse(response);
      } else {
        html = `<p>${response.replace(/\n/g, '<br/>')}</p>`;
      }
      // Sanitize HTML with DOMPurify before rendering to prevent XSS
      const sanitized = DOMPurify.sanitize(html, {
        ADD_ATTR: ['target', 'rel'],
      });
      contentRef.current.innerHTML = sanitized;
    }
  }, [response]);

  return (
    <div className="analyze-response">
      <div className="response-header">
        <h3>
          {isStreaming ? (
            <>
              <span className="material-symbols-outlined spinning">sync</span>
              Analyzing...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined">check_circle</span>
              Analysis Complete
            </>
          )}
        </h3>
      </div>
      <div className="response-content markdown-content" ref={contentRef}>
        {!response && <p><em>Waiting for response...</em></p>}
      </div>
    </div>
  );
}

export function AnalyzeModal() {
  const {
    isOpen,
    selectedPrompt,
    customPrompt,
    response,
    isStreaming,
    selectedFilenames,
    selectedCount,
    provider,
    model,
    closeModal,
    startAnalysis,
    cancelAnalysis,
    copyToClipboard,
    saveAsFile,
    setSelectedPrompt,
    setCustomPrompt,
  } = useMultiSummaryAnalysis();

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

  // Get model info
  const modelInfo = useMemo(() => {
    if (!provider || !model) return null;
    return LLM_MODELS[provider]?.find((m) => m.value === model);
  }, [provider, model]);

  // Check if using custom prompt
  const isCustomPrompt = selectedPrompt === 'custom';

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal analyze-modal">
        <div className="modal-header">
          <div className="modal-title">
            <h2>
              <span className="material-symbols-outlined">query_stats</span>
              Analyze {selectedCount} Summaries
            </h2>
            <p>Cross-reference selected summaries using AI analysis</p>
          </div>
          <button className="modal-close" onClick={closeModal}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="modal-body">
          {/* Prompt Selection */}
          {!response && !isStreaming && (
            <div className="analyze-setup">
              <div className="prompt-selector">
                <h3>Analysis Type</h3>
                <div className="prompt-options">
                  {ANALYSIS_PROMPT_OPTIONS.map((option) => (
                    <label
                      key={option.id}
                      className={`prompt-option ${selectedPrompt === option.id ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="promptType"
                        value={option.id}
                        checked={selectedPrompt === option.id}
                        onChange={() => setSelectedPrompt(option.id)}
                      />
                      <span className="material-symbols-outlined">{option.icon}</span>
                      <div className="prompt-option-content">
                        <span className="prompt-option-name">{option.name}</span>
                        <span className="prompt-option-desc">{option.description}</span>
                      </div>
                    </label>
                  ))}
                  <label
                    className={`prompt-option ${selectedPrompt === 'custom' ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="promptType"
                      value="custom"
                      checked={selectedPrompt === 'custom'}
                      onChange={() => setSelectedPrompt('custom')}
                    />
                    <span className="material-symbols-outlined">edit_note</span>
                    <div className="prompt-option-content">
                      <span className="prompt-option-name">Custom Prompt</span>
                      <span className="prompt-option-desc">Write your own analysis instructions</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Custom Prompt Input */}
              {isCustomPrompt && (
                <div className="custom-prompt-section">
                  <h3>Custom Prompt</h3>
                  <textarea
                    className="custom-prompt-input"
                    placeholder="Enter your custom analysis prompt..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    rows={4}
                  />
                </div>
              )}

              {/* Selected Files Preview */}
              <div className="selected-files-preview">
                <h3>Selected Summaries ({selectedCount})</h3>
                <div className="selected-files-list">
                  {selectedFilenames.slice(0, 5).map((filename) => (
                    <div key={filename} className="selected-file-chip">
                      <span className="material-symbols-outlined">description</span>
                      <span className="filename">{filename.replace('.md', '')}</span>
                    </div>
                  ))}
                  {selectedCount > 5 && (
                    <div className="selected-file-chip more">
                      +{selectedCount - 5} more
                    </div>
                  )}
                </div>
              </div>

              {/* LLM Info */}
              {modelInfo && (
                <div className="analyze-model-info">
                  <span className="material-symbols-outlined">smart_toy</span>
                  <span>Using {modelInfo.label}</span>
                </div>
              )}

              {!provider && (
                <div className="analyze-warning">
                  <span className="material-symbols-outlined">warning</span>
                  <p>Please select an LLM provider and model in the sidebar settings.</p>
                </div>
              )}
            </div>
          )}

          {/* Streaming Response */}
          {(response || isStreaming) && (
            <AnalyzeResponse response={response} isStreaming={isStreaming} />
          )}
        </div>

        <div className="modal-footer">
          <div className="modal-footer-left">
            {modelInfo && (response || isStreaming) && (
              <div className="model-tag">
                <span className="material-symbols-outlined">smart_toy</span>
                {modelInfo.label}
              </div>
            )}
          </div>
          <div className="modal-actions">
            {/* Before running analysis */}
            {!response && !isStreaming && (
              <>
                <button className="modal-btn secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button
                  className="modal-btn primary"
                  onClick={startAnalysis}
                  disabled={!provider || !model || (isCustomPrompt && !customPrompt.trim())}
                >
                  <span className="material-symbols-outlined">play_arrow</span>
                  Run Analysis
                </button>
              </>
            )}

            {/* While streaming */}
            {isStreaming && (
              <button className="modal-btn secondary" onClick={cancelAnalysis}>
                <span className="material-symbols-outlined">stop</span>
                Cancel
              </button>
            )}

            {/* After analysis complete */}
            {response && !isStreaming && (
              <>
                <button className="modal-btn secondary" onClick={closeModal}>
                  Close
                </button>
                <button className="modal-btn secondary" onClick={copyToClipboard}>
                  <span className="material-symbols-outlined">content_copy</span>
                  Copy
                </button>
                <button className="modal-btn primary" onClick={saveAsFile}>
                  <span className="material-symbols-outlined">save</span>
                  Save as File
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
