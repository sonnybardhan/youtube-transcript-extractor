/**
 * Markdown rendering utilities
 */
import { escapeHtml, calculateReadingTime, parseInlineMarkdown } from './helpers';

/**
 * Parse markdown content and extract metadata
 * @param {string} content - Raw markdown content
 * @param {object} existingMetadata - Existing metadata to merge with
 * @returns {object} - { html, metadata, originalTranscript }
 */
export function parseMarkdownContent(content, existingMetadata = {}) {
  let processedContent = content;
  let originalTranscript = '';
  let metadata = { ...existingMetadata };

  // Remove LLM Prompt Used section (legacy)
  processedContent = processedContent.replace(
    /<details>\s*<summary>LLM Prompt Used<\/summary>[\s\S]*?<\/details>\s*/i,
    ''
  );

  // Extract original transcript from <details> section
  const detailsMatch = processedContent.match(
    /<details>\s*<summary>Original Transcript<\/summary>([\s\S]*?)<\/details>/i
  );
  if (detailsMatch) {
    originalTranscript = detailsMatch[1].trim();
    processedContent = processedContent.replace(
      /<details>\s*<summary>Original Transcript<\/summary>[\s\S]*?<\/details>/i,
      ''
    );
  }

  // Extract metadata section
  const metadataMatch = processedContent.match(/## Metadata\n\n([\s\S]*?)(?=\n## |$)/);
  if (metadataMatch) {
    const parsedMetadata = parseMetadataSection(metadataMatch[1]);
    metadata = {
      ...parsedMetadata,
      transcript: metadata.transcript || originalTranscript,
      transcriptFormatted: metadata.transcriptFormatted || originalTranscript,
      hasTranscript: metadata.hasTranscript ?? !!originalTranscript,
      title: metadata.title || parsedMetadata.title
    };
    processedContent = processedContent.replace(/## Metadata\n\n[\s\S]*?(?=\n## |$)/, '');
  }

  // Extract description section
  const descMatch = processedContent.match(/## Description\n\n([\s\S]*?)(?=\n## |$)/);
  if (descMatch) {
    metadata.description = descMatch[1].trim();
    processedContent = processedContent.replace(/## Description\n\n[\s\S]*?(?=\n## |$)/, '');
  }

  // Handle empty sections
  processedContent = processedContent.replace(/## Key Insights\n\n(?=## |$)/g, '## Key Insights\n\nn/a\n\n');
  processedContent = processedContent.replace(/## Action Items & Takeaways\n\n(?=## |$)/g, '## Action Items & Takeaways\n\nn/a\n\n');

  // Remove other truly empty sections
  processedContent = processedContent.replace(/^## (?!Transcript|Summary|Key Insights|Action Items)[^\n]+\n+(?=## |$)/gm, '');

  return {
    content: processedContent,
    metadata,
    originalTranscript
  };
}

/**
 * Parse metadata section text into object
 */
function parseMetadataSection(metadataText) {
  const metadata = {};
  const lines = metadataText.split('\n');

  lines.forEach(line => {
    const match = line.match(/^-\s+\*\*([^:]+):\*\*\s*(.+)$/);
    if (match) {
      const key = match[1].toLowerCase().trim();
      metadata[key] = match[2].trim();
    }
  });

  return metadata;
}

/**
 * Render markdown to HTML with collapsible sections
 * @param {string} content - Processed markdown content
 * @param {string} currentModel - Current LLM model name
 * @returns {string} - HTML string
 */
export function renderMarkdownToHTML(content, currentModel = null) {
  if (!window.marked) {
    console.warn('marked library not loaded');
    return `<pre>${escapeHtml(content)}</pre>`;
  }

  // Calculate reading time
  const readingTimeText = calculateReadingTime(content);
  const metaParts = [readingTimeText];
  if (currentModel) {
    metaParts.push(`summarized by ${currentModel}`);
  }
  const metaText = metaParts.join(' · ');

  // Parse markdown
  let html = window.marked.parse(content);

  // Insert reading time after h1 title
  html = html.replace(/(<\/h1>)/, `$1<p class="reading-time">${escapeHtml(metaText)}</p>`);

  // Make all links open in new tabs
  html = html.replace(/<a\s+href=/g, '<a target="_blank" rel="noopener noreferrer" href=');

  // Make sections collapsible
  html = makeCollapsibleSections(html);

  return html;
}

/**
 * Make h2 sections collapsible
 */
function makeCollapsibleSections(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const container = doc.body.firstChild;

  const result = [];
  let currentSection = null;
  let currentContent = [];

  const nonCollapsibleSections = ['tldr', 'keyinsights', 'actionitems', 'metadata', 'description', 'transcript', 'summary'];

  function hasContent(contentArray) {
    const combined = contentArray.join('').trim();
    const stripped = combined.replace(/<hr\s*\/?>/gi, '').replace(/<[^>]*>/g, '').trim();
    return stripped.length > 0;
  }

  function addSection() {
    if (!currentSection) return;

    const sectionTitle = currentSection.textContent.toLowerCase().replace(/[^a-z]/g, '');
    const isCollapsible = !nonCollapsibleSections.some(s => sectionTitle.includes(s));
    const contentExists = hasContent(currentContent);

    if (!contentExists && isCollapsible) return;

    if (isCollapsible && contentExists) {
      result.push(wrapInCollapsible(currentSection.outerHTML, currentContent.join('')));
    } else {
      result.push(currentSection.outerHTML);
      if (contentExists) {
        result.push(currentContent.join(''));
      }
    }
  }

  Array.from(container.childNodes).forEach(node => {
    if (node.nodeName === 'H2') {
      addSection();
      currentSection = node;
      currentContent = [];
    } else {
      if (currentSection) {
        currentContent.push(node.outerHTML || node.textContent);
      } else {
        result.push(node.outerHTML || node.textContent);
      }
    }
  });

  addSection();
  return result.join('');
}

/**
 * Wrap content in collapsible section
 */
function wrapInCollapsible(headerHtml, contentHtml) {
  const titleMatch = headerHtml.match(/<h2[^>]*>(.*?)<\/h2>/i);
  const title = titleMatch ? titleMatch[1] : 'Section';

  return `
    <div class="collapsible-section">
      <div class="collapsible-section-header">
        <h2>${title}</h2>
        <span class="collapse-icon">
          <span class="material-symbols-outlined">expand_more</span>
        </span>
      </div>
      <div class="collapsible-section-content">
        ${contentHtml}
      </div>
    </div>
  `;
}

/**
 * Parse Knowledge Graph section from markdown content
 * @param {string} markdown - The markdown content
 * @returns {object|null} - Parsed metadata or null if not found
 */
export function parseKnowledgeGraph(markdown) {
  const kgMatch = markdown.match(/## Knowledge Graph\n\n([\s\S]*?)(?=\n## |$)/);
  if (!kgMatch) return null;

  const kgSection = kgMatch[1];
  const metadata = {};

  const categoryMatch = kgSection.match(/\*\*Category:\*\*\s*(.+)/);
  if (categoryMatch) {
    metadata.category = categoryMatch[1].trim();
  }

  const conceptsMatch = kgSection.match(/\*\*Concepts:\*\*\s*(.+)/);
  if (conceptsMatch) {
    metadata.concepts = conceptsMatch[1].split(',').map(c => c.trim()).filter(c => c);
  }

  const entitiesMatch = kgSection.match(/\*\*Entities:\*\*\s*(.+)/);
  if (entitiesMatch) {
    metadata.entities = entitiesMatch[1].split(',').map(e => e.trim()).filter(e => e);
  }

  const tagsMatch = kgSection.match(/\*\*Tags:\*\*\s*(.+)/);
  if (tagsMatch) {
    metadata.suggestedTags = tagsMatch[1].split(',').map(t => t.trim()).filter(t => t);
  }

  return metadata;
}

/**
 * Parse metadata from markdown content for reprocessing
 */
export function parseMetadataForRerun(markdown, title) {
  const metadata = { title, hasTranscript: false };

  const detailsMatch = markdown.match(
    /<details>\s*<summary>Original Transcript<\/summary>([\s\S]*?)<\/details>/i
  );
  if (detailsMatch) {
    metadata.transcript = detailsMatch[1].trim();
    metadata.transcriptFormatted = metadata.transcript;
    metadata.hasTranscript = true;
  }

  const metadataMatch = markdown.match(/## Metadata\n\n([\s\S]*?)(?=\n## |$)/);
  if (metadataMatch) {
    const section = metadataMatch[1];

    const channelMatch = section.match(/\*\*Channel:\*\*\s*(.+)/);
    if (channelMatch) metadata.channel = channelMatch[1].trim();

    const publishMatch = section.match(/\*\*Published:\*\*\s*(.+)/);
    if (publishMatch) metadata.publishDate = publishMatch[1].trim();

    const durationMatch = section.match(/\*\*Duration:\*\*\s*(.+)/);
    if (durationMatch) metadata.duration = durationMatch[1].trim();

    const viewsMatch = section.match(/\*\*Views:\*\*\s*(.+)/);
    if (viewsMatch) metadata.views = viewsMatch[1].trim();

    const urlMatch = section.match(/\*\*URL:\*\*\s*https:\/\/youtube\.com\/watch\?v=([^\s\n]+)/);
    if (urlMatch) metadata.videoId = urlMatch[1].trim();
  }

  const descMatch = markdown.match(/## Description\n\n([\s\S]*?)(?=\n## |$)/);
  if (descMatch) {
    metadata.description = descMatch[1].trim();
  }

  return metadata;
}
