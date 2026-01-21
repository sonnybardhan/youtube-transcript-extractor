export function LoadingOverlay({ message = 'Loading...', subtitle, onCancel }) {
  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <div className="spinner" />
        <p>{message}</p>
        {subtitle && <p className="loading-subtitle">{subtitle}</p>}
        {onCancel && (
          <button className="cancel-btn" onClick={onCancel}>
            <span className="material-symbols-outlined">close</span>
            <span>Cancel</span>
          </button>
        )}
      </div>
    </div>
  );
}
