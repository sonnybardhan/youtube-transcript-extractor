import { useCallback, useRef, useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { fetchMetadataPreview, createMetadataAnalysisStream, applyMetadataChanges, createApplyStream } from '../utils/api';

export function useMetadataStreamliner() {
  const { state, actions, reloadHistory } = useApp();
  const [signalFileCount, setSignalFileCount] = useState(0);
  const [metadataPreview, setMetadataPreview] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [selectedNormalizations, setSelectedNormalizations] = useState(null);
  const [applyProgress, setApplyProgress] = useState(null);
  const abortControllerRef = useRef(null);

  const {
    streamlinerModalOpen,
    streamlinerPhase,
    streamlinerProgress,
    streamlinerProposedChanges,
    streamlinerResult,
    provider,
    model,
    selectedItems,
  } = state;

  // Convert selected items Set to array of filenames for API calls
  const selectedFiles = Array.from(selectedItems || []);

  const loadStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const preview = await fetchMetadataPreview(selectedFiles);
      setSignalFileCount(preview.fileCount);
      setMetadataPreview(preview);
    } catch (err) {
      console.error('Failed to load metadata preview:', err);
      setSignalFileCount(0);
      setMetadataPreview(null);
    } finally {
      setIsLoadingStats(false);
    }
  }, [selectedFiles.length]); // Re-run when selection changes

  // Load stats when modal opens or selection changes
  useEffect(() => {
    if (streamlinerModalOpen && streamlinerPhase === 'setup') {
      loadStats();
    }
  }, [streamlinerModalOpen, streamlinerPhase, loadStats, selectedFiles.length]);

  // Initialize selections when proposed changes are set
  useEffect(() => {
    if (streamlinerProposedChanges) {
      const { concepts, entities, tags, categories } = streamlinerProposedChanges;

      // Select all merge items by default (items with > 1 alias)
      const initSection = (items) => {
        const mergeItems = items.filter(item => item.aliases.length > 1);
        return mergeItems.map((_, idx) => idx);
      };

      setSelectedNormalizations({
        concepts: initSection(concepts),
        entities: initSection(entities),
        tags: initSection(tags),
        categories: initSection(categories),
      });
    } else {
      setSelectedNormalizations(null);
    }
  }, [streamlinerProposedChanges]);

  const openModal = useCallback(() => {
    actions.resetStreamliner();
    actions.setStreamlinerModalOpen(true);
  }, [actions]);

  const closeModal = useCallback(() => {
    // Abort any ongoing analysis
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    actions.resetStreamliner();
    setSelectedNormalizations(null);
    setApplyProgress(null);
  }, [actions]);

  const startAnalysis = useCallback(() => {
    if (!provider || !model) {
      actions.showToast('Please select an LLM provider and model first');
      return;
    }

    if (selectedFiles.length === 0) {
      actions.showToast('Please select summaries to analyze in the sidebar');
      return;
    }

    actions.setStreamlinerPhase('analyzing');
    actions.setStreamlinerProgress(null);

    const streamController = createMetadataAnalysisStream(
      { provider, model, files: selectedFiles },
      {
        onProgress: (progress) => {
          actions.setStreamlinerProgress(progress);
        },
        onFieldComplete: (data) => {
          // Update proposed changes with partial results
          actions.setStreamlinerProposedChanges(data.proposedChanges);
          // Transition to review phase on first field complete
          actions.setStreamlinerPhase('review');
          // Update progress to show which field is being processed
          actions.setStreamlinerProgress({
            type: 'fieldComplete',
            field: data.field,
            fieldIndex: data.fieldIndex,
            totalFields: data.totalFields,
          });
        },
        onComplete: (proposedChanges) => {
          abortControllerRef.current = null;
          actions.setStreamlinerProposedChanges(proposedChanges);
          actions.setStreamlinerProgress(null); // Clear progress when complete
        },
        onError: (err) => {
          abortControllerRef.current = null;
          actions.showToast(`Analysis failed: ${err.message}`);
          actions.setStreamlinerPhase('setup');
        },
      }
    );

    abortControllerRef.current = streamController;
  }, [provider, model, actions]);

  const cancelAnalysis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    actions.setStreamlinerPhase('setup');
    actions.setStreamlinerProgress(null);
    actions.showToast('Analysis cancelled', 'info');
  }, [actions]);

  // Toggle a single normalization item
  const toggleItem = useCallback((section, index) => {
    setSelectedNormalizations(prev => {
      if (!prev) return prev;
      const sectionIndices = prev[section] || [];
      const isSelected = sectionIndices.includes(index);

      return {
        ...prev,
        [section]: isSelected
          ? sectionIndices.filter(i => i !== index)
          : [...sectionIndices, index].sort((a, b) => a - b)
      };
    });
  }, []);

  // Toggle all items in a section
  const toggleAll = useCallback((section, select) => {
    if (!streamlinerProposedChanges) return;

    const items = streamlinerProposedChanges[section];
    const mergeItems = items.filter(item => item.aliases.length > 1);

    setSelectedNormalizations(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [section]: select ? mergeItems.map((_, idx) => idx) : []
      };
    });
  }, [streamlinerProposedChanges]);

  // Filter proposed changes to only include selected items
  const getFilteredChanges = useCallback(() => {
    if (!streamlinerProposedChanges || !selectedNormalizations) {
      return null;
    }

    const filterSection = (items, selectedIndices) => {
      const mergeItems = items.filter(item => item.aliases.length > 1);
      return selectedIndices.map(idx => mergeItems[idx]).filter(Boolean);
    };

    return {
      concepts: filterSection(streamlinerProposedChanges.concepts, selectedNormalizations.concepts),
      entities: filterSection(streamlinerProposedChanges.entities, selectedNormalizations.entities),
      tags: filterSection(streamlinerProposedChanges.tags, selectedNormalizations.tags),
      categories: filterSection(streamlinerProposedChanges.categories, selectedNormalizations.categories),
    };
  }, [streamlinerProposedChanges, selectedNormalizations]);

  const applyChanges = useCallback(async () => {
    const filteredChanges = getFilteredChanges();
    if (!filteredChanges) {
      actions.showToast('No changes to apply');
      return;
    }

    // Check if there are any selected changes
    const totalSelected = Object.values(filteredChanges).reduce(
      (sum, items) => sum + items.length,
      0
    );
    if (totalSelected === 0) {
      actions.showToast('No normalizations selected');
      return;
    }

    actions.setStreamlinerPhase('applying');
    setApplyProgress({ current: 0, total: 0, currentFile: '' });

    try {
      // Try streaming apply first
      const streamController = createApplyStream(
        filteredChanges,
        {
          onProgress: (progress) => {
            setApplyProgress(progress);
          },
          onComplete: async (result) => {
            abortControllerRef.current = null;
            actions.setStreamlinerResult(result);
            actions.setStreamlinerPhase('complete');
            await reloadHistory();
            actions.showToast(`Successfully updated ${result.updatedFiles} files`, 'success');
          },
          onError: (err) => {
            abortControllerRef.current = null;
            actions.showToast(`Failed to apply changes: ${err.message}`);
            actions.setStreamlinerPhase('review');
          },
        }
      );
      abortControllerRef.current = streamController;
    } catch (err) {
      // Fallback to non-streaming apply
      try {
        const result = await applyMetadataChanges(filteredChanges);
        actions.setStreamlinerResult(result);
        actions.setStreamlinerPhase('complete');
        await reloadHistory();
        actions.showToast(`Successfully updated ${result.updatedFiles} files`, 'success');
      } catch (fallbackErr) {
        actions.showToast(`Failed to apply changes: ${fallbackErr.message}`);
        actions.setStreamlinerPhase('review');
      }
    }
  }, [getFilteredChanges, actions, reloadHistory]);

  const resetToSetup = useCallback(() => {
    actions.setStreamlinerPhase('setup');
    actions.setStreamlinerProgress(null);
    actions.setStreamlinerProposedChanges(null);
    actions.setStreamlinerResult(null);
    setSelectedNormalizations(null);
    setApplyProgress(null);
  }, [actions]);

  // Calculate change summary including selection counts
  const getChangeSummary = useCallback(() => {
    if (!streamlinerProposedChanges) return null;

    const { concepts, entities, tags, categories } = streamlinerProposedChanges;

    // Count normalizations that actually have multiple aliases (real merges)
    const getMergeItems = (items) => items.filter((c) => c.aliases.length > 1);
    const conceptMerges = getMergeItems(concepts).length;
    const entityMerges = getMergeItems(entities).length;
    const tagMerges = getMergeItems(tags).length;
    const categoryMerges = getMergeItems(categories).length;

    // Get total files that will be affected (all)
    const allAffectedFiles = new Set();
    [...concepts, ...entities, ...tags, ...categories]
      .filter(c => c.aliases.length > 1)
      .forEach((change) => {
        change.files.forEach((file) => allAffectedFiles.add(file));
      });

    // Calculate selected counts
    let selectedMerges = conceptMerges + entityMerges + tagMerges + categoryMerges;
    let selectedFileCount = allAffectedFiles.size;

    if (selectedNormalizations) {
      selectedMerges =
        selectedNormalizations.concepts.length +
        selectedNormalizations.entities.length +
        selectedNormalizations.tags.length +
        selectedNormalizations.categories.length;

      // Get files affected by selected normalizations only
      const selectedAffectedFiles = new Set();
      const addSelectedFiles = (items, selectedIndices) => {
        const mergeItems = getMergeItems(items);
        selectedIndices.forEach(idx => {
          const item = mergeItems[idx];
          if (item) {
            item.files.forEach(file => selectedAffectedFiles.add(file));
          }
        });
      };

      addSelectedFiles(concepts, selectedNormalizations.concepts);
      addSelectedFiles(entities, selectedNormalizations.entities);
      addSelectedFiles(tags, selectedNormalizations.tags);
      addSelectedFiles(categories, selectedNormalizations.categories);

      selectedFileCount = selectedAffectedFiles.size;
    }

    return {
      conceptMerges,
      entityMerges,
      tagMerges,
      categoryMerges,
      totalMerges: conceptMerges + entityMerges + tagMerges + categoryMerges,
      affectedFileCount: allAffectedFiles.size,
      selectedMerges,
      selectedFileCount,
    };
  }, [streamlinerProposedChanges, selectedNormalizations]);

  return {
    // State
    isOpen: streamlinerModalOpen,
    phase: streamlinerPhase,
    progress: streamlinerProgress,
    proposedChanges: streamlinerProposedChanges,
    result: streamlinerResult,
    signalFileCount,
    metadataPreview,
    isLoadingStats,
    provider,
    model,
    selectedNormalizations,
    applyProgress,
    selectedFilesCount: selectedFiles.length,

    // Computed
    changeSummary: getChangeSummary(),

    // Actions
    openModal,
    closeModal,
    startAnalysis,
    cancelAnalysis,
    applyChanges,
    resetToSetup,
    toggleItem,
    toggleAll,
  };
}
