import { useCallback, useMemo, useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { fetchGraphData, fetchHistoryItem, fetchAnnotations } from '../utils/api';
import { parseMetadataForRerun, parseKnowledgeGraph } from '../utils/markdown';

// Category colors for nodes
const CATEGORY_COLORS = {
  business: '#10b981',
  technology: '#3b82f6',
  psychology: '#8b5cf6',
  philosophy: '#ec4899',
  productivity: '#f59e0b',
  health: '#ef4444',
  science: '#06b6d4',
  finance: '#84cc16',
  creativity: '#f97316',
  other: '#6b7280',
};

export function useNetworkGraph() {
  const { actions } = useApp();
  const [graphData, setGraphData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [centerFile, setCenterFile] = useState(null);
  const [maxNodes, setMaxNodes] = useState(100);
  const [minConnection, setMinConnection] = useState(2);

  // Load graph data
  const loadGraphData = useCallback(async (options = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchGraphData({
        center: options.center || centerFile,
        limit: options.limit || maxNodes,
        minScore: options.minScore || minConnection,
      });
      setGraphData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [centerFile, maxNodes, minConnection]);

  // Transform data for react-force-graph
  const forceGraphData = useMemo(() => {
    if (!graphData) return { nodes: [], links: [] };

    const nodes = graphData.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      val: Math.max(node.conceptCount, 1) * 2, // Size based on concept count
      color: CATEGORY_COLORS[node.category] || CATEGORY_COLORS.other,
      category: node.category,
      conceptCount: node.conceptCount,
      connectionCount: node.connectionCount,
      isCenter: node.isCenter,
    }));

    const links = graphData.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      value: edge.score,
      sharedConcepts: edge.sharedConcepts,
      sharedEntities: edge.sharedEntities,
      sharedTags: edge.sharedTags,
      sharedCategory: edge.sharedCategory,
    }));

    return { nodes, links };
  }, [graphData]);

  // Navigate to a file when clicking a node
  const navigateToFile = useCallback(async (filename) => {
    try {
      const [data, annotations] = await Promise.all([
        fetchHistoryItem(filename),
        fetchAnnotations(filename).catch(() => []),
      ]);

      const titleMatch = data.content.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1] : filename.replace('.md', '');
      const parsedMetadata = parseMetadataForRerun(data.content, title);

      actions.setCurrentExtraction({
        markdown: data.content,
        filename,
        metadata: parsedMetadata,
        transcript: parsedMetadata.transcript || '',
        model: null,
      });

      if (data.signal) {
        actions.setSignalData(data.signal);
      } else {
        const knowledgeGraph = parseKnowledgeGraph(data.content);
        actions.setSignalData(knowledgeGraph);
      }

      actions.setAnnotations(annotations);
      actions.setView('results');
      actions.setCurrentPage('main');
    } catch (err) {
      actions.showToast(err.message);
    }
  }, [actions]);

  // Focus on a specific file (right-click)
  const focusOnFile = useCallback((filename) => {
    setCenterFile(filename);
    loadGraphData({ center: filename });
  }, [loadGraphData]);

  // Clear focus
  const clearFocus = useCallback(() => {
    setCenterFile(null);
    loadGraphData({ center: null });
  }, [loadGraphData]);

  // Update max nodes
  const updateMaxNodes = useCallback((value) => {
    setMaxNodes(value);
  }, []);

  // Update min connection
  const updateMinConnection = useCallback((value) => {
    setMinConnection(value);
  }, []);

  // Reload with new settings
  const reload = useCallback(() => {
    loadGraphData();
  }, [loadGraphData]);

  return {
    // State
    graphData,
    forceGraphData,
    isLoading,
    error,
    centerFile,
    maxNodes,
    minConnection,
    stats: graphData?.stats || null,

    // Actions
    loadGraphData,
    navigateToFile,
    focusOnFile,
    clearFocus,
    updateMaxNodes,
    updateMinConnection,
    reload,

    // Constants
    categoryColors: CATEGORY_COLORS,
  };
}
