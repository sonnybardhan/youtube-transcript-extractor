import { useCallback, useEffect } from 'react';
import { useApp } from '../../context/AppContext';

export function DeleteModal() {
  const { state, actions } = useApp();
  const { deleteModalOpen, deleteModalData } = state;

  const handleCancel = useCallback(() => {
    actions.setDeleteModal(false);
  }, [actions]);

  const handleConfirm = useCallback(() => {
    if (deleteModalData?.onConfirm) {
      deleteModalData.onConfirm();
    }
  }, [deleteModalData]);

  // Handle Escape key
  useEffect(() => {
    if (!deleteModalOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [deleteModalOpen, handleCancel]);

  // Handle click outside
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  if (!deleteModalOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal delete-modal">
        <div className="delete-modal-icon">
          <span className="material-symbols-outlined">delete_forever</span>
        </div>
        <h3>{deleteModalData?.title || 'Delete?'}</h3>
        <p>{deleteModalData?.message || 'This action cannot be undone.'}</p>
        <div className="delete-modal-actions">
          <button className="modal-btn secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button className="modal-btn danger" onClick={handleConfirm}>
            <span className="material-symbols-outlined">delete</span>
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}
