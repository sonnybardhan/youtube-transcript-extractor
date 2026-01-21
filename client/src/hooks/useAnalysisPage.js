import { useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  createSummaryAnalysisStream,
  saveAnalysisResult,
  fetchSavedAnalyses,
  fetchAnalysis,
  deleteAnalysisFile,
} from '../utils/api';

export function useAnalysisPage() {
  const { state, actions, reloadHistory } = useApp();
  const abortControllerRef = useRef(null);
  const accumulatedResponseRef = useRef('');

  const {
    selectedItems,
    provider,
    model,
    analyzeSelectedPrompt,
    analyzeCustomPrompt,
    analyzeResponse,
  } = state;

  const selectedFilenames = Array.from(selectedItems);

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
    actions.setAnalyzeSourceFilenames(selectedFilenames);
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

  // Save analysis result
  const saveAnalysis = useCallback(async (title) => {
    if (!analyzeResponse) return;

    try {
      const result = await saveAnalysisResult(
        analyzeResponse,
        title,
        selectedFilenames
      );
      actions.showToast(`Saved as "${result.filename}"`, 'success');

      // Reload saved analyses
      await actions.loadSavedAnalyses();

      // Reset analyze state
      actions.resetAnalyze();
    } catch (err) {
      actions.showToast(err.message);
    }
  }, [analyzeResponse, selectedFilenames, actions]);

  // Load a saved analysis
  const loadAnalysis = useCallback(async (filename) => {
    try {
      const analysis = await fetchAnalysis(filename);
      actions.setCurrentAnalysis(analysis);
    } catch (err) {
      actions.showToast(err.message);
    }
  }, [actions]);

  // Delete a saved analysis
  const deleteAnalysis = useCallback(async (filename) => {
    try {
      await deleteAnalysisFile(filename);
      actions.showToast('Analysis deleted', 'success');
      await actions.loadSavedAnalyses();
    } catch (err) {
      actions.showToast(err.message);
    }
  }, [actions]);

  return {
    // Actions
    startAnalysis,
    cancelAnalysis,
    copyToClipboard,
    saveAnalysis,
    loadAnalysis,
    deleteAnalysis,
  };
}
