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
