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
 * Metadata Streamliner API functions
 */
export async function fetchMetadataStats() {
  const res = await fetch('/api/metadata/stats');
  if (!res.ok) throw new Error('Failed to load metadata stats');
  return res.json();
}

export async function fetchMetadataPreview(files = []) {
  const params = files.length > 0 ? `?files=${encodeURIComponent(JSON.stringify(files))}` : '';
  const res = await fetch(`/api/metadata/preview${params}`);
  if (!res.ok) throw new Error('Failed to load metadata preview');
  return res.json();
}

/**
 * Metadata Index API functions
 */
export async function fetchMetadataIndex() {
  const res = await fetch('/api/metadata/index');
  if (!res.ok) throw new Error('Failed to load metadata index');
  return res.json();
}

export async function rebuildMetadataIndex() {
  const res = await fetch('/api/metadata/index/rebuild', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to rebuild metadata index');
  return res.json();
}

export async function fetchRelatedVideos(filename, limit = 5) {
  const res = await fetch(`/api/metadata/related/${encodeURIComponent(filename)}?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to load related videos');
  return res.json();
}

/**
 * Fetch graph data for network visualization
 * @param {Object} options - Query options
 * @param {string} options.center - Optional filename to center the graph on
 * @param {number} options.limit - Maximum number of nodes (default: 100)
 * @param {number} options.minScore - Minimum connection score (default: 2)
 */
export async function fetchGraphData(options = {}) {
  const params = new URLSearchParams();
  if (options.center) params.set('center', options.center);
  if (options.limit) params.set('limit', options.limit.toString());
  if (options.minScore) params.set('minScore', options.minScore.toString());

  const queryString = params.toString();
  const url = `/api/metadata/graph${queryString ? `?${queryString}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load graph data');
  return res.json();
}

export async function applyMetadataChanges(proposedChanges) {
  const res = await fetch('/api/metadata/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proposedChanges })
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to apply changes');
  }
  return res.json();
}

/**
 * Create a streaming request for applying metadata changes with progress
 */
export function createApplyStream(proposedChanges, handlers) {
  const controller = new AbortController();

  const fetchPromise = fetch('/api/metadata/apply/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ proposedChanges }),
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

              if (parsed.type === 'error') {
                handlers.onError?.(new Error(parsed.error));
                return;
              }

              if (parsed.type === 'complete') {
                handlers.onComplete?.(parsed.result);
                return;
              }

              if (parsed.type === 'progress') {
                handlers.onProgress?.({
                  current: parsed.current,
                  total: parsed.total,
                  currentFile: parsed.file,
                });
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

/**
 * Create a streaming request for metadata analysis
 */
export function createMetadataAnalysisStream(llm, handlers) {
  const controller = new AbortController();

  const fetchPromise = fetch('/api/metadata/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ llm }),
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

              if (parsed.type === 'error') {
                handlers.onError?.(new Error(parsed.error));
                return;
              }

              if (parsed.type === 'complete') {
                handlers.onComplete?.(parsed.proposedChanges);
                return;
              }

              if (parsed.type === 'fieldComplete') {
                handlers.onFieldComplete?.(parsed);
              }

              if (parsed.type === 'analyzing' || parsed.type === 'collecting') {
                handlers.onProgress?.(parsed);
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

/**
 * Multi-Summary Analysis API functions
 */

/**
 * Create a streaming request for multi-summary analysis
 */
export function createSummaryAnalysisStream(filenames, promptType, customPrompt, llm, handlers) {
  const controller = new AbortController();

  const fetchPromise = fetch('/api/summaries/analyze/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filenames, promptType, customPrompt, llm }),
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
                handlers.onComplete?.(parsed.response);
                return;
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

/**
 * Save analysis result as a new file
 */
export async function saveAnalysisResult(content, title, sourceFilenames = []) {
  const res = await fetch('/api/summaries/analyze/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, title, sourceFilenames })
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to save analysis');
  }
  return res.json();
}

/**
 * Fetch saved analyses (separate from history)
 */
export async function fetchSavedAnalyses() {
  const res = await fetch('/api/analyses');
  if (!res.ok) {
    // Return empty array if endpoint not available (server needs restart)
    if (res.status === 404) return [];
    throw new Error('Failed to load saved analyses');
  }
  return res.json();
}

/**
 * Fetch a single analysis with source info
 */
export async function fetchAnalysis(filename) {
  const res = await fetch(`/api/analyses/${encodeURIComponent(filename)}`);
  if (!res.ok) throw new Error('Failed to load analysis');
  return res.json();
}

/**
 * Delete an analysis file
 */
export async function deleteAnalysisFile(filename) {
  const res = await fetch(`/api/analyses/${encodeURIComponent(filename)}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to delete analysis');
  return res.json();
}

/**
 * Get available analysis prompt types
 */
export async function fetchAnalysisPrompts() {
  const res = await fetch('/api/summaries/analyze/prompts');
  if (!res.ok) throw new Error('Failed to load analysis prompts');
  return res.json();
}
