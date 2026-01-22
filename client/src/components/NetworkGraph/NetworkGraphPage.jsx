import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useApp } from '../../context/AppContext';
import { useNetworkGraph } from '../../hooks/useNetworkGraph';
import { NodeTooltip } from './NodeTooltip';
import { GraphControls } from './GraphControls';

const HIGHLIGHT_COLOR = '#ff6b6b';

export function NetworkGraphPage() {
  const { state, actions } = useApp();
  const { theme } = state;
  const isLightMode = theme === 'light' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches);

  const {
    forceGraphData,
    isLoading,
    error,
    centerFile,
    maxNodes,
    minConnection,
    stats,
    loadGraphData,
    navigateToFile,
    focusOnFile,
    clearFocus,
    updateMaxNodes,
    updateMinConnection,
    reload,
    categoryColors,
  } = useNetworkGraph();

  const graphRef = useRef();
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredNode, setHoveredNode] = useState(null);

  // Build a map of connected nodes for highlighting
  const connectedNodes = useMemo(() => {
    if (!hoveredNode) return new Set();

    const connected = new Set();
    connected.add(hoveredNode.id);

    forceGraphData.links.forEach(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;

      if (sourceId === hoveredNode.id) connected.add(targetId);
      if (targetId === hoveredNode.id) connected.add(sourceId);
    });

    return connected;
  }, [hoveredNode, forceGraphData.links]);

  // Load data on mount
  useEffect(() => {
    loadGraphData();
  }, [loadGraphData]);

  // Simple dimension calculation
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setDimensions({ width: rect.width, height: rect.height });
        }
      }
    };

    // Initial size
    updateSize();
    // Small delay to ensure layout is complete
    const timer = setTimeout(updateSize, 100);

    window.addEventListener('resize', updateSize);
    return () => {
      window.removeEventListener('resize', updateSize);
      clearTimeout(timer);
    };
  }, []);

  // Configure forces and zoom to fit when graph data changes
  useEffect(() => {
    if (!graphRef.current || forceGraphData.nodes.length === 0) return;

    // Configure forces for better spreading
    const charge = graphRef.current.d3Force('charge');
    if (charge) charge.strength(-300);

    const link = graphRef.current.d3Force('link');
    if (link) link.distance(80);

    // Zoom to fit after simulation settles
    const timer = setTimeout(() => {
      graphRef.current?.zoomToFit(300, 50);
    }, 800);

    return () => clearTimeout(timer);
  }, [forceGraphData.nodes.length]);

  const handleBack = () => {
    actions.setCurrentPage('main');
  };

  const handleNodeClick = useCallback((node) => {
    navigateToFile(node.id);
  }, [navigateToFile]);

  const handleNodeRightClick = useCallback((node, event) => {
    event.preventDefault();
    // Zoom to the node instead of reloading the graph
    if (graphRef.current) {
      graphRef.current.centerAt(node.x, node.y, 300);
      graphRef.current.zoom(2, 300);
    }
  }, []);

  const handleNodeHover = useCallback((node) => {
    setHoveredNode(node);
  }, []);

  const handleZoomToFit = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400, 50);
    }
  }, []);

  const handleZoomIn = useCallback(() => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom();
      graphRef.current.zoom(Math.min(currentZoom * 1.4, 4), 200);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom();
      graphRef.current.zoom(Math.max(currentZoom / 1.4, 0.5), 200);
    }
  }, []);

  const handleMaxNodesChange = useCallback((value) => {
    updateMaxNodes(value);
  }, [updateMaxNodes]);

  const handleMinConnectionChange = useCallback((value) => {
    updateMinConnection(value);
  }, [updateMinConnection]);

  // Custom node rendering with labels
  const paintNode = useCallback((node, ctx, globalScale) => {
    const isHovered = hoveredNode?.id === node.id;
    const isConnected = connectedNodes.has(node.id);
    const nodeRadius = Math.sqrt(node.val) * 2.5;

    // Draw node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI);

    // Highlight color for hovered/connected nodes
    if (isHovered) {
      ctx.fillStyle = HIGHLIGHT_COLOR;
    } else if (hoveredNode && isConnected) {
      ctx.fillStyle = HIGHLIGHT_COLOR + 'aa'; // slightly transparent
    } else if (hoveredNode && !isConnected) {
      ctx.fillStyle = node.color + '44'; // dimmed
    } else {
      ctx.fillStyle = node.color;
    }
    ctx.fill();

    // Border
    ctx.strokeStyle = isLightMode ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = isHovered ? 2 : 1;
    ctx.stroke();

    // Draw label
    const fontSize = Math.max(10, 12 / globalScale);
    ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Truncate label
    const maxLen = 20;
    const label = node.label.length > maxLen
      ? node.label.substring(0, maxLen) + '...'
      : node.label;

    const textY = node.y + nodeRadius + 3;

    // Text background
    const textWidth = ctx.measureText(label).width;
    const padding = 2;
    ctx.fillStyle = isLightMode ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)';
    ctx.fillRect(
      node.x - textWidth / 2 - padding,
      textY,
      textWidth + padding * 2,
      fontSize + 2
    );

    // Text color - dim if not connected during hover
    if (hoveredNode && !isConnected) {
      ctx.fillStyle = isLightMode ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)';
    } else {
      ctx.fillStyle = isLightMode ? '#1a1a1a' : '#e0e0e0';
    }
    ctx.fillText(label, node.x, textY);
  }, [hoveredNode, connectedNodes, isLightMode]);

  // Custom link rendering with highlighting
  const paintLink = useCallback((link, ctx, globalScale) => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;

    const isConnectedLink = hoveredNode &&
      (sourceId === hoveredNode.id || targetId === hoveredNode.id);

    ctx.beginPath();
    ctx.moveTo(link.source.x, link.source.y);
    ctx.lineTo(link.target.x, link.target.y);

    if (isConnectedLink) {
      // Highlight connected links
      ctx.strokeStyle = HIGHLIGHT_COLOR;
      ctx.lineWidth = Math.max(2, link.value / 2);
    } else if (hoveredNode) {
      // Dim unconnected links
      ctx.strokeStyle = isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 0.5;
    } else {
      // Normal state
      const opacity = 0.2 + (link.value / 30) * 0.3;
      ctx.strokeStyle = isLightMode ? `rgba(0,0,0,${opacity})` : `rgba(255,255,255,${opacity})`;
      ctx.lineWidth = Math.max(1, link.value / 4);
    }

    ctx.stroke();
  }, [hoveredNode, isLightMode]);

  // Node pointer area for better hover detection
  const nodePointerArea = useCallback((node, color, ctx) => {
    const nodeRadius = Math.sqrt(node.val) * 2.5;
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeRadius + 5, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  }, []);

  return (
    <div className="network-graph-page">
      <div className="graph-header">
        <div className="graph-header-left">
          <button className="back-btn" onClick={handleBack}>
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="graph-title">
            <h1>Network Graph</h1>
            {stats && (
              <span className="graph-stats">
                {stats.displayedFiles} nodes / {stats.displayedConnections} connections
                {stats.totalFiles > stats.displayedFiles && (
                  <span className="truncated">
                    ({stats.totalFiles} total files)
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
        <GraphControls
          maxNodes={maxNodes}
          minConnection={minConnection}
          centerFile={centerFile}
          onMaxNodesChange={handleMaxNodesChange}
          onMinConnectionChange={handleMinConnectionChange}
          onClearFocus={clearFocus}
          onZoomToFit={handleZoomToFit}
          onReload={reload}
          isLoading={isLoading}
        />
      </div>

      {error && (
        <div className="graph-error">
          <span className="material-symbols-outlined">error</span>
          <p>{error}</p>
          <button onClick={reload}>Try Again</button>
        </div>
      )}

      {isLoading && !forceGraphData.nodes.length && (
        <div className="graph-loading">
          <span className="spinner" />
          <p>Loading graph data...</p>
        </div>
      )}

      {!error && forceGraphData.nodes.length === 0 && !isLoading && (
        <div className="graph-empty">
          <span className="material-symbols-outlined">hub</span>
          <p>No connected documents found</p>
          <p className="hint">
            Extract videos with LLM processing to generate metadata and see connections
          </p>
        </div>
      )}

      {forceGraphData.nodes.length > 0 && (
        <div
          className="graph-container"
          ref={containerRef}
          onContextMenu={(e) => e.preventDefault()}
        >
          <ForceGraph2D
            ref={graphRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={forceGraphData}
            nodeCanvasObject={paintNode}
            nodePointerAreaPaint={nodePointerArea}
            linkCanvasObject={paintLink}
            onNodeClick={handleNodeClick}
            onNodeRightClick={handleNodeRightClick}
            onNodeHover={handleNodeHover}
            cooldownTicks={150}
            minZoom={0.5}
            maxZoom={4}
            backgroundColor={isLightMode ? '#f5f5f5' : '#1e1e1e'}
            enablePanInteraction={true}
            enableZoomInteraction={true}
          />
          <NodeTooltip
            node={hoveredNode}
            categoryColors={categoryColors}
          />
          <div className="graph-zoom-controls">
            <button onClick={handleZoomIn} title="Zoom in">
              <span className="material-symbols-outlined">add</span>
            </button>
            <button onClick={handleZoomOut} title="Zoom out">
              <span className="material-symbols-outlined">remove</span>
            </button>
            <button onClick={handleZoomToFit} title="Fit to view">
              <span className="material-symbols-outlined">fit_screen</span>
            </button>
          </div>
        </div>
      )}

      {forceGraphData.nodes.length > 0 && (
        <div className="graph-legend">
          {Object.entries(categoryColors).map(([category, color]) => (
            <div key={category} className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: color }} />
              <span className="legend-label">{category}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
