import { useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { extractBasic, createStreamingRequest } from '../utils/api';
import { parsePartialJSON } from '../utils/streaming';
import { LLM_MODELS } from '../utils/config';

// Throttle interval for state updates (ms)
const THROTTLE_INTERVAL = 100;

export function useExtraction() {
  const { state, actions, reloadHistory } = useApp();
  const lastUpdateTimeRef = useRef(0);
  const pendingUpdateRef = useRef(null);
  const throttleTimeoutRef = useRef(null);

  // Throttled state update function
  const throttledSetStreamingState = useCallback((newState) => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTimeRef.current;

    pendingUpdateRef.current = newState;

    if (timeSinceLastUpdate >= THROTTLE_INTERVAL) {
      // Enough time has passed - update immediately
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
        throttleTimeoutRef.current = null;
      }
      lastUpdateTimeRef.current = now;
      actions.setStreamingState(newState);
      pendingUpdateRef.current = null;
    } else if (!throttleTimeoutRef.current) {
      // Schedule a trailing update
      const delay = THROTTLE_INTERVAL - timeSinceLastUpdate;
      throttleTimeoutRef.current = setTimeout(() => {
        throttleTimeoutRef.current = null;
        if (pendingUpdateRef.current) {
          lastUpdateTimeRef.current = Date.now();
          actions.setStreamingState(pendingUpdateRef.current);
          pendingUpdateRef.current = null;
        }
      }, delay);
    }
  }, [actions]);

  // Flush pending state update
  const flushStreamingState = useCallback((finalState) => {
    if (throttleTimeoutRef.current) {
      clearTimeout(throttleTimeoutRef.current);
      throttleTimeoutRef.current = null;
    }
    actions.setStreamingState(finalState);
    pendingUpdateRef.current = null;
  }, [actions]);

  // Reset throttle state
  const resetThrottleState = useCallback(() => {
    lastUpdateTimeRef.current = 0;
    pendingUpdateRef.current = null;
    if (throttleTimeoutRef.current) {
      clearTimeout(throttleTimeoutRef.current);
      throttleTimeoutRef.current = null;
    }
  }, []);

  const processWithLLMStreaming = useCallback(async (basicInfo, options) => {
    const { provider, model, compressionLevel, isRerun = false } = options;
    const title = basicInfo.title;

    // Store the model label for display
    const modelInfo = LLM_MODELS[provider]?.find((m) => m.value === model);
    actions.setCurrentExtraction({ model: modelInfo?.label || model });

    let accumulated = '';
    let lastSections = {};

    // Reset throttle state
    resetThrottleState();
    actions.setIsStreaming(true);

    return new Promise((resolve, reject) => {
      const streamController = createStreamingRequest(
        '/api/extract/process/stream',
        {
          basicInfo,
          llm: { provider, model },
          compressionLevel,
          isRerun,
        },
        {
          onStarted: async (data) => {
            // Clear old markdown and set new filename so streaming UI shows
            actions.setCurrentExtraction({ filename: data.filename, markdown: '' });
            actions.setProcessingFilename(data.filename);
            await reloadHistory();
          },
          onChunk: (chunk) => {
            accumulated += chunk;
            lastSections = parsePartialJSON(accumulated);
            throttledSetStreamingState({ accumulated, lastSections, title, basicInfo });
          },
          onComplete: async (data) => {
            actions.setAbortController(null);
            actions.setProcessingFilename(null);

            // Flush final state before clearing
            flushStreamingState({ accumulated, lastSections, title, basicInfo });

            // Small delay to ensure final render, then clear streaming state
            setTimeout(() => {
              actions.setStreamingState(null);
              actions.setIsStreaming(false);
            }, 50);

            actions.setCurrentExtraction({
              markdown: data.markdown,
              filename: data.filename,
            });

            if (data.signal) {
              actions.setSignalData(data.signal);
            }

            await reloadHistory();
            resolve(data);
          },
          onError: (err) => {
            actions.setAbortController(null);
            actions.setProcessingFilename(null);
            actions.setStreamingState(null);
            actions.setIsStreaming(false);
            reject(err);
          },
        }
      );

      actions.setAbortController(streamController);
    });
  }, [actions, reloadHistory, throttledSetStreamingState, flushStreamingState, resetThrottleState]);

  const handleExtract = useCallback(async (urls) => {
    if (!urls || urls.length === 0) {
      actions.showToast('Please enter at least one YouTube URL');
      return;
    }

    const { provider, model, compressionLevel } = state;
    const llm = provider && model ? { provider, model } : null;

    actions.setLoading(true, 'Extracting transcripts...');

    try {
      // Phase 1: Fetch basic info for all URLs
      const basicPromises = urls.map((url) =>
        extractBasic(url).then((data) => ({ url, ...data }))
      );

      const basicResults = await Promise.all(basicPromises);
      const successfulBasic = basicResults.filter((r) => r.success);
      const failedBasic = basicResults.filter((r) => !r.success);

      if (failedBasic.length > 0) {
        const errorMsgs = failedBasic.map((e) => `${e.url}: ${e.error}`).join('\n');
        actions.showToast(errorMsgs);
      }

      if (successfulBasic.length === 0) {
        actions.showToast('No results returned');
        actions.setLoading(false);
        return;
      }

      const firstBasic = successfulBasic[0].data;

      actions.setLoading(false);
      actions.setView('results');
      actions.setCurrentExtraction({
        metadata: firstBasic,
        transcript: firstBasic.transcriptFormatted || firstBasic.transcript || '',
      });
      actions.setSignalData(null);

      // Phase 2: Process with LLM
      if (llm) {
        const result = successfulBasic[0];

        if (!result.data.hasTranscript) {
          actions.showToast('No transcript available for this video');
          actions.setCurrentExtraction({ model: null });
          actions.setView('input');
          return { basicInfo: successfulBasic.map((r) => r.data), noLLM: true };
        }

        try {
          await processWithLLMStreaming(result.data, {
            provider,
            model,
            compressionLevel,
            isRerun: false,
          });
        } catch (err) {
          actions.showToast(err.message);
          actions.setCurrentExtraction({ model: null });
          return { basicInfo: successfulBasic.map((r) => r.data), noLLM: true };
        }
      } else {
        // No LLM - return basic content
        actions.setCurrentExtraction({
          markdown: '',
          filename: null,
          model: null,
        });
        return { basicInfo: successfulBasic.map((r) => r.data), noLLM: true };
      }

      return { success: true };
    } catch (err) {
      actions.showToast(`Request failed: ${err.message}`);
      return { error: err.message };
    } finally {
      actions.setLoading(false);
    }
  }, [state, actions, processWithLLMStreaming]);

  const handleRerunLLM = useCallback(async () => {
    const { currentMetadata, provider, model, compressionLevel } = state;

    if (!currentMetadata) {
      actions.showToast('Cannot rerun: no video data available');
      return;
    }

    if (!currentMetadata.hasTranscript) {
      actions.showToast('Cannot rerun: no transcript available');
      return;
    }

    if (!provider || !model) {
      actions.showToast('Please select an LLM provider and model first');
      return;
    }

    actions.setView('results');
    actions.setSignalData(null);
    // Clear markdown immediately so loading skeleton shows
    actions.setCurrentExtraction({ markdown: '' });

    try {
      await processWithLLMStreaming(currentMetadata, {
        provider,
        model,
        compressionLevel,
        isRerun: true,
      });
      actions.showToast('Successfully reprocessed with LLM', 'success');
    } catch (err) {
      actions.showToast(err.message);
    }
  }, [state, actions, processWithLLMStreaming]);

  const cancelExtraction = useCallback(() => {
    actions.cancelCurrentRequest();
  }, [actions]);

  return {
    handleExtract,
    handleRerunLLM,
    cancelExtraction,
    isStreaming: state.isStreaming,
    streamingState: state.streamingState,
  };
}
