/**
 * View management and rendering
 */
import { getElements } from './elements.js';
import { getState, setState } from './state.js';
import { truncate } from './utils.js';
import { renderMarkdown } from './markdown.js';

export function showInputView() {
  const elements = getElements();

  elements.inputView.classList.remove('hidden');
  elements.resultsView.classList.add('hidden');

  // Clear active history state
  elements.historyList.querySelectorAll('.history-item').forEach(item => {
    item.classList.remove('active');
  });
}

export function showResultsView(markdown, title, noTranscriptWarning = null) {
  const elements = getElements();

  elements.inputView.classList.add('hidden');
  elements.resultsView.classList.remove('hidden');
  elements.currentTitle.textContent = truncate(title, 40);

  // If markdown is null, show loading placeholder in output
  if (markdown === null) {
    elements.output.textContent = '';
    const placeholder = document.createElement('div');
    placeholder.className = 'loading-placeholder';
    placeholder.textContent = 'Processing with LLM...';
    elements.output.appendChild(placeholder);
  } else {
    renderMarkdown(markdown, noTranscriptWarning);
  }
}

export function updateInfoPane(basicInfo) {
  const elements = getElements();

  // Update transcript tab
  elements.transcriptTab.textContent = '';

  if (basicInfo.transcriptFormatted || basicInfo.transcript) {
    const transcript = basicInfo.transcriptFormatted || basicInfo.transcript;
    const paragraphs = transcript.split('\n\n').filter(p => p.trim());
    paragraphs.forEach(p => {
      const para = document.createElement('p');
      para.textContent = p.trim();
      elements.transcriptTab.appendChild(para);
    });
    setState('originalTranscript', transcript);
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
    setState('originalTranscript', '');
  }

  // Update metadata tab
  elements.metadataTab.textContent = '';

  const metadataFields = [
    { key: 'channel', label: 'Channel' },
    { key: 'publishDate', label: 'Published' },
    { key: 'duration', label: 'Duration' },
    { key: 'views', label: 'Views' },
    { key: 'description', label: 'Description' }
  ];

  const items = metadataFields.filter(f => basicInfo[f.key]);

  if (items.length > 0) {
    const list = document.createElement('div');
    list.className = 'metadata-list';

    items.forEach(field => {
      const item = document.createElement('div');
      item.className = 'metadata-item';

      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = field.label;

      const value = document.createElement('span');
      value.className = 'value';
      value.textContent = basicInfo[field.key];

      item.appendChild(label);
      item.appendChild(value);
      list.appendChild(item);
    });

    elements.metadataTab.appendChild(list);
    setState('currentMetadata', basicInfo);
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
    setState('currentMetadata', null);
  }
}

/**
 * Render streaming sections progressively as they arrive
 * Uses incremental DOM updates to avoid flickering completed sections
 * @param {object} sections - Parsed sections from streaming JSON
 * @param {string} title - Video title
 */
export function renderStreamingSections(sections, title) {
  const elements = getElements();

  // Ensure container exists (only create structure once)
  let container = elements.output.querySelector('[data-section="container"]');
  if (!container) {
    elements.output.textContent = '';
    container = document.createElement('div');
    container.setAttribute('data-section', 'container');
    elements.output.appendChild(container);
  }

  // Update or create title (stable, never changes)
  ensureSection(container, 'title', () => {
    const h1 = document.createElement('h1');
    h1.textContent = title;
    return h1;
  }, 'stable');

  // TLDR section - stable once it has content
  if (sections.tldr) {
    ensureSection(container, 'tldr', () => createTldrSection(sections.tldr), 'stable');
  } else {
    ensureSection(container, 'tldr', () => createLoadingSection('TLDR'), 'loading');
  }

  // Key Insights section - show loading, then partial, then complete
  if (sections.keyInsights && sections.keyInsights.length > 0) {
    const status = sections.keyInsightsPartial ? 'partial' : 'stable';
    ensureSection(
      container,
      'keyInsights',
      () => createInsightsSection(sections.keyInsights, sections.keyInsightsPartial),
      status
    );
  } else {
    // Show loading placeholder
    ensureSection(container, 'keyInsights', () => createLoadingSection('Key Insights'), 'loading');
  }

  // Action Items section - show loading, then partial, then complete
  if (sections.actionItems && sections.actionItems.length > 0) {
    const status = sections.actionItemsPartial ? 'partial' : 'stable';
    ensureSection(
      container,
      'actionItems',
      () => createActionsSection(sections.actionItems, sections.actionItemsPartial),
      status
    );
  } else {
    // Show loading placeholder
    ensureSection(container, 'actionItems', () => createLoadingSection('Action Items & Takeaways'), 'loading');
  }

  // Summary/Transcript section - show loading, then partial stream, then complete
  if (sections.transcript) {
    ensureSection(
      container,
      'summary',
      () => createSummarySection(sections.transcript, false),
      'stable'
    );
  } else if (sections.transcriptPartial) {
    // Still streaming - update content on each render
    ensureSection(
      container,
      'summary',
      () => createSummarySection(sections.transcriptPartial, true),
      'partial'
    );
  } else {
    // Show loading placeholder
    ensureSection(container, 'summary', () => createLoadingSection('Summary'), 'loading');
  }
}

/**
 * Ensure a section exists in the container, creating or updating as needed
 * @param {HTMLElement} container - Parent container
 * @param {string} sectionId - Unique identifier for the section
 * @param {Function} createFn - Function that creates the section element
 * @param {string} status - 'loading' | 'partial' | 'stable'
 *   - loading: can be replaced by anything
 *   - partial: content is streaming, update on each render
 *   - stable: content is complete, never update once set
 */
function ensureSection(container, sectionId, createFn, status = 'loading') {
  let section = container.querySelector(`[data-section="${sectionId}"]`);
  const currentStatus = section?.getAttribute('data-status');

  if (!section) {
    // First time - create the section
    section = createFn();
    section.setAttribute('data-section', sectionId);
    section.setAttribute('data-status', status);
    container.appendChild(section);
  } else if (currentStatus === 'stable') {
    // Already stable - never update (prevents flickering)
    return;
  } else if (currentStatus === 'loading' && status === 'loading') {
    // Both loading - don't replace (avoid unnecessary DOM churn)
    return;
  } else {
    // Any other transition: loading→partial, loading→stable, partial→partial, partial→stable
    const newSection = createFn();
    newSection.setAttribute('data-section', sectionId);
    newSection.setAttribute('data-status', status);
    section.replaceWith(newSection);
  }
}

/**
 * Create TLDR section
 */
function createTldrSection(tldr) {
  const section = document.createElement('div');
  section.className = 'streaming-section streaming-section-complete';

  const h2 = document.createElement('h2');
  h2.textContent = 'TLDR';
  section.appendChild(h2);

  const p = document.createElement('p');
  p.textContent = tldr;
  section.appendChild(p);

  return section;
}

/**
 * Create Key Insights section
 */
function createInsightsSection(insights, isPartial) {
  const section = document.createElement('div');
  section.className = isPartial
    ? 'streaming-section streaming-section-partial'
    : 'streaming-section streaming-section-complete';

  const h2 = document.createElement('h2');
  h2.textContent = 'Key Insights';
  if (isPartial) {
    const spinner = document.createElement('span');
    spinner.className = 'mini-spinner inline-spinner';
    h2.appendChild(spinner);
  }
  section.appendChild(h2);

  const list = document.createElement('ul');
  insights.forEach(insight => {
    const li = document.createElement('li');
    li.textContent = insight;
    list.appendChild(li);
  });
  section.appendChild(list);

  return section;
}

/**
 * Create Action Items section
 */
function createActionsSection(items, isPartial) {
  const section = document.createElement('div');
  section.className = isPartial
    ? 'streaming-section streaming-section-partial'
    : 'streaming-section streaming-section-complete';

  const h2 = document.createElement('h2');
  h2.textContent = 'Action Items & Takeaways';
  if (isPartial) {
    const spinner = document.createElement('span');
    spinner.className = 'mini-spinner inline-spinner';
    h2.appendChild(spinner);
  }
  section.appendChild(h2);

  const list = document.createElement('ul');
  items.forEach(item => {
    const li = document.createElement('li');
    li.textContent = item;
    list.appendChild(li);
  });
  section.appendChild(list);

  return section;
}

/**
 * Create Summary section (transcript content)
 */
function createSummarySection(content, isPartial) {
  const section = document.createElement('div');
  section.className = isPartial
    ? 'streaming-section streaming-section-partial'
    : 'streaming-section streaming-section-complete';

  const h2 = document.createElement('h2');
  h2.textContent = 'Summary';
  if (isPartial) {
    const spinner = document.createElement('span');
    spinner.className = 'mini-spinner inline-spinner';
    h2.appendChild(spinner);
  }
  section.appendChild(h2);

  // Parse the transcript markdown
  const paragraphs = content.split('\n\n').filter(p => p.trim());
  paragraphs.forEach(p => {
    const trimmed = p.trim();
    if (trimmed.startsWith('## ')) {
      const h3 = document.createElement('h3');
      h3.textContent = trimmed.slice(3);
      section.appendChild(h3);
    } else if (trimmed.startsWith('### ')) {
      const h4 = document.createElement('h4');
      h4.textContent = trimmed.slice(4);
      section.appendChild(h4);
    } else {
      const para = document.createElement('p');
      para.textContent = trimmed;
      section.appendChild(para);
    }
  });

  return section;
}

/**
 * Create a loading section placeholder
 * @param {string} sectionName - Name of the section being loaded
 * @returns {HTMLElement} - Loading section element
 */
function createLoadingSection(sectionName) {
  const section = document.createElement('div');
  section.className = 'loading-section';

  const header = document.createElement('div');
  header.className = 'loading-section-header';

  const h2 = document.createElement('h2');
  h2.textContent = sectionName;
  header.appendChild(h2);

  const spinner = document.createElement('div');
  spinner.className = 'mini-spinner';
  header.appendChild(spinner);

  section.appendChild(header);

  // Add skeleton lines
  for (let i = 0; i < 3; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = 'skeleton-line';
    if (i === 2) skeleton.classList.add('short');
    section.appendChild(skeleton);
  }

  return section;
}

export function renderBasicContent(basicDataArray) {
  const elements = getElements();
  elements.output.textContent = '';

  for (const basicInfo of basicDataArray) {
    // Title
    const h1 = document.createElement('h1');
    h1.textContent = basicInfo.title;
    elements.output.appendChild(h1);

    // Metadata section
    const metaH2 = document.createElement('h2');
    metaH2.textContent = 'Metadata';
    elements.output.appendChild(metaH2);

    const metaList = document.createElement('ul');
    const metaFields = [
      { key: 'channel', label: 'Channel' },
      { key: 'publishDate', label: 'Published' },
      { key: 'duration', label: 'Duration' },
      { key: 'views', label: 'Views' }
    ];

    metaFields.forEach(field => {
      if (basicInfo[field.key]) {
        const li = document.createElement('li');
        const strong = document.createElement('strong');
        strong.textContent = field.label + ': ';
        li.appendChild(strong);
        li.appendChild(document.createTextNode(basicInfo[field.key]));
        metaList.appendChild(li);
      }
    });
    elements.output.appendChild(metaList);

    // Description section
    if (basicInfo.description) {
      const descH2 = document.createElement('h2');
      descH2.textContent = 'Description';
      elements.output.appendChild(descH2);
      const descP = document.createElement('p');
      descP.textContent = basicInfo.description;
      elements.output.appendChild(descP);
    }

    // Transcript section
    const transcriptH2 = document.createElement('h2');
    transcriptH2.textContent = 'Transcript';
    elements.output.appendChild(transcriptH2);

    if (basicInfo.hasTranscript) {
      const transcript = basicInfo.transcriptFormatted || basicInfo.transcript || '';
      const paragraphs = transcript.split('\n\n').filter(p => p.trim());
      paragraphs.forEach(p => {
        const para = document.createElement('p');
        para.textContent = p.trim();
        elements.output.appendChild(para);
      });
    } else {
      const noTranscript = document.createElement('p');
      const em = document.createElement('em');
      em.textContent = 'No transcript available for this video.';
      noTranscript.appendChild(em);
      elements.output.appendChild(noTranscript);
    }

    // Add separator between multiple videos
    if (basicDataArray.length > 1 && basicInfo !== basicDataArray[basicDataArray.length - 1]) {
      elements.output.appendChild(document.createElement('hr'));
    }
  }

  // Build simple markdown for copy functionality
  const markdown = basicDataArray.map(basicInfo => {
    let md = `# ${basicInfo.title}\n\n`;
    md += `## Metadata\n\n`;
    if (basicInfo.channel) md += `- **Channel:** ${basicInfo.channel}\n`;
    if (basicInfo.publishDate) md += `- **Published:** ${basicInfo.publishDate}\n`;
    if (basicInfo.duration) md += `- **Duration:** ${basicInfo.duration}\n`;
    if (basicInfo.views) md += `- **Views:** ${basicInfo.views}\n`;
    md += '\n';
    if (basicInfo.description) {
      md += `## Description\n\n${basicInfo.description}\n\n`;
    }
    md += `## Transcript\n\n`;
    if (basicInfo.hasTranscript) {
      md += basicInfo.transcriptFormatted || basicInfo.transcript || '';
    } else {
      md += '*No transcript available for this video.*';
    }
    return md;
  }).join('\n\n---\n\n');

  setState('currentMarkdown', markdown);
}
