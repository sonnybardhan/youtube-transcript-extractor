import { useState, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { saveAnnotation as apiSaveAnnotation, deleteAnnotation as apiDeleteAnnotation } from '../utils/api';

export function useAnnotation() {
  const { state, actions } = useApp();
  const { provider, model, currentFilename, signalData, annotationModalData } = state;
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedResponse, setStreamedResponse] = useState('');
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const askLLM = useCallback(async (question) => {
    if (!annotationModalData || !currentFilename) {
      setError('No selection data available');
      return;
    }

    // Reset state
    setIsStreaming(true);
    setStreamedResponse('');
    setError(null);

    // Create abort controller
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/annotations/ask/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedText: annotationModalData.selectedText,
          section: annotationModalData.section,
          surroundingText: annotationModalData.surroundingText,
          category: signalData?.category || annotationModalData.category,
          question,
          llm: { provider, model },
        }),
        signal: abortControllerRef.current.signal,
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
                setError(parsed.error);
                setIsStreaming(false);
                return;
              }

              if (parsed.complete) {
                fullResponse = parsed.response || fullResponse;
                setStreamedResponse(fullResponse);
                setIsStreaming(false);
                return fullResponse;
              }

              if (parsed.chunk) {
                fullResponse += parsed.chunk;
                setStreamedResponse(fullResponse);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }

      setIsStreaming(false);
      return fullResponse;
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Request cancelled');
      } else {
        setError(err.message);
      }
      setIsStreaming(false);
      return null;
    }
  }, [annotationModalData, currentFilename, provider, model, signalData]);

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const saveAnnotation = useCallback(async (question, response) => {
    if (!currentFilename || !annotationModalData) {
      throw new Error('Missing required data');
    }

    const annotation = {
      id: crypto.randomUUID(),
      selectedText: annotationModalData.selectedText,
      section: annotationModalData.section,
      surroundingText: annotationModalData.surroundingText,
      question,
      response,
      model: `${provider}/${model}`,
      timestamp: new Date().toISOString(),
    };

    await apiSaveAnnotation(currentFilename, annotation);
    actions.addAnnotation(annotation);

    // Auto-switch to annotations tab after saving
    actions.setActiveInfoTab('annotations');

    return annotation;
  }, [currentFilename, annotationModalData, provider, model, actions]);

  const deleteAnnotation = useCallback(async (annotationId) => {
    if (!currentFilename) {
      throw new Error('No file selected');
    }

    await apiDeleteAnnotation(currentFilename, annotationId);
    actions.deleteAnnotation(annotationId);
  }, [currentFilename, actions]);

  const closeModal = useCallback(() => {
    cancelStream();
    setStreamedResponse('');
    setError(null);
    actions.setAnnotationModal(false, null);
  }, [cancelStream, actions]);

  return {
    isStreaming,
    streamedResponse,
    error,
    askLLM,
    cancelStream,
    saveAnnotation,
    deleteAnnotation,
    closeModal,
    annotationModalData,
  };
}
