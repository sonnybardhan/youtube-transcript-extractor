/**
 * API interaction functions
 */

export async function fetchConfig() {
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error('Failed to load config');
  return res.json();
}

export async function fetchPrompt() {
  const res = await fetch('/api/prompt');
  if (!res.ok) throw new Error('Failed to load prompt');
  return res.json();
}

export async function savePrompt(prompt) {
  const res = await fetch('/api/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });
  if (!res.ok) throw new Error('Failed to save prompt');
  return res.json();
}

export async function deletePrompt() {
  const res = await fetch('/api/prompt', { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete prompt');
  return res.json();
}

export async function fetchHistory() {
  const res = await fetch('/api/history');
  if (!res.ok) throw new Error('Failed to load history');
  return res.json();
}

export async function fetchHistoryItem(filename) {
  const res = await fetch(`/api/history/${encodeURIComponent(filename)}`);
  if (!res.ok) throw new Error('Failed to load file');
  return res.json();
}

export async function deleteHistoryItem(filename) {
  const res = await fetch(`/api/history/${encodeURIComponent(filename)}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to delete file');
  return res.json();
}

export async function extractBasic(url) {
  const res = await fetch('/api/extract/basic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  return res.json();
}

export async function extractWithLLM(basicInfo, llm, compressionLevel, isRerun = false) {
  const res = await fetch('/api/extract/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ basicInfo, llm, compressionLevel, isRerun })
  });
  return res.json();
}

/**
 * Annotation API functions
 */
export async function fetchAnnotations(filename) {
  const res = await fetch(`/api/history/${encodeURIComponent(filename)}/annotations`);
  if (!res.ok) {
    if (res.status === 404) return []; // No annotations file yet
    throw new Error('Failed to load annotations');
  }
  return res.json();
}

export async function saveAnnotation(filename, annotation) {
  const res = await fetch(`/api/history/${encodeURIComponent(filename)}/annotations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(annotation)
  });
  if (!res.ok) throw new Error('Failed to save annotation');
  return res.json();
}

export async function deleteAnnotation(filename, annotationId) {
  const res = await fetch(
    `/api/history/${encodeURIComponent(filename)}/annotations/${encodeURIComponent(annotationId)}`,
    { method: 'DELETE' }
  );
  if (!res.ok) throw new Error('Failed to delete annotation');
  return res.json();
}

/**
 * Create a streaming request for LLM processing
 */
export function createStreamingRequest(url, body, handlers) {
  const controller = new AbortController();

  const fetchPromise = fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  fetchPromise
    .then(async (response) => {
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

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
                handlers.onError?.(new Error(parsed.error));
                return;
              }

              if (parsed.complete) {
                handlers.onComplete?.(parsed);
                return;
              }

              if (parsed.processing && parsed.filename) {
                handlers.onStarted?.(parsed);
              }

              if (parsed.chunk) {
                handlers.onChunk?.(parsed.chunk);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        handlers.onError?.(err);
      }
    });

  return {
    abort: () => controller.abort(),
  };
}
