/**
 * General utility functions
 */

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function truncate(str, length) {
  if (!str) return '';
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
}

export function formatDate(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Calculate reading time based on word count
 * @param {string} content - Text content
 * @returns {string} - Reading time string
 */
export function calculateReadingTime(content) {
  const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 200));
  return readingMinutes === 1 ? '1 min read' : `${readingMinutes} min read`;
}

/**
 * Parse inline markdown using marked library
 */
export function parseInlineMarkdown(text) {
  if (typeof window !== 'undefined' && window.marked?.parseInline) {
    return window.marked.parseInline(text);
  }
  // Fallback: escape HTML entities
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
