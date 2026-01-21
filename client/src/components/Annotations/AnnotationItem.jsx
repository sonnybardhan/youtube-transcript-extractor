import { useState } from 'react';

export function AnnotationItem({ annotation, onDelete }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const truncatedSelection = annotation.selectedText.length > 100
    ? annotation.selectedText.slice(0, 100) + '...'
    : annotation.selectedText;

  const truncatedResponse = annotation.response.length > 200 && !isExpanded
    ? annotation.response.slice(0, 200) + '...'
    : annotation.response;

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = (e) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(annotation.id);
    }
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = (e) => {
    e.stopPropagation();
    setShowDeleteConfirm(false);
  };

  return (
    <div className="annotation-item">
      <div className="annotation-item-header">
        <div className="annotation-item-meta">
          <span className="annotation-item-section">{annotation.section}</span>
          <span className="annotation-item-date">{formatDate(annotation.timestamp)}</span>
        </div>
        {showDeleteConfirm ? (
          <div className="annotation-delete-confirm">
            <span className="confirm-text">Delete?</span>
            <button
              className="confirm-btn confirm-yes"
              onClick={handleConfirmDelete}
              title="Confirm delete"
            >
              <span className="material-symbols-outlined">check</span>
            </button>
            <button
              className="confirm-btn confirm-no"
              onClick={handleCancelDelete}
              title="Cancel"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        ) : (
          <button
            className="annotation-item-delete"
            onClick={handleDeleteClick}
            title="Delete annotation"
          >
            <span className="material-symbols-outlined">delete</span>
          </button>
        )}
      </div>

      <div className="annotation-item-selection">
        "{truncatedSelection}"
      </div>

      <div className="annotation-item-question">
        Q: {annotation.question}
      </div>

      <div className="annotation-item-response">
        {truncatedResponse}
        {annotation.response.length > 200 && (
          <button
            className="expand-btn"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      <div className="annotation-item-model">
        <span className="material-symbols-outlined">smart_toy</span>
        {annotation.model}
      </div>
    </div>
  );
}
