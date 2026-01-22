/**
 * Streaming parsing utilities using partial-json library
 */
import { parse as parsePartialJsonLib } from "partial-json";

/**
 * Parse partial JSON to extract completed sections
 * Uses partial-json library to handle incomplete JSON gracefully
 * @param {string} text - The accumulated text from streaming
 * @returns {object} - Object with extracted sections
 */
export function parsePartialJSON(text) {
  const sections = {};

  // Extract JSON object from text (handle markdown code blocks)
  let jsonText = text;
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/);
  if (codeBlockMatch) {
    jsonText = codeBlockMatch[1];
  }

  // Find the JSON object boundaries
  const startIdx = jsonText.indexOf("{");
  if (startIdx === -1) return sections;

  jsonText = jsonText.slice(startIdx);

  try {
    // Parse with partial-json - it handles incomplete JSON
    const parsed = parsePartialJsonLib(jsonText);

    if (!parsed || typeof parsed !== "object") return sections;

    // Extract completed fields
    if (parsed.tldr && typeof parsed.tldr === "string") {
      sections.tldr = parsed.tldr;
    }

    if (parsed.keyInsights && Array.isArray(parsed.keyInsights)) {
      const completed = parsed.keyInsights.filter((item) => typeof item === "string");
      if (completed.length > 0) {
        sections.keyInsights = completed;
        // Mark as partial if there might be more items coming
        if (!isArrayComplete(jsonText, "keyInsights")) {
          sections.keyInsightsPartial = true;
        }
      }
    }

    if (parsed.actionItems && Array.isArray(parsed.actionItems)) {
      const completed = parsed.actionItems.filter((item) => typeof item === "string");
      if (completed.length > 0) {
        sections.actionItems = completed;
        if (!isArrayComplete(jsonText, "actionItems")) {
          sections.actionItemsPartial = true;
        }
      }
    }

    if (parsed.concepts && Array.isArray(parsed.concepts)) {
      const completed = parsed.concepts.filter((item) => typeof item === "string");
      if (completed.length > 0) {
        sections.concepts = completed;
        if (!isArrayComplete(jsonText, "concepts")) {
          sections.conceptsPartial = true;
        }
      }
    }

    if (parsed.entities && Array.isArray(parsed.entities)) {
      const completed = parsed.entities.filter((item) => typeof item === "string");
      if (completed.length > 0) {
        sections.entities = completed;
        if (!isArrayComplete(jsonText, "entities")) {
          sections.entitiesPartial = true;
        }
      }
    }

    if (parsed.category && typeof parsed.category === "string") {
      sections.category = parsed.category;
    }

    if (parsed.suggestedTags && Array.isArray(parsed.suggestedTags)) {
      const completed = parsed.suggestedTags.filter((item) => typeof item === "string");
      if (completed.length > 0) {
        sections.suggestedTags = completed;
        if (!isArrayComplete(jsonText, "suggestedTags")) {
          sections.suggestedTagsPartial = true;
        }
      }
    }

    // Handle summary (or transcript for backwards compatibility)
    const summaryValue = parsed.summary || parsed.transcript;
    if (summaryValue && typeof summaryValue === "string") {
      // Check if summary is complete (string is closed)
      if (isStringComplete(jsonText, "summary") || isStringComplete(jsonText, "transcript")) {
        sections.summary = summaryValue;
      } else {
        sections.summaryPartial = summaryValue;
      }
    }
  } catch {
    // If partial-json fails, return empty sections
    // This can happen with severely malformed JSON
    return sections;
  }

  return sections;
}

/**
 * Check if an array field appears to be complete (has closing bracket)
 */
function isArrayComplete(text, fieldName) {
  // Find the field and check if its array is closed
  const fieldPattern = new RegExp(`"${fieldName}"\\s*:\\s*\\[`, "g");
  const match = fieldPattern.exec(text);
  if (!match) return false;

  // Count brackets from the array start
  let depth = 1;
  let inString = false;
  let escaped = false;

  for (let i = match.index + match[0].length; i < text.length; i++) {
    const char = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"' && !escaped) {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === "[") depth++;
      if (char === "]") {
        depth--;
        if (depth === 0) return true;
      }
    }
  }

  return false;
}

/**
 * Check if a string field appears to be complete (has closing quote)
 */
function isStringComplete(text, fieldName) {
  // Find the field and check if its string is closed
  const fieldPattern = new RegExp(`"${fieldName}"\\s*:\\s*"`, "g");
  const match = fieldPattern.exec(text);
  if (!match) return false;

  // Scan for the closing quote
  let escaped = false;

  for (let i = match.index + match[0].length; i < text.length; i++) {
    const char = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      return true;
    }
  }

  return false;
}

/**
 * Create throttled render state manager
 */
export function createThrottleManager(interval = 100) {
  let lastRenderedSections = null;
  let lastRenderTime = 0;
  let pendingRender = null;
  let trailingTimeoutId = null;

  return {
    throttledRender(sections, title, renderFn) {
      const sectionsKey = JSON.stringify(sections);
      if (sectionsKey === lastRenderedSections) return;

      const now = Date.now();
      const timeSinceLastRender = now - lastRenderTime;

      pendingRender = { sections, title, sectionsKey };

      if (timeSinceLastRender >= interval) {
        if (trailingTimeoutId) {
          clearTimeout(trailingTimeoutId);
          trailingTimeoutId = null;
        }
        lastRenderTime = now;
        lastRenderedSections = sectionsKey;
        renderFn(sections, title);
        pendingRender = null;
      } else if (!trailingTimeoutId) {
        const delay = interval - timeSinceLastRender;
        trailingTimeoutId = setTimeout(() => {
          trailingTimeoutId = null;
          if (pendingRender) {
            lastRenderTime = Date.now();
            lastRenderedSections = pendingRender.sectionsKey;
            renderFn(pendingRender.sections, pendingRender.title);
            pendingRender = null;
          }
        }, delay);
      }
    },

    flushRender(sections, title, renderFn) {
      if (trailingTimeoutId) {
        clearTimeout(trailingTimeoutId);
        trailingTimeoutId = null;
      }
      pendingRender = null;
      lastRenderedSections = JSON.stringify(sections);
      renderFn(sections, title);
    },

    reset() {
      lastRenderedSections = null;
      lastRenderTime = 0;
      if (trailingTimeoutId) {
        clearTimeout(trailingTimeoutId);
        trailingTimeoutId = null;
      }
      pendingRender = null;
    }
  };
}
