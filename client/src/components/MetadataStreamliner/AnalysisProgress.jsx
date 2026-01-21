export function AnalysisProgress({ progress, onCancel }) {
  const getProgressMessage = () => {
    if (!progress) return 'Initializing analysis...';

    if (progress.type === 'collecting') {
      return `Collecting metadata from files... (${progress.processed}/${progress.total})`;
    }

    if (progress.type === 'analyzing') {
      return progress.message || 'Analyzing...';
    }

    return 'Processing...';
  };

  const getProgressPercent = () => {
    if (!progress) return 0;

    if (progress.type === 'collecting' && progress.total > 0) {
      // Collection phase is 0-30%
      return Math.round((progress.processed / progress.total) * 30);
    }

    if (progress.type === 'analyzing') {
      // Analysis phase is 30-100% (4 fields)
      const fieldOrder = ['concepts', 'entities', 'tags', 'categories'];
      const fieldIndex = fieldOrder.indexOf(progress.field);
      if (fieldIndex >= 0) {
        return 30 + Math.round(((fieldIndex + 1) / 4) * 70);
      }
    }

    return 50;
  };

  const percent = getProgressPercent();

  return (
    <div className="analysis-progress">
      <div className="analysis-progress-icon">
        <span className="material-symbols-outlined spinning">sync</span>
      </div>

      <div className="analysis-progress-content">
        <h3>Analyzing Metadata</h3>
        <p className="analysis-progress-message">{getProgressMessage()}</p>

        <div className="analysis-progress-bar-container">
          <div
            className="analysis-progress-bar"
            style={{ width: `${percent}%` }}
          />
        </div>

        {progress?.type === 'analyzing' && progress.count && (
          <p className="analysis-progress-detail">
            Found {progress.count} unique {progress.field}
          </p>
        )}

        {progress?.current && (
          <p className="analysis-progress-current">
            Processing: {progress.current}
          </p>
        )}
      </div>

      <button className="analysis-cancel-btn" onClick={onCancel}>
        <span className="material-symbols-outlined">close</span>
        Cancel
      </button>
    </div>
  );
}
