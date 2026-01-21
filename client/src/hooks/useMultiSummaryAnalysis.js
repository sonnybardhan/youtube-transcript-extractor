import { useCallback, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { createSummaryAnalysisStream, saveAnalysisResult } from '../utils/api';

// Predefined prompt descriptions for the UI
export const ANALYSIS_PROMPT_OPTIONS = [
  {
    id: 'similarities',
    name: 'Similarities',
    description: 'Find common themes, concepts, and ideas across selected videos',
    icon: 'join_inner',
  },
  {
    id: 'differences',
    name: 'Differences',
    description: 'Identify contrasting viewpoints, unique angles, or disagreements',
    icon: 'compare',
  },
  {
    id: 'saas',
    name: 'SaaS Ideas',
    description: 'Extract product/service opportunities based on problems discussed',
    icon: 'lightbulb',
  },
  {
    id: 'unified',
    name: 'Unified Summary',
    description: 'Merge into a single cohesive document with shared sections',
    icon: 'merge',
  },
  {
    id: 'generic',
    name: 'Generic Analysis',
    description: 'Open-ended analysis of connections between summaries',
    icon: 'psychology',
  },
];

export function useMultiSummaryAnalysis() {
  const { state, actions, reloadHistory } = useApp();
  const abortControllerRef = useRef(null);
  const accumulatedResponseRef = useRef('');

  const {
    selectedItems,
    provider,
    model,
    analyzeModalOpen,
    analyzeSelectedPrompt,
    analyzeCustomPrompt,
    analyzeResponse,
    analyzeIsStreaming,
  } = state;

  // Get selected filenames as array
  const selectedFilenames = Array.from(selectedItems);

  // Open the modal
  const openModal = useCallback(() => {
    actions.setAnalyzeModalOpen(true);
  }, [actions]);

  // Close the modal and reset state
  const closeModal = useCallback(() => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    actions.resetAnalyze();
  }, [actions]);

  // Start analysis
  const startAnalysis = useCallback(() => {
    if (selectedFilenames.length < 2) {
      actions.showToast('Select at least 2 summaries to analyze');
      return;
    }

    if (!provider || !model) {
      actions.showToast('Please select an LLM provider and model');
      return;
    }

    // Reset response and start streaming
    accumulatedResponseRef.current = '';
    actions.setAnalyzeResponse('');
    actions.setAnalyzeIsStreaming(true);

    const stream = createSummaryAnalysisStream(
      selectedFilenames,
      analyzeSelectedPrompt,
      analyzeCustomPrompt || null,
      { provider, model },
      {
        onChunk: (chunk) => {
          accumulatedResponseRef.current += chunk;
          actions.setAnalyzeResponse(accumulatedResponseRef.current);
        },
        onComplete: (response) => {
          actions.setAnalyzeResponse(response);
          actions.setAnalyzeIsStreaming(false);
        },
        onError: (error) => {
          actions.showToast(error.message);
          actions.setAnalyzeIsStreaming(false);
        },
      }
    );

    abortControllerRef.current = stream;
  }, [
    selectedFilenames,
    provider,
    model,
    analyzeSelectedPrompt,
    analyzeCustomPrompt,
    actions,
  ]);

  // Cancel ongoing analysis
  const cancelAnalysis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    actions.setAnalyzeIsStreaming(false);
  }, [actions]);

  // Copy response to clipboard
  const copyToClipboard = useCallback(async () => {
    if (!analyzeResponse) return;

    try {
      await navigator.clipboard.writeText(analyzeResponse);
      actions.showToast('Copied to clipboard', 'success');
    } catch (err) {
      actions.showToast('Failed to copy to clipboard');
    }
  }, [analyzeResponse, actions]);

  // Save response as file
  const saveAsFile = useCallback(async () => {
    if (!analyzeResponse) return;

    try {
      const promptName = ANALYSIS_PROMPT_OPTIONS.find(
        (p) => p.id === analyzeSelectedPrompt
      )?.name || 'Analysis';
      const title = `${promptName} - ${selectedFilenames.length} Summaries`;

      const result = await saveAnalysisResult(analyzeResponse, title);
      actions.showToast(`Saved as "${result.filename}"`, 'success');

      // Reload history to show the new file
      await reloadHistory();

      // Optionally close the modal after saving
      closeModal();
    } catch (err) {
      actions.showToast(err.message);
    }
  }, [
    analyzeResponse,
    analyzeSelectedPrompt,
    selectedFilenames.length,
    actions,
    reloadHistory,
    closeModal,
  ]);

  // Set selected prompt
  const setSelectedPrompt = useCallback((promptId) => {
    actions.setAnalyzeSelectedPrompt(promptId);
  }, [actions]);

  // Set custom prompt
  const setCustomPrompt = useCallback((prompt) => {
    actions.setAnalyzeCustomPrompt(prompt);
  }, [actions]);

  return {
    // State
    isOpen: analyzeModalOpen,
    selectedPrompt: analyzeSelectedPrompt,
    customPrompt: analyzeCustomPrompt,
    response: analyzeResponse,
    isStreaming: analyzeIsStreaming,
    selectedFilenames,
    selectedCount: selectedFilenames.length,
    provider,
    model,

    // Actions
    openModal,
    closeModal,
    startAnalysis,
    cancelAnalysis,
    copyToClipboard,
    saveAsFile,
    setSelectedPrompt,
    setCustomPrompt,
  };
}
