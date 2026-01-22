import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../../context/AppContext';

export function AskQuestionModal() {
  const { state, actions } = useApp();
  const { askQuestionModalOpen, askQuestionModalData } = state;
  const [question, setQuestion] = useState('');
  const textareaRef = useRef(null);

  // Initialize with default question when modal opens
  useEffect(() => {
    if (askQuestionModalOpen) {
      setQuestion('Elaborate on this.');
      // Focus and select the textarea after render
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.select();
        }
      }, 50);
    }
  }, [askQuestionModalOpen]);

  const handleClose = useCallback(() => {
    actions.setAskQuestionModal(false);
    setQuestion('');
  }, [actions]);

  const handleSubmit = useCallback(() => {
    if (!question.trim()) {
      actions.showToast('Please enter a question');
      return;
    }

    if (askQuestionModalData?.onSubmit) {
      askQuestionModalData.onSubmit(question.trim());
    }

    handleClose();
  }, [question, askQuestionModalData, handleClose, actions]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!askQuestionModalOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [askQuestionModalOpen, handleClose, handleSubmit]);

  // Handle click outside
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!askQuestionModalOpen) return null;

  const selectedText = askQuestionModalData?.selectionData?.selectedText || '';
  const truncatedText = selectedText.length > 100
    ? selectedText.slice(0, 100) + '...'
    : selectedText;

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal ask-question-modal">
        <div className="modal-header">
          <div className="modal-title">
            <h2>Ask a Question</h2>
            <p>Ask the LLM about the selected text</p>
          </div>
          <button className="modal-close" onClick={handleClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="modal-body">
          {truncatedText && (
            <div className="ask-question-selection">
              <label>
                <span className="material-symbols-outlined">format_quote</span>
                Selected Text
              </label>
              <blockquote>{truncatedText}</blockquote>
            </div>
          )}

          <div className="ask-question-input">
            <label htmlFor="question-textarea">
              <span className="material-symbols-outlined">help</span>
              Your Question
            </label>
            <textarea
              id="question-textarea"
              ref={textareaRef}
              placeholder="What would you like to know about this text?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="modal-footer">
          <div className="keyboard-hints">
            <div className="hint">
              <kbd>⌘</kbd><span>+</span><kbd>Enter</kbd>
              <span>to submit</span>
            </div>
            <div className="divider" />
            <div className="hint">
              <kbd>Esc</kbd>
              <span>to cancel</span>
            </div>
          </div>
          <div className="modal-actions">
            <button className="modal-btn secondary" onClick={handleClose}>
              Cancel
            </button>
            <button className="modal-btn primary" onClick={handleSubmit}>
              <span className="material-symbols-outlined">send</span>
              <span>Ask</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
