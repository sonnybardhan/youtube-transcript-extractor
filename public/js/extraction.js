/**
 * Extraction and LLM processing functions
 */
import { LLM_MODELS } from './config.js';
import { getElements } from './elements.js';
import { getState, setState } from './state.js';
import { setLoading, showToast } from './ui.js';
import { showResultsView, showInputView, updateInfoPane, renderBasicContent, renderStreamingSections } from './views.js';
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
        // Use streaming for LLM processing
        let accumulated = '';
        let lastSections = {};

        // Store the model label for display
        const modelInfo = LLM_MODELS[provider]?.find(m => m.value === model);
        setState('currentModel', modelInfo?.label || model);

        // Reset throttle state before starting new stream
        resetThrottleState();
        setStreamingUI(true);

        await new Promise((resolve, reject) => {
          const streamController = createStreamingRequest(
            '/api/extract/process/stream',
            {
              basicInfo: result.data,
              llm,
              compressionLevel
            },
            {
              onChunk: (chunk) => {
                accumulated += chunk;
                lastSections = parsePartialJSON(accumulated);
                throttledRender(lastSections, result.data.title, renderStreamingSections);
              },
              onComplete: async (data) => {
                setState('currentRequest', null);
                setStreamingUI(false);
                // Flush final render before switching to markdown view
                flushRender(lastSections, result.data.title, renderStreamingSections);
                setState('currentMarkdown', data.markdown);
                setState('currentFilename', data.filename);
                renderMarkdown(data.markdown);
                await loadHistory();
                resolve();
              },
              onError: (err) => {
                setState('currentRequest', null);
                setStreamingUI(false);
                llmErrors.push({ url: result.url, error: err.message });
                setState('currentModel', null);
                renderBasicContent(successfulBasic.map(r => r.data));
                reject(err);
              }
            }
          );
          setState('currentRequest', streamController);
        }).catch(() => {});

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

// Track if rerun is in progress to prevent duplicate requests
let isRerunning = false;

export async function handleRerunLLM() {
  // Debounce: prevent multiple simultaneous reruns
  if (isRerunning) {
    return;
  }

  const elements = getElements();
  const currentFilename = getState('currentFilename');

  if (!currentFilename) {
    showToast('Cannot rerun: no file selected');
    return;
  }

  const provider = elements.providerSelect.value;
  const model = elements.modelSelect.value;

  if (!provider || !model) {
    showToast('Please select an LLM provider and model first');
    return;
  }

  // Set debounce flag and disable button
  isRerunning = true;
  elements.rerunLlmBtn.disabled = true;

  const compressionLevel = getState('compressionLevel');

  // Store the model label for display
  const modelInfo = LLM_MODELS[provider]?.find(m => m.value === model);
  setState('currentModel', modelInfo?.label || model);

  // Get the current title from the markdown
  const currentMarkdown = getState('currentMarkdown');
  const titleMatch = currentMarkdown?.match(/^#\s+(.+)$/m);
  const currentTitle = titleMatch ? titleMatch[1] : currentFilename.replace('.md', '');

  // Show loading skeleton view (like a fresh extraction)
  showResultsView(null, currentTitle);

  let accumulated = '';
  let lastSections = {};

  // Reset throttle state before starting new stream
  resetThrottleState();
  setStreamingUI(true);

  try {
    await new Promise((resolve, reject) => {
      const streamController = createStreamingRequest(
        '/api/reprocess/stream',
        {
          filename: currentFilename,
          llm: { provider, model },
          compressionLevel
        },
        {
          onChunk: (chunk) => {
            accumulated += chunk;
            lastSections = parsePartialJSON(accumulated);
            throttledRender(lastSections, currentTitle, renderStreamingSections);
          },
          onComplete: async (data) => {
            setState('currentRequest', null);
            setStreamingUI(false);
            // Flush final render before switching to markdown view
            flushRender(lastSections, currentTitle, renderStreamingSections);
            setState('currentMarkdown', data.markdown);
            setState('currentFilename', data.filename);
            showResultsView(data.markdown, data.title);
            await loadHistory();
            showToast('Successfully reprocessed with LLM', 'success');
            resolve();
          },
          onError: (err) => {
            setState('currentRequest', null);
            setStreamingUI(false);
            reject(err);
          }
        }
      );
      setState('currentRequest', streamController);
    });
  } catch (err) {
    showToast(err.message);
  } finally {
    // Reset debounce flag and re-enable button
    isRerunning = false;
    setState('currentRequest', null);
    setStreamingUI(false);
  }
}
