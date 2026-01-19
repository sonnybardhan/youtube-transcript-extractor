/**
 * Extraction and LLM processing functions
 */
import { LLM_MODELS } from './config.js';
import { getElements } from './elements.js';
import { getState, setState } from './state.js';
import { setLoading, showToast } from './ui.js';
import { showResultsView, updateInfoPane, renderBasicContent } from './views.js';
import { renderMarkdown } from './markdown.js';
import { loadHistory } from './history.js';

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
      // Show loading spinner in center pane only (keeps transcript visible)
      setLoading(true, true);

      const llmResults = [];
      const llmErrors = [];
      const customPrompt = getState('customPrompt');
      const compressionLevel = getState('compressionLevel');

      // Process each URL with LLM sequentially
      for (const result of successfulBasic) {
        if (!result.data.hasTranscript) {
          llmErrors.push({ url: result.url, error: 'No transcript available' });
          continue;
        }

        try {
          const llmRes = await fetch('/api/extract/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              basicInfo: result.data,
              llm,
              customPrompt,
              compressionLevel
            })
          });

          const llmData = await llmRes.json();

          if (llmData.success) {
            llmResults.push(llmData);
          } else {
            llmErrors.push({ url: result.url, error: llmData.error });
          }
        } catch (err) {
          llmErrors.push({ url: result.url, error: err.message });
        }
      }

      if (llmErrors.length > 0) {
        const errorMsgs = llmErrors.map(e => `${e.url}: ${e.error}`).join('\n');
        showToast(errorMsgs);
      }

      if (llmResults.length > 0) {
        let markdown = llmResults[0].markdown;
        let filename = llmResults[0].filename;

        if (llmResults.length > 1) {
          markdown = llmResults.map(r => r.markdown).join('\n\n---\n\n');
          filename = null;
        }

        setState('currentMarkdown', markdown);
        setState('currentFilename', filename);

        // Store the model label for display
        const modelInfo = LLM_MODELS[provider]?.find(m => m.value === model);
        setState('currentModel', modelInfo?.label || model);

        renderMarkdown(markdown);
        await loadHistory();
      } else {
        // All LLM processing failed - show basic content
        setState('currentModel', null);
        renderBasicContent(successfulBasic.map(r => r.data));
      }

      setLoading(false, true);
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

export async function handleRerunLLM() {
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

  // Use results-only loading to keep transcript visible
  setLoading(true, true);

  try {
    const customPrompt = getState('customPrompt');
    const compressionLevel = getState('compressionLevel');

    const res = await fetch('/api/reprocess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: currentFilename,
        llm: { provider, model },
        customPrompt,
        compressionLevel
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Reprocessing failed');
    }

    setState('currentMarkdown', data.markdown);
    setState('currentFilename', data.filename);

    // Store the model label for display
    const modelInfo = LLM_MODELS[provider]?.find(m => m.value === model);
    setState('currentModel', modelInfo?.label || model);

    showResultsView(data.markdown, data.title);
    await loadHistory();
    showToast('Successfully reprocessed with LLM', 'success');
  } catch (err) {
    showToast(err.message);
  } finally {
    setLoading(false, true);
  }
}
