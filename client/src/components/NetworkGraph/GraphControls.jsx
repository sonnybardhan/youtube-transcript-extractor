export function GraphControls({
  maxNodes,
  minConnection,
  centerFile,
  onMaxNodesChange,
  onMinConnectionChange,
  onClearFocus,
  onZoomToFit,
  onReload,
  isLoading,
}) {
  return (
    <div className="graph-controls">
      <div className="control-group">
        <label>
          <span className="control-label">Max nodes</span>
          <select
            value={maxNodes}
            onChange={(e) => onMaxNodesChange(parseInt(e.target.value))}
            disabled={isLoading}
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </label>
      </div>

      <div className="control-group">
        <label>
          <span className="control-label">Min connection</span>
          <select
            value={minConnection}
            onChange={(e) => onMinConnectionChange(parseInt(e.target.value))}
            disabled={isLoading}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={5}>5</option>
            <option value={10}>10</option>
          </select>
        </label>
      </div>

      <div className="control-buttons">
        <button
          className="control-btn"
          onClick={onReload}
          disabled={isLoading}
          title="Reload graph with current settings"
        >
          <span className="material-symbols-outlined">refresh</span>
        </button>

        <button
          className="control-btn"
          onClick={onZoomToFit}
          disabled={isLoading}
          title="Zoom to fit"
        >
          <span className="material-symbols-outlined">fit_screen</span>
        </button>

        {centerFile && (
          <button
            className="control-btn clear-focus"
            onClick={onClearFocus}
            disabled={isLoading}
            title="Clear focus"
          >
            <span className="material-symbols-outlined">center_focus_weak</span>
            Clear focus
          </button>
        )}
      </div>
    </div>
  );
}
