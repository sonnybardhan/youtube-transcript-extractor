import { useEffect, useRef, useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true,
});

export function PendingAnnotation({ pending, onSave, onDiscard, onCancel }) {
  const contentRef = useRef(null);

  // Auto-scroll as content streams
  useEffect(() => {
    if (contentRef.current && pending.isStreaming) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [pending.response, pending.isStreaming]);

  const truncatedSelection = pending.selectedText.length > 100
    ? pending.selectedText.slice(0, 100) + '...'
    : pending.selectedText;

  const canSave = !pending.isStreaming && pending.response && !pending.error;

  // Parse and sanitize markdown for display
  const renderedMarkdown = useMemo(() => {
    if (!pending.response) return '';
    const rawHtml = marked.parse(pending.response);
    return DOMPurify.sanitize(rawHtml);
  }, [pending.response]);

  return (
    <div className={`pending-annotation ${pending.isStreaming ? 'streaming' : ''}`}>
      <div className="pending-annotation-header">
        <div className="pending-annotation-label">
          {pending.isStreaming ? (
            <>
              <span className="mini-spinner" />
              <span>Generating explanation...</span>
            </>
          ) : pending.error ? (
            <>
              <span className="material-symbols-outlined error-icon">error</span>
              <span>Error</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined success-icon">check_circle</span>
              <span>Ready to save</span>
            </>
          )}
        </div>
        {pending.isStreaming && (
          <button className="pending-cancel-btn" onClick={onCancel} title="Cancel">
            <span className="material-symbols-outlined">close</span>
          </button>
        )}
      </div>

      <div className="pending-annotation-selection">
        "{truncatedSelection}"
      </div>

      <div className="pending-annotation-content" ref={contentRef}>
        {pending.error ? (
          <div className="pending-annotation-error">{pending.error}</div>
        ) : pending.response ? (
          <div
            className="pending-annotation-response markdown-content"
            dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
          />
        ) : (
          <div className="pending-annotation-placeholder">Waiting for response...</div>
        )}
      </div>

      <div className="pending-annotation-footer">
        <span className="pending-annotation-model">
          <span className="material-symbols-outlined">smart_toy</span>
          {pending.model}
        </span>
        <div className="pending-annotation-actions">
          {!pending.isStreaming && (
            <>
              <button className="pending-btn discard" onClick={onDiscard}>
                Discard
              </button>
              {canSave && (
                <button className="pending-btn save" onClick={onSave}>
                  <span className="material-symbols-outlined">save</span>
                  Save
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
