/**
 * Extraction and LLM processing functions
 */
import { LLM_MODELS } from './config.js';
import { getElements } from './elements.js';
import { getState, setState } from './state.js';
import { setLoading, showToast } from './ui.js';
import { showResultsView, showInputView, updateInfoPane, renderBasicContent, renderStreamingSections, updateSignalPane } from './views.js';
import { renderMarkdown } from './markdown.js';
import { loadHistory } from './history.js';
import { createStreamingRequest, parsePartialJSON, throttledRender, flushRender, resetThrottleState } from './streaming.js';

/**
 * Show/hide streaming UI controls
 */
function setStreamingUI(isStreaming) {
  const elements = getElements();
  if (isStreaming) {
    elements.cancelStreamBtn.classList.remove('hidden');
    elements.rerunLlmBtn.disabled = true;
  } else {
    elements.cancelStreamBtn.classList.add('hidden');
    elements.rerunLlmBtn.disabled = false;
  }
}

/**
 * Cancel the current in-progress request
 */
export function cancelCurrentRequest() {
  const currentRequest = getState('currentRequest');
  if (currentRequest) {
    currentRequest.abort();
    setState('currentRequest', null);
    setStreamingUI(false);

    const elements = getElements();
    // If loading overlay is visible, go back to input view
    // Otherwise stay on results view
    if (!elements.loadingOverlay.classList.contains('hidden')) {
      setLoading(false);
      showInputView();
    }

    showToast('Request cancelled');
  }
}

export function handleProviderChange() {
  const elements = getElements();
  const provider = elements.providerSelect.value;

  if (!provider) {
    elements.modelSelect.disabled = true;
    elements.modelSelect.textContent = '';
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Select provider';
    elements.modelSelect.appendChild(opt);
    return;
  }

  const models = LLM_MODELS[provider] || [];
  elements.modelSelect.disabled = false;
  elements.modelSelect.textContent = '';

  models.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.value;
    opt.textContent = m.label;
    elements.modelSelect.appendChild(opt);
  });
}

export function handleCompressionChange() {
  const elements = getElements();
  const level = parseInt(elements.compressionSlider.value, 10);
  setState('compressionLevel', level);
  elements.compressionValue.textContent = `${level}%`;
}

export async function handleExtract() {
  const elements = getElements();
  const urlText = elements.urlsInput.value.trim();

  if (!urlText) {
    showToast('Please enter at least one YouTube URL');
    return;
  }

  const urls = urlText.split('\n').map(u => u.trim()).filter(u => u);
  const provider = elements.providerSelect.value;
  const model = elements.modelSelect.value;
  const llm = provider && model ? { provider, model } : null;

  setLoading(true);

  try {
    // Phase 1: Fetch basic info for all URLs (parallel)
    const basicPromises = urls.map(url =>
      fetch('/api/extract/basic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      }).then(res => res.json()).then(data => ({ url, ...data }))
    );

    const basicResults = await Promise.all(basicPromises);

    // Separate successful and failed extractions
    const successfulBasic = basicResults.filter(r => r.success);
    const failedBasic = basicResults.filter(r => !r.success);

    if (failedBasic.length > 0) {
      const errorMsgs = failedBasic.map(e => `${e.url}: ${e.error}`).join('\n');
      showToast(errorMsgs);
    }

    if (successfulBasic.length === 0) {
      showToast('No results returned');
      setLoading(false);
      return;
    }

    // Show first result's transcript immediately in right pane
    const firstBasic = successfulBasic[0].data;
    const displayTitle = successfulBasic.length > 1
      ? `${successfulBasic.length} Videos`
      : firstBasic.title;

    // Hide full-page loading, switch to results view with transcript visible
    setLoading(false);
    showResultsView(null, displayTitle);
    updateInfoPane(firstBasic);
    updateSignalPane(null); // Clear previous signal data

    // Phase 2: Process with LLM (or show basic content)
    if (llm) {
      const llmErrors = [];
      const compressionLevel = getState('compressionLevel');

      // For now, process only the first video with streaming
      // (multiple video support can be added later)
      const result = successfulBasic[0];

      if (!result.data.hasTranscript) {
        llmErrors.push({ url: result.url, error: 'No transcript available' });
        setState('currentModel', null);
        renderBasicContent(successfulBasic.map(r => r.data));
      } else {
        // Use the shared LLM processing function
        try {
          await processWithLLMStreaming(result.data, {
            provider,
            model,
            compressionLevel,
            isRerun: false,
            skipViewSetup: true  // Already called showResultsView above
          });
        } catch (err) {
          llmErrors.push({ url: result.url, error: err.message });
          setState('currentModel', null);
          renderBasicContent(successfulBasic.map(r => r.data));
        }

        // Handle additional videos with non-streaming (for simplicity)
        if (successfulBasic.length > 1) {
          for (let i = 1; i < successfulBasic.length; i++) {
            const additionalResult = successfulBasic[i];
            if (!additionalResult.data.hasTranscript) {
              llmErrors.push({ url: additionalResult.url, error: 'No transcript available' });
              continue;
            }

            try {
              const llmRes = await fetch('/api/extract/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  basicInfo: additionalResult.data,
                  llm,
                  compressionLevel
                })
              });

              const llmData = await llmRes.json();

              if (llmData.success) {
                const currentMarkdown = getState('currentMarkdown');
                const combinedMarkdown = currentMarkdown + '\n\n---\n\n' + llmData.markdown;
                setState('currentMarkdown', combinedMarkdown);
                setState('currentFilename', null);
                renderMarkdown(combinedMarkdown);
              } else {
                llmErrors.push({ url: additionalResult.url, error: llmData.error });
              }
            } catch (err) {
              llmErrors.push({ url: additionalResult.url, error: err.message });
            }
          }
          await loadHistory();
        }
      }

      if (llmErrors.length > 0) {
        const errorMsgs = llmErrors.map(e => `${e.url}: ${e.error}`).join('\n');
        showToast(errorMsgs);
      }
    } else {
      // No LLM selected - show basic content immediately
      renderBasicContent(successfulBasic.map(r => r.data));
      setState('currentMarkdown', '');
      setState('currentFilename', null);
      setState('currentModel', null);
    }
  } catch (err) {
    showToast(`Request failed: ${err.message}`);
  } finally {
    setLoading(false);
    setLoading(false, true); // Also ensure results-only loading is hidden
  }
}

/**
 * Shared function to process basicInfo with LLM streaming
 * Used by both handleExtract and handleRerunLLM
 * @param {object} basicInfo - The basic extraction info (transcript, metadata, etc.)
 * @param {object} options - Processing options
 * @param {string} options.provider - LLM provider
 * @param {string} options.model - LLM model
 * @param {number} options.compressionLevel - Compression level
 * @param {boolean} options.isRerun - Whether this is a rerun (creates new file with timestamp)
 * @param {boolean} options.skipViewSetup - Skip showing loading view (caller already did it)
 * @returns {Promise<void>}
 */
export async function processWithLLMStreaming(basicInfo, options) {
  const { provider, model, compressionLevel, isRerun = false, skipViewSetup = false } = options;
  const title = basicInfo.title;

  // Store the model label for display
  const modelInfo = LLM_MODELS[provider]?.find(m => m.value === model);
  setState('currentModel', modelInfo?.label || model);

  // Show loading skeleton view (unless caller already did it)
  if (!skipViewSetup) {
    showResultsView(null, title);
    updateSignalPane(null);
  }

  let accumulated = '';
  let lastSections = {};

  // Reset throttle state before starting new stream
  resetThrottleState();
  setStreamingUI(true);

  await new Promise((resolve, reject) => {
    const streamController = createStreamingRequest(
      '/api/extract/process/stream',
      {
        basicInfo,
        llm: { provider, model },
        compressionLevel,
        isRerun
      },
      {
        onStarted: async (data) => {
          // File created on server - add to history immediately
          setState('currentFilename', data.filename);
          setState('processingFilename', data.filename);
          await loadHistory();
        },
        onChunk: (chunk) => {
          accumulated += chunk;
          lastSections = parsePartialJSON(accumulated);
          // Store streaming state so user can navigate away and back
          setState('streamingState', { accumulated, lastSections, title, basicInfo });
          throttledRender(lastSections, title, renderStreamingSections);
        },
        onComplete: async (data) => {
          setState('currentRequest', null);
          setState('processingFilename', null);
          setState('streamingState', null);
          setStreamingUI(false);
          // Flush final render before switching to markdown view
          flushRender(lastSections, title, renderStreamingSections);
          setState('currentMarkdown', data.markdown);
          setState('currentFilename', data.filename);
          renderMarkdown(data.markdown);
          // Update Signal pane with final data from completion event
          if (data.signal) {
            updateSignalPane(data.signal);
          }
          await loadHistory();
          resolve();
        },
        onError: (err) => {
          setState('currentRequest', null);
          setState('processingFilename', null);
          setState('streamingState', null);
          setStreamingUI(false);
          reject(err);
        }
      }
    );
    setState('currentRequest', streamController);
  });
}

/**
 * Restore streaming view when user navigates back to processing item
 */
function restoreStreamingView() {
  const streamingState = getState('streamingState');
  if (!streamingState) return false;

  const { lastSections, title } = streamingState;

  // Re-render the streaming sections
  showResultsView(null, title);
  updateSignalPane(null);
  setStreamingUI(true);
  renderStreamingSections(lastSections, title);

  return true;
}

// Register the callback so history.js can call it without circular import
setState('restoreStreamingViewFn', restoreStreamingView);

// Track if rerun is in progress to prevent duplicate requests
let isRerunning = false;

export async function handleRerunLLM() {
  // Debounce: prevent multiple simultaneous reruns
  if (isRerunning) {
    return;
  }

  const elements = getElements();
  const currentMetadata = getState('currentMetadata');

  if (!currentMetadata) {
    showToast('Cannot rerun: no video data available');
    return;
  }

  if (!currentMetadata.hasTranscript) {
    showToast('Cannot rerun: no transcript available');
    return;
  }

  const provider = elements.providerSelect.value;
  const model = elements.modelSelect.value;

  if (!provider || !model) {
    showToast('Please select an LLM provider and model first');
    return;
  }

  // Set debounce flag
  isRerunning = true;

  const compressionLevel = getState('compressionLevel');

  try {
    await processWithLLMStreaming(currentMetadata, {
      provider,
      model,
      compressionLevel,
      isRerun: true
    });
    showToast('Successfully reprocessed with LLM', 'success');
  } catch (err) {
    showToast(err.message);
  } finally {
    // Reset debounce flag
    isRerunning = false;
    setState('currentRequest', null);
    setStreamingUI(false);
  }
}
