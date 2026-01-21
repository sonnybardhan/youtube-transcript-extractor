import { useApp } from '../../context/AppContext';
import { useAnalysisPage } from '../../hooks/useAnalysisPage';

export function SavedAnalysisItem({ analysis }) {
  const { actions } = useApp();
  const { loadAnalysis, deleteAnalysis } = useAnalysisPage();

  const { filename, title, date, sourceFiles } = analysis;

  const handleClick = (e) => {
    if (e.target.closest('.analysis-delete-btn')) return;
    loadAnalysis(filename);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    actions.setDeleteModal(true, {
      title: 'Delete Analysis?',
      message: `Are you sure you want to delete "${title || filename}"? This action cannot be undone.`,
      onConfirm: async () => {
        await deleteAnalysis(filename);
        actions.setDeleteModal(false);
      },
    });
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="saved-analysis-item" onClick={handleClick}>
      <div className="analysis-item-content">
        <div className="analysis-item-title" title={title || filename}>
          {title || filename.replace('.md', '')}
        </div>
        <div className="analysis-item-meta">{formatDate(date)}</div>
      </div>

      <button
        className="analysis-delete-btn"
        onClick={handleDelete}
        title="Delete analysis"
      >
        <span className="material-symbols-outlined">delete</span>
      </button>
    </div>
  );
}
