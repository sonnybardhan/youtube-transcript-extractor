import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { savePrompt, deletePrompt } from '../../utils/api';

const VARIABLES = [
  { name: '{{transcript}}', icon: 'description' },
  { name: '{{video_title}}', icon: 'title' },
  { name: '{{channel_name}}', icon: 'smart_display' },
];

export function PromptModal() {
  const { state, actions } = useApp();
  const { promptModalOpen, defaultPrompt, customPrompt } = state;
  const [prompt, setPrompt] = useState('');
  const [lineNumbers, setLineNumbers] = useState([1]);
  const textareaRef = useRef(null);

  // Initialize prompt when modal opens
  useEffect(() => {
    if (promptModalOpen) {
      setPrompt(customPrompt || defaultPrompt || '');
    }
  }, [promptModalOpen, customPrompt, defaultPrompt]);

  // Update line numbers
  useEffect(() => {
    const lines = prompt.split('\n').length;
    setLineNumbers(Array.from({ length: lines }, (_, i) => i + 1));
  }, [prompt]);

  const handleClose = useCallback(() => {
    actions.setPromptModalOpen(false);
  }, [actions]);

  const handleSave = useCallback(async () => {
    try {
      await savePrompt(prompt);
      actions.setCustomPrompt(prompt);
      actions.showToast('Prompt saved successfully', 'success');
      handleClose();
    } catch (err) {
      actions.showToast('Failed to save prompt');
    }
  }, [prompt, actions, handleClose]);

  const handleReset = useCallback(async () => {
    try {
      await deletePrompt();
      actions.setCustomPrompt(null);
      setPrompt(defaultPrompt || '');
      actions.showToast('Prompt reset to default', 'success');
    } catch (err) {
      actions.showToast('Failed to reset prompt');
    }
  }, [defaultPrompt, actions]);

  const handleVariableClick = useCallback(async (variable) => {
    try {
      await navigator.clipboard.writeText(variable);
      actions.showToast(`Copied ${variable}`, 'success');
    } catch (err) {
      // Fallback: insert at cursor position
      if (textareaRef.current) {
        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const newPrompt = prompt.slice(0, start) + variable + prompt.slice(end);
        setPrompt(newPrompt);
        // Set cursor position after inserted variable
        setTimeout(() => {
          if (textareaRef.current) {
            const newPos = start + variable.length;
            textareaRef.current.setSelectionRange(newPos, newPos);
            textareaRef.current.focus();
          }
        }, 0);
      }
    }
  }, [prompt, actions]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!promptModalOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [promptModalOpen, handleClose, handleSave]);

  // Handle click outside
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Sync textarea scroll with line numbers
  const handleScroll = (e) => {
    const lineNumbersEl = e.target.previousSibling;
    if (lineNumbersEl) {
      lineNumbersEl.scrollTop = e.target.scrollTop;
    }
  };

  if (!promptModalOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">
            <h2>Edit System Prompt</h2>
            <p>Configure the persona and rules for the LLM transcript summarizer.</p>
          </div>
          <button className="modal-close" onClick={handleClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="modal-body">
          <div className="variables-section">
            <div className="variables-header">
              <span className="material-symbols-outlined">code_blocks</span>
              <h3>INJECTION VARIABLES</h3>
            </div>
            <div className="variable-chips">
              {VARIABLES.map((v) => (
                <button
                  key={v.name}
                  className="variable-chip"
                  onClick={() => handleVariableClick(v.name)}
                >
                  <span className="material-symbols-outlined">{v.icon}</span>
                  <code>{v.name}</code>
                </button>
              ))}
            </div>
            <p className="variables-hint">
              Click a variable to copy it to your clipboard.
            </p>
          </div>

          <div className="editor-container">
            <div className="editor-tab-bar">
              <div className="editor-tab active">
                <span className="material-symbols-outlined">terminal</span>
                <span>system_prompt.md</span>
              </div>
              <div className="editor-info">
                <span>UTF-8</span>
                <span>Markdown</span>
              </div>
            </div>
            <div className="editor-wrapper">
              <div className="line-numbers">
                {lineNumbers.map((num) => (
                  <span key={num}>{num}</span>
                ))}
              </div>
              <textarea
                ref={textareaRef}
                spellCheck="false"
                placeholder="Write your system prompt here..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onScroll={handleScroll}
              />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <div className="keyboard-hints">
            <div className="hint">
              <kbd>⌘</kbd><span>+</span><kbd>Enter</kbd>
              <span>to save</span>
            </div>
            <div className="divider" />
            <div className="hint">
              <kbd>Esc</kbd>
              <span>to cancel</span>
            </div>
          </div>
          <div className="modal-actions">
            {customPrompt && (
              <button className="modal-btn secondary" onClick={handleReset}>
                Reset to Default
              </button>
            )}
            <button className="modal-btn secondary" onClick={handleClose}>
              Cancel
            </button>
            <button className="modal-btn primary" onClick={handleSave}>
              <span className="material-symbols-outlined">save</span>
              <span>Save Prompt</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
