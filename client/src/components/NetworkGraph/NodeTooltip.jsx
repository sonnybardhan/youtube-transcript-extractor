export function NodeTooltip({ node, categoryColors }) {
  if (!node) return null;

  const categoryColor = categoryColors[node.category] || categoryColors.other;

  return (
    <div className="node-tooltip">
      <div className="tooltip-title">{node.label}</div>
      <div className="tooltip-meta">
        {node.category && (
          <span className="tooltip-category">
            <span className="category-dot" style={{ backgroundColor: categoryColor }} />
            {node.category}
          </span>
        )}
        <span className="tooltip-stat">{node.conceptCount} concepts</span>
        <span className="tooltip-stat">{node.connectionCount} connections</span>
      </div>
      <div className="tooltip-hint">Click to open · Right-click to zoom</div>
    </div>
  );
}
