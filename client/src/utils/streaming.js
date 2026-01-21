/**
 * Streaming parsing utilities
 */

/**
 * Parse partial JSON to extract completed sections
 * @param {string} text - The accumulated text from streaming
 * @returns {object} - Object with extracted sections
 */
export function parsePartialJSON(text) {
  const sections = {};

  // Try to extract TLDR if complete
  const tldrMatch = text.match(/"tldr"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (tldrMatch) {
    sections.tldr = unescapeJsonString(tldrMatch[1]);
  }

  // Try to extract keyInsights array - complete or partial
  const insightsCompleteMatch = text.match(/"keyInsights"\s*:\s*\[([\s\S]*?)\]/);
  if (insightsCompleteMatch) {
    try {
      const insightsArray = JSON.parse('[' + insightsCompleteMatch[1] + ']');
      if (Array.isArray(insightsArray) && insightsArray.length > 0) {
        sections.keyInsights = insightsArray;
      }
    } catch {
      const partialInsights = extractPartialArray(insightsCompleteMatch[1]);
      if (partialInsights.length > 0) {
        sections.keyInsights = partialInsights;
        sections.keyInsightsPartial = true;
      }
    }
  } else {
    const insightsPartialMatch = text.match(/"keyInsights"\s*:\s*\[([\s\S]*)/);
    if (insightsPartialMatch) {
      const partialInsights = extractPartialArray(insightsPartialMatch[1]);
      if (partialInsights.length > 0) {
        sections.keyInsights = partialInsights;
        sections.keyInsightsPartial = true;
      }
    }
  }

  // Try to extract actionItems array - complete or partial
  const actionsCompleteMatch = text.match(/"actionItems"\s*:\s*\[([\s\S]*?)\]/);
  if (actionsCompleteMatch) {
    try {
      const actionsArray = JSON.parse('[' + actionsCompleteMatch[1] + ']');
      if (Array.isArray(actionsArray) && actionsArray.length > 0) {
        sections.actionItems = actionsArray;
      }
    } catch {
      const partialActions = extractPartialArray(actionsCompleteMatch[1]);
      if (partialActions.length > 0) {
        sections.actionItems = partialActions;
        sections.actionItemsPartial = true;
      }
    }
  } else {
    const actionsPartialMatch = text.match(/"actionItems"\s*:\s*\[([\s\S]*)/);
    if (actionsPartialMatch) {
      const partialActions = extractPartialArray(actionsPartialMatch[1]);
      if (partialActions.length > 0) {
        sections.actionItems = partialActions;
        sections.actionItemsPartial = true;
      }
    }
  }

  // Try to extract concepts array
  const conceptsMatch = text.match(/"concepts"\s*:\s*\[([\s\S]*?)\]/);
  if (conceptsMatch) {
    try {
      const conceptsArray = JSON.parse('[' + conceptsMatch[1] + ']');
      if (Array.isArray(conceptsArray) && conceptsArray.length > 0) {
        sections.concepts = conceptsArray;
      }
    } catch {
      const partialConcepts = extractPartialArray(conceptsMatch[1]);
      if (partialConcepts.length > 0) {
        sections.concepts = partialConcepts;
        sections.conceptsPartial = true;
      }
    }
  }

  // Try to extract entities array
  const entitiesMatch = text.match(/"entities"\s*:\s*\[([\s\S]*?)\]/);
  if (entitiesMatch) {
    try {
      const entitiesArray = JSON.parse('[' + entitiesMatch[1] + ']');
      if (Array.isArray(entitiesArray) && entitiesArray.length > 0) {
        sections.entities = entitiesArray;
      }
    } catch {
      const partialEntities = extractPartialArray(entitiesMatch[1]);
      if (partialEntities.length > 0) {
        sections.entities = partialEntities;
        sections.entitiesPartial = true;
      }
    }
  }

  // Try to extract category (single string)
  const categoryMatch = text.match(/"category"\s*:\s*"([^"]+)"/);
  if (categoryMatch) {
    sections.category = categoryMatch[1];
  }

  // Try to extract suggestedTags array
  const tagsMatch = text.match(/"suggestedTags"\s*:\s*\[([\s\S]*?)\]/);
  if (tagsMatch) {
    try {
      const tagsArray = JSON.parse('[' + tagsMatch[1] + ']');
      if (Array.isArray(tagsArray) && tagsArray.length > 0) {
        sections.suggestedTags = tagsArray;
      }
    } catch {
      const partialTags = extractPartialArray(tagsMatch[1]);
      if (partialTags.length > 0) {
        sections.suggestedTags = partialTags;
        sections.suggestedTagsPartial = true;
      }
    }
  }

  // Try to extract summary (or transcript for backwards compatibility)
  const summaryMatch = text.match(/"(?:summary|transcript)"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (summaryMatch) {
    sections.summary = unescapeJsonString(summaryMatch[1]);
  } else {
    const summaryStartMatch = text.match(/"(?:summary|transcript)"\s*:\s*"((?:[^"\\]|\\.)*)/);
    if (summaryStartMatch) {
      sections.summaryPartial = unescapeJsonString(summaryStartMatch[1]);
    }
  }

  return sections;
}

/**
 * Extract complete string items from a partial array
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
