import { useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { saveAnnotation as apiSaveAnnotation, deleteAnnotation as apiDeleteAnnotation } from '../utils/api';

// Store abort controller outside component to persist across re-renders and page changes
let globalAbortController = null;

export function useAnnotation() {
  const { state, actions } = useApp();
  const { provider, model, currentFilename, signalData, pendingAnnotation } = state;

  const startAnnotation = useCallback(async (selectionData) => {
    if (!currentFilename) {
      actions.showToast('No file selected');
      return;
    }

    if (!provider || !model) {
      actions.showToast('Please select an LLM provider and model in the sidebar settings.');
      return;
    }

    // Cancel any existing stream
    if (globalAbortController) {
      globalAbortController.abort();
    }

    // Create new abort controller
    globalAbortController = new AbortController();

    const { selectedText, section, surroundingText } = selectionData;
    const category = signalData?.category || null;
    const concepts = signalData?.concepts || [];
    const question = 'Explain this in more detail.';

    // Set up the pending annotation
    const pending = {
      filename: currentFilename,
      selectedText,
      section,
      surroundingText,
      question,
      response: '',
      isStreaming: true,
      error: null,
      model: `${provider}/${model}`,
      category,
      concepts,
    };

    actions.setPendingAnnotation(pending);

    // Expand info pane and switch to annotations tab
    actions.setInfoPaneCollapsed(false);
    actions.setActiveInfoTab('annotations');

    try {
      const response = await fetch('/api/annotations/ask/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedText,
          section,
          surroundingText,
          category,
          concepts,
          question,
          llm: { provider, model },
        }),
        signal: globalAbortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);

              if (parsed.error) {
                actions.updatePendingAnnotation({
                  error: parsed.error,
                  isStreaming: false,
                });
                globalAbortController = null;
                return;
              }

              if (parsed.complete) {
                fullResponse = parsed.response || fullResponse;
                actions.updatePendingAnnotation({
                  response: fullResponse,
                  isStreaming: false,
                });
                globalAbortController = null;
                return fullResponse;
              }

              if (parsed.chunk) {
                fullResponse += parsed.chunk;
                actions.updatePendingAnnotation({ response: fullResponse });
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }

      actions.updatePendingAnnotation({ isStreaming: false });
      globalAbortController = null;
      return fullResponse;
    } catch (err) {
      if (err.name === 'AbortError') {
        actions.updatePendingAnnotation({
          error: 'Cancelled',
          isStreaming: false,
        });
      } else {
        actions.updatePendingAnnotation({
          error: err.message,
          isStreaming: false,
        });
      }
      globalAbortController = null;
      return null;
    }
  }, [currentFilename, provider, model, signalData, actions]);

  const cancelStream = useCallback(() => {
    if (globalAbortController) {
      globalAbortController.abort();
      globalAbortController = null;
    }
  }, []);

  const savePendingAnnotation = useCallback(async () => {
    if (!pendingAnnotation || !pendingAnnotation.response || pendingAnnotation.isStreaming) {
      return;
    }

    const annotation = {
      id: crypto.randomUUID(),
      selectedText: pendingAnnotation.selectedText,
      section: pendingAnnotation.section,
      surroundingText: pendingAnnotation.surroundingText,
      question: pendingAnnotation.question,
      response: pendingAnnotation.response,
      model: pendingAnnotation.model,
      timestamp: new Date().toISOString(),
    };

    try {
      await apiSaveAnnotation(pendingAnnotation.filename, annotation);

      // Only add to current annotations if we're still viewing the same file
      if (currentFilename === pendingAnnotation.filename) {
        actions.addAnnotation(annotation);
      }

      actions.clearPendingAnnotation();
      actions.showToast('Annotation saved', 'success');
      return annotation;
    } catch (err) {
      actions.showToast(err.message);
      throw err;
    }
  }, [pendingAnnotation, currentFilename, actions]);

  const discardPendingAnnotation = useCallback(() => {
    cancelStream();
    actions.clearPendingAnnotation();
  }, [cancelStream, actions]);

  const deleteAnnotation = useCallback(async (annotationId) => {
    if (!currentFilename) {
      throw new Error('No file selected');
    }

    await apiDeleteAnnotation(currentFilename, annotationId);
    actions.deleteAnnotation(annotationId);
  }, [currentFilename, actions]);

  return {
    pendingAnnotation,
    startAnnotation,
    cancelStream,
    savePendingAnnotation,
    discardPendingAnnotation,
    deleteAnnotation,
  };
}
