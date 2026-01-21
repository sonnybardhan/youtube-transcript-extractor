import { useState, useEffect, useRef } from 'react';
import { useAnnotation } from '../../hooks/useAnnotation';
import { useApp } from '../../context/AppContext';

export function AnnotationModal() {
  const { state, actions } = useApp();
  const {
    isStreaming,
    streamedResponse,
    error,
    askLLM,
    cancelStream,
    saveAnnotation,
    closeModal,
    annotationModalData,
  } = useAnnotation();

  const [question, setQuestion] = useState('Explain this in more detail.');
  const [hasAsked, setHasAsked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const responseRef = useRef(null);

  // Auto-scroll response as it streams
  useEffect(() => {
    if (responseRef.current && isStreaming) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [streamedResponse, isStreaming]);

  const handleAsk = async () => {
    // Check if LLM is configured
    if (!state.provider || !state.model) {
      actions.showToast('Please select an LLM provider and model in the sidebar settings.');
      return;
    }
    setHasAsked(true);
    await askLLM(question);
  };

  const handleSave = async () => {
    if (!streamedResponse) return;

    setIsSaving(true);
    try {
      await saveAnnotation(question, streamedResponse);
      closeModal();
    } catch (err) {
      console.error('Failed to save annotation:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isStreaming) {
      cancelStream();
    }
    closeModal();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isStreaming && !hasAsked) {
      e.preventDefault();
      handleAsk();
    }
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  if (!annotationModalData) return null;

  const truncatedText = annotationModalData.selectedText.length > 200
    ? annotationModalData.selectedText.slice(0, 200) + '...'
    : annotationModalData.selectedText;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="modal annotation-modal" onKeyDown={handleKeyDown}>
        <div className="modal-header">
          <div className="modal-title">
            <h2>Ask about selection</h2>
            <p>
              From <strong>{annotationModalData.section}</strong>
              {state.signalData?.category && (
                <span className="category-badge-small">{state.signalData.category}</span>
              )}
            </p>
          </div>
          <button className="modal-close" onClick={handleClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="modal-body">
          {/* Selected text preview */}
          <div className="annotation-selection">
            <label>Selected Text</label>
            <blockquote>{truncatedText}</blockquote>
          </div>

          {/* Question input */}
          <div className="annotation-question">
            <label htmlFor="annotation-question-input">Your Question</label>
            <textarea
              id="annotation-question-input"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What would you like to know about this text?"
              disabled={hasAsked}
              rows={2}
              autoFocus
            />
          </div>

          {/* Response area */}
          {hasAsked && (
            <div className="annotation-response">
              <label>
                Response
                {isStreaming && <span className="mini-spinner inline-spinner" />}
              </label>
              <div className="annotation-response-content" ref={responseRef}>
                {error ? (
                  <div className="annotation-error">
                    <span className="material-symbols-outlined">error</span>
                    {error}
                  </div>
                ) : streamedResponse ? (
                  <div className="annotation-response-text">{streamedResponse}</div>
                ) : (
                  <div className="annotation-response-placeholder">Waiting for response...</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <div className="modal-footer-left">
            {hasAsked && !isStreaming && !error && streamedResponse && (
              <span className="model-tag">
                <span className="material-symbols-outlined">smart_toy</span>
                {state.provider}/{state.model}
              </span>
            )}
          </div>
          <div className="modal-actions">
            {isStreaming ? (
              <button className="modal-btn secondary" onClick={cancelStream}>
                <span className="material-symbols-outlined">stop</span>
                Cancel
              </button>
            ) : hasAsked && streamedResponse && !error ? (
              <>
                <button className="modal-btn secondary" onClick={handleClose}>
                  Discard
                </button>
                <button
                  className="modal-btn primary"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  <span className="material-symbols-outlined">save</span>
                  {isSaving ? 'Saving...' : 'Save Annotation'}
                </button>
              </>
            ) : (
              <>
                <button className="modal-btn secondary" onClick={handleClose}>
                  Cancel
                </button>
                <button
                  className="modal-btn primary"
                  onClick={handleAsk}
                  disabled={!question.trim() || hasAsked}
                >
                  <span className="material-symbols-outlined">psychology</span>
                  Ask LLM
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
