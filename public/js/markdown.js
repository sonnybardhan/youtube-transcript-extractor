/**
 * Markdown rendering and processing
 */
import { getElements } from './elements.js';
import { getState, setState } from './state.js';
import { escapeHtml } from './utils.js';

export function renderMarkdown(content, noTranscriptWarning = null) {
  const elements = getElements();

  // Extract original transcript from <details> section
  const detailsMatch = content.match(/<details>\s*<summary>Original Transcript<\/summary>([\s\S]*?)<\/details>/i);

  if (detailsMatch) {
    setState('originalTranscript', detailsMatch[1].trim());
    content = content.replace(/<details>\s*<summary>Original Transcript<\/summary>[\s\S]*?<\/details>/i, '');
  } else {
    setState('originalTranscript', '');
  }

  // Extract metadata section
  const metadataMatch = content.match(/## Metadata\n\n([\s\S]*?)(?=\n## |$)/);
  if (metadataMatch) {
    setState('currentMetadata', parseMetadata(metadataMatch[1]));
    content = content.replace(/## Metadata\n\n[\s\S]*?(?=\n## |$)/, '');
  } else {
    setState('currentMetadata', null);
  }

  // Extract description section (also goes to right pane)
  const descMatch = content.match(/## Description\n\n([\s\S]*?)(?=\n## |$)/);
  const currentMetadata = getState('currentMetadata');
  if (descMatch && currentMetadata) {
    currentMetadata.description = descMatch[1].trim();
    setState('currentMetadata', currentMetadata);
    content = content.replace(/## Description\n\n[\s\S]*?(?=\n## |$)/, '');
  }

  // Check for empty Key Insights and Action Items sections and add "n/a" placeholder
  content = content.replace(/## Key Insights\n\n(?=## |$)/g, '## Key Insights\n\nn/a\n\n');
  content = content.replace(/## Action Items & Takeaways\n\n(?=## |$)/g, '## Action Items & Takeaways\n\nn/a\n\n');

  // Remove other truly empty sections (but not Key Insights or Action Items)
  content = content.replace(/^## (?!Transcript|Summary|Key Insights|Action Items)[^\n]+\n+(?=## |$)/gm, '');
  content = content.replace(/^(## (?!Transcript|Summary|Key Insights|Action Items)[^\n]+)\n+---\n*(?=## |$)/gm, '');

  // Calculate reading time based on word count (average 200 words per minute)
  const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 200));
  const readingTimeText = readingMinutes === 1 ? '1 min read' : `${readingMinutes} min read`;

  // Build meta line with reading time and optional model info
  const currentModel = getState('currentModel');
  const metaParts = [readingTimeText];
  if (currentModel) {
    metaParts.push(`summarized by ${currentModel}`);
  }
  const metaText = metaParts.join(' · ');

  // Parse markdown using marked library (global)
  // Note: marked.parse returns sanitized HTML from markdown
  let html = marked.parse(content);

  // Insert reading time and model info after the h1 title
  html = html.replace(/(<\/h1>)/, `$1<p class="reading-time">${escapeHtml(metaText)}</p>`);

  // Make all links open in new tabs
  html = html.replace(/<a\s+href=/g, '<a target="_blank" rel="noopener noreferrer" href=');

  // Make sections collapsible
  html = makeCollapsibleSections(html);

  // Build output safely
  elements.output.textContent = '';

  // Add no transcript warning if present
  if (noTranscriptWarning) {
    const warningDiv = document.createElement('div');
    warningDiv.className = 'no-transcript-warning';
    const warningIcon = document.createElement('span');
    warningIcon.className = 'material-symbols-outlined';
    warningIcon.textContent = 'warning';
    const warningText = document.createElement('p');
    warningText.textContent = noTranscriptWarning;
    warningDiv.appendChild(warningIcon);
    warningDiv.appendChild(warningText);
    elements.output.appendChild(warningDiv);
  }

  // Create a container for the HTML content
  // Using innerHTML here for markdown-generated HTML which is from trusted source (marked library)
  const contentDiv = document.createElement('div');
  contentDiv.innerHTML = html;
  elements.output.appendChild(contentDiv);

  // Add .section-intro class to italic paragraph headers
  elements.output.querySelectorAll('p > em:first-child').forEach(em => {
    const p = em.parentElement;
    const textContent = p.textContent.trim();
    const emContent = em.textContent.trim();
    if (textContent === emContent) {
      em.classList.add('section-intro');
    }
  });

  // Set up collapsible section click handlers
  elements.output.querySelectorAll('.collapsible-section-header').forEach(header => {
    header.addEventListener('click', () => {
      header.parentElement.classList.toggle('collapsed');
    });
  });

  // Display info in right pane
  displayOriginalTranscript();
  displayMetadata();
}

function parseMetadata(metadataText) {
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

export function displayOriginalTranscript() {
  const elements = getElements();
  const originalTranscript = getState('originalTranscript');

  elements.transcriptTab.textContent = '';

  if (originalTranscript) {
    const paragraphs = originalTranscript.split('\n\n').filter(p => p.trim());
    paragraphs.forEach(p => {
      const para = document.createElement('p');
      para.textContent = p.trim();
      elements.transcriptTab.appendChild(para);
    });
  } else {
    const noContent = document.createElement('div');
    noContent.className = 'no-content';
    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined';
    icon.textContent = 'subtitles_off';
    const msg = document.createElement('p');
    msg.textContent = 'No transcript available';
    noContent.appendChild(icon);
    noContent.appendChild(msg);
    elements.transcriptTab.appendChild(noContent);
  }
}

export function displayMetadata() {
  const elements = getElements();
  const currentMetadata = getState('currentMetadata');

  elements.metadataTab.textContent = '';

  if (currentMetadata && Object.keys(currentMetadata).length > 0) {
    const list = document.createElement('div');
    list.className = 'metadata-list';

    const fields = [
      { key: 'channel', label: 'Channel' },
      { key: 'published', label: 'Published' },
      { key: 'duration', label: 'Duration' },
      { key: 'views', label: 'Views' },
      { key: 'url', label: 'URL', isLink: true },
      { key: 'description', label: 'Description' }
    ];

    fields.forEach(field => {
      if (currentMetadata[field.key]) {
        const item = document.createElement('div');
        item.className = 'metadata-item';

        const label = document.createElement('span');
        label.className = 'label';
        label.textContent = field.label;

        const value = document.createElement('span');
        value.className = 'value';

        if (field.isLink) {
          const link = document.createElement('a');
          link.href = currentMetadata[field.key];
          link.textContent = currentMetadata[field.key];
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          value.appendChild(link);
        } else {
          value.textContent = currentMetadata[field.key];
        }

        item.appendChild(label);
        item.appendChild(value);
        list.appendChild(item);
      }
    });

    elements.metadataTab.appendChild(list);
  } else {
    const noContent = document.createElement('div');
    noContent.className = 'no-content';
    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined';
    icon.textContent = 'info';
    const msg = document.createElement('p');
    msg.textContent = 'No metadata available';
    noContent.appendChild(icon);
    noContent.appendChild(msg);
    elements.metadataTab.appendChild(noContent);
  }
}
