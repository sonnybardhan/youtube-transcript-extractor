import { useCallback, useMemo, useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { fetchMetadataIndex, rebuildMetadataIndex, fetchHistoryItem, fetchAnnotations } from '../utils/api';
import { parseMetadataForRerun, parseKnowledgeGraph } from '../utils/markdown';

export function useMetadataExplorer() {
  const { state, actions } = useApp();
  const { metadataIndex, explorerSelectedTerms, explorerFilterMode, history } = state;
  const [isLoading, setIsLoading] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [error, setError] = useState(null);

  // Load the metadata index
  const loadIndex = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchMetadataIndex();
      if (result.index) {
        actions.setMetadataIndex(result.index);
      } else {
        setError(result.error || 'No metadata index found');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [actions]);

  // Rebuild the metadata index
  const rebuildIndex = useCallback(async () => {
    setIsRebuilding(true);
    setError(null);
    try {
      const result = await rebuildMetadataIndex();
      if (result.index) {
        actions.setMetadataIndex(result.index);
        actions.showToast('Metadata index rebuilt successfully', 'success');
      }
    } catch (err) {
      setError(err.message);
      actions.showToast('Failed to rebuild index: ' + err.message);
    } finally {
      setIsRebuilding(false);
    }
  }, [actions]);

  // Toggle a term selection
  const toggleTerm = useCallback((type, term) => {
    const currentTerms = explorerSelectedTerms[type] || [];
    const isSelected = currentTerms.includes(term);

    const newTerms = isSelected
      ? currentTerms.filter((t) => t !== term)
      : [...currentTerms, term];

    actions.setExplorerSelectedTerms({
      ...explorerSelectedTerms,
      [type]: newTerms,
    });
  }, [explorerSelectedTerms, actions]);

  // Check if a term is selected
  const isTermSelected = useCallback((type, term) => {
    return (explorerSelectedTerms[type] || []).includes(term);
  }, [explorerSelectedTerms]);

  // Clear all selections
  const clearAllSelections = useCallback(() => {
    actions.resetExplorer();
  }, [actions]);

  // Toggle filter mode
  const toggleFilterMode = useCallback(() => {
    actions.setExplorerFilterMode(explorerFilterMode === 'AND' ? 'OR' : 'AND');
  }, [explorerFilterMode, actions]);

  // Get all terms with file counts from the index
  const indexedTerms = useMemo(() => {
    if (!metadataIndex) {
      return { concepts: [], entities: [], tags: [], categories: [] };
    }

    const mapTerms = (termObj) =>
      Object.entries(termObj || {})
        .map(([term, data]) => ({
          term,
          count: Array.isArray(data) ? data.length : (data?.files?.length || 0),
          files: Array.isArray(data) ? data : (data?.files || []),
        }))
        .sort((a, b) => b.count - a.count);

    return {
      concepts: mapTerms(metadataIndex.concepts),
      entities: mapTerms(metadataIndex.entities),
      tags: mapTerms(metadataIndex.tags),
      categories: Object.entries(metadataIndex.categories || {}).map(([term, files]) => ({
        term,
        count: files.length,
        files,
      })).sort((a, b) => b.count - a.count),
    };
  }, [metadataIndex]);

  // Calculate matching files based on selected terms and filter mode
  // (moved up so cascadedTerms can reference it)
  const matchingFiles = useMemo(() => {
    if (!metadataIndex) return [];

    const { concepts, entities, tags, categories } = explorerSelectedTerms;
    const hasSelections =
      concepts.length > 0 ||
      entities.length > 0 ||
      tags.length > 0 ||
      categories.length > 0;

    if (!hasSelections) return [];

    // Get files for each selected term
    const getFilesForType = (type, terms) => {
      if (!terms.length) return null;
      const termData = metadataIndex[type];
      if (!termData) return null;

      return terms.map((term) => {
        if (type === 'categories') {
          return new Set(termData[term] || []);
        }
        return new Set(termData[term]?.files || []);
      });
    };

    const conceptFiles = getFilesForType('concepts', concepts);
    const entityFiles = getFilesForType('entities', entities);
    const tagFiles = getFilesForType('tags', tags);
    const categoryFiles = getFilesForType('categories', categories);

    // Combine all term file sets
    const allTermFileSets = [
      ...(conceptFiles || []),
      ...(entityFiles || []),
      ...(tagFiles || []),
      ...(categoryFiles || []),
    ].filter(Boolean);

    if (allTermFileSets.length === 0) return [];

    let resultFiles;

    if (explorerFilterMode === 'AND') {
      // Intersection: file must have ALL selected terms
      resultFiles = allTermFileSets.reduce((acc, set) => {
        if (!acc) return set;
        return new Set([...acc].filter((f) => set.has(f)));
      }, null);
    } else {
      // Union: file must have ANY selected term
      resultFiles = allTermFileSets.reduce((acc, set) => {
        if (!acc) return set;
        return new Set([...acc, ...set]);
      }, null);
    }

    // Map to full file info from history
    const historyMap = new Map(history.map((h) => [h.filename, h]));
    return [...(resultFiles || [])]
      .map((filename) => historyMap.get(filename) || { filename, title: filename.replace(/\.md$/, '') })
      .sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  }, [metadataIndex, explorerSelectedTerms, explorerFilterMode, history]);

  // Cascaded terms: filter available terms based on current selection
  const cascadedTerms = useMemo(() => {
    const { concepts, entities, tags, categories } = explorerSelectedTerms;
    const hasSelections =
      concepts.length > 0 ||
      entities.length > 0 ||
      tags.length > 0 ||
      categories.length > 0;

    // No filtering needed if nothing is selected
    if (!hasSelections) return indexedTerms;

    const matchingFileSet = new Set(matchingFiles.map((f) => f.filename));

    const filterTermsForType = (terms, type) =>
      terms.map((t) => {
        const filteredCount = t.files.filter((f) => matchingFileSet.has(f)).length;
        // A term is available if it appears in any matching file,
        // OR if it's currently selected (so user can deselect it)
        const isSelected = explorerSelectedTerms[type]?.includes(t.term);
        return {
          ...t,
          filteredCount,
          available: filteredCount > 0 || isSelected,
          isSelected,
        };
      });

    return {
      concepts: filterTermsForType(indexedTerms.concepts, 'concepts'),
      entities: filterTermsForType(indexedTerms.entities, 'entities'),
      tags: filterTermsForType(indexedTerms.tags, 'tags'),
      categories: filterTermsForType(indexedTerms.categories, 'categories'),
    };
  }, [indexedTerms, matchingFiles, explorerSelectedTerms]);

  // Get the count of selected terms
  const selectedTermCount = useMemo(() => {
    const { concepts, entities, tags, categories } = explorerSelectedTerms;
    return concepts.length + entities.length + tags.length + categories.length;
  }, [explorerSelectedTerms]);

  // Navigate to a file from the explorer
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

  return {
    // State
    metadataIndex,
    indexedTerms,
    cascadedTerms,
    selectedTerms: explorerSelectedTerms,
    filterMode: explorerFilterMode,
    matchingFiles,
    selectedTermCount,
    isLoading,
    isRebuilding,
    error,

    // Actions
    loadIndex,
    rebuildIndex,
    toggleTerm,
    isTermSelected,
    clearAllSelections,
    toggleFilterMode,
    navigateToFile,
  };
}
