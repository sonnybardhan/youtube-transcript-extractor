/**
 * Incremental JSON parsing for streaming LLM output
 * Extracts completed sections from partial JSON as it streams in
 */

// Throttled rendering state
let lastRenderedSections = null;
let renderTimeout = null;
const RENDER_INTERVAL = 150; // ms between renders

/**
 * Throttled render to prevent flickering during streaming
 * Only renders every RENDER_INTERVAL ms and when sections actually change
 * @param {object} sections - Parsed sections from streaming
 * @param {string} title - Video title
 * @param {function} renderFn - The render function to call
 */
export function throttledRender(sections, title, renderFn) {
  const sectionsKey = JSON.stringify(sections);
  if (sectionsKey === lastRenderedSections) return;

  if (renderTimeout) clearTimeout(renderTimeout);

  renderTimeout = setTimeout(() => {
    lastRenderedSections = sectionsKey;
    renderFn(sections, title);
  }, RENDER_INTERVAL);
}

/**
 * Flush any pending render immediately (call on stream complete)
 * @param {object} sections - Final sections to render
 * @param {string} title - Video title
 * @param {function} renderFn - The render function to call
 */
export function flushRender(sections, title, renderFn) {
  if (renderTimeout) {
    clearTimeout(renderTimeout);
    renderTimeout = null;
  }
  lastRenderedSections = JSON.stringify(sections);
  renderFn(sections, title);
}

/**
 * Reset the throttle state (call when starting a new stream)
 */
export function resetThrottleState() {
  lastRenderedSections = null;
  if (renderTimeout) {
    clearTimeout(renderTimeout);
    renderTimeout = null;
  }
}

/**
 * Parse partial JSON to extract completed sections
 * @param {string} text - The accumulated text from streaming
 * @returns {object} - Object with extracted sections: { tldr, keyInsights, actionItems, transcript }
 */
export function parsePartialJSON(text) {
  const sections = {};

  // Try to extract TLDR if complete
  const tldrMatch = text.match(/"tldr"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (tldrMatch) {
    sections.tldr = unescapeJsonString(tldrMatch[1]);
  }

  // Try to extract keyInsights array if complete
  const insightsMatch = text.match(/"keyInsights"\s*:\s*\[([\s\S]*?)\]/);
  if (insightsMatch) {
    try {
      const insightsArray = JSON.parse('[' + insightsMatch[1] + ']');
      if (Array.isArray(insightsArray) && insightsArray.length > 0) {
        sections.keyInsights = insightsArray;
      }
    } catch {
      // Array not yet complete, try to extract individual items
      const partialInsights = extractPartialArray(insightsMatch[1]);
      if (partialInsights.length > 0) {
        sections.keyInsights = partialInsights;
        sections.keyInsightsPartial = true;
      }
    }
  }

  // Try to extract actionItems array if complete
  const actionsMatch = text.match(/"actionItems"\s*:\s*\[([\s\S]*?)\]/);
  if (actionsMatch) {
    try {
      const actionsArray = JSON.parse('[' + actionsMatch[1] + ']');
      if (Array.isArray(actionsArray) && actionsArray.length > 0) {
        sections.actionItems = actionsArray;
      }
    } catch {
      // Array not yet complete
      const partialActions = extractPartialArray(actionsMatch[1]);
      if (partialActions.length > 0) {
        sections.actionItems = partialActions;
        sections.actionItemsPartial = true;
      }
    }
  }

  // Try to extract transcript (this is usually the longest field)
  const transcriptMatch = text.match(/"transcript"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (transcriptMatch) {
    sections.transcript = unescapeJsonString(transcriptMatch[1]);
  } else {
    // Check if transcript has started but not completed
    const transcriptStartMatch = text.match(/"transcript"\s*:\s*"((?:[^"\\]|\\.)*)/);
    if (transcriptStartMatch) {
      sections.transcriptPartial = unescapeJsonString(transcriptStartMatch[1]);
    }
  }

  return sections;
}

/**
 * Extract complete string items from a partial array
 * @param {string} arrayContent - Content between [ and ] or partial content
 * @returns {string[]} - Array of complete string items
 */
function extractPartialArray(arrayContent) {
  const items = [];
  const regex = /"((?:[^"\\]|\\.)*)"/g;
  let match;

  while ((match = regex.exec(arrayContent)) !== null) {
    items.push(unescapeJsonString(match[1]));
  }

  return items;
}

/**
 * Unescape JSON string escape sequences
 * @param {string} str - Escaped JSON string content
 * @returns {string} - Unescaped string
 */
function unescapeJsonString(str) {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

/**
 * Create an EventSource-like handler for fetch with streaming
 * Since EventSource only supports GET, we use fetch with ReadableStream for POST
 * @param {string} url - The endpoint URL
 * @param {object} body - The request body
 * @param {object} handlers - { onChunk, onComplete, onError }
 * @returns {object} - Controller with abort method
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
