import { useEffect, useRef, useCallback, useState } from 'react';
import DOMPurify from 'dompurify';
import { useApp } from '../../context/AppContext';
import { renderMarkdownToHTML, parseMarkdownContent } from '../../utils/markdown';
import { parseInlineMarkdown } from '../../utils/helpers';

// Loading skeleton component
function LoadingSection({ title }) {
  return (
    <div className="loading-section">
      <div className="loading-section-header">
        <h2>{title}</h2>
        <div className="mini-spinner" />
      </div>
      <div className="skeleton-line" />
      <div className="skeleton-line" />
      <div className="skeleton-line short" />
    </div>
  );
}

// Streaming section component
function StreamingSection({ title, children, isPartial }) {
  return (
    <div className={`streaming-section ${isPartial ? 'streaming-section-partial' : 'streaming-section-complete'}`}>
      <h2>
        {title}
        {isPartial && <span className="mini-spinner inline-spinner" />}
      </h2>
      {children}
    </div>
  );
}

// Safe inline markdown renderer using DOMPurify
function InlineMarkdown({ text }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && text) {
      const html = parseInlineMarkdown(text);
      const sanitized = DOMPurify.sanitize(html);
      ref.current.innerHTML = sanitized;
    }
  }, [text]);

  return <span ref={ref} />;
}

export function OutputPane({ streamingSections, isStreaming }) {
  const { state } = useApp();
  const { currentMarkdown, currentMetadata, currentModel } = state;
  const outputRef = useRef(null);

  const title = currentMetadata?.title || 'Loading...';

  // Render streaming content
  const renderStreamingContent = useCallback(() => {
    if (!streamingSections || !isStreaming) return null;

    return (
      <div data-section="container">
        {/* Title */}
        <h1>{title}</h1>

        {/* TLDR */}
        {streamingSections.tldr ? (
          <StreamingSection title="TLDR" isPartial={false}>
            <p><InlineMarkdown text={streamingSections.tldr} /></p>
          </StreamingSection>
        ) : (
          <LoadingSection title="TLDR" />
        )}

        {/* Key Insights */}
        {streamingSections.keyInsights?.length > 0 ? (
          <StreamingSection title="Key Insights" isPartial={streamingSections.keyInsightsPartial}>
            <ul>
              {streamingSections.keyInsights.map((item, idx) => (
                <li key={idx}><InlineMarkdown text={item} /></li>
              ))}
            </ul>
          </StreamingSection>
        ) : (
          <LoadingSection title="Key Insights" />
        )}

        {/* Action Items */}
        {streamingSections.actionItems?.length > 0 ? (
          <StreamingSection title="Action Items & Takeaways" isPartial={streamingSections.actionItemsPartial}>
            <ul>
              {streamingSections.actionItems.map((item, idx) => (
                <li key={idx}><InlineMarkdown text={item} /></li>
              ))}
            </ul>
          </StreamingSection>
        ) : (
          <LoadingSection title="Action Items & Takeaways" />
        )}

        {/* Summary */}
        {streamingSections.summary || streamingSections.summaryPartial ? (
          <StreamingSection title="Summary" isPartial={!streamingSections.summary}>
            {(streamingSections.summary || streamingSections.summaryPartial)
              .split('\n\n')
              .filter((p) => p.trim())
              .map((para, idx) => {
                if (para.startsWith('## ')) {
                  return <h3 key={idx}>{para.slice(3)}</h3>;
                }
                if (para.startsWith('### ')) {
                  return <h4 key={idx}>{para.slice(4)}</h4>;
                }
                return (
                  <p key={idx}><InlineMarkdown text={para.trim()} /></p>
                );
              })}
          </StreamingSection>
        ) : (
          <LoadingSection title="Summary" />
        )}
      </div>
    );
  }, [streamingSections, isStreaming, title]);

  // Process and render final markdown with DOMPurify sanitization
  useEffect(() => {
    if (currentMarkdown && !isStreaming && outputRef.current) {
      const { content } = parseMarkdownContent(currentMarkdown, currentMetadata);
      const html = renderMarkdownToHTML(content, currentModel);

      // Sanitize with DOMPurify before setting innerHTML
      const sanitized = DOMPurify.sanitize(html, {
        ADD_ATTR: ['target', 'rel'], // Allow target="_blank" for links
      });

      outputRef.current.innerHTML = sanitized;

      // Add .section-intro class to italic paragraph headers
      outputRef.current.querySelectorAll('p > em:first-child').forEach(em => {
        const p = em.parentElement;
        const textContent = p.textContent.trim();
        const emContent = em.textContent.trim();
        if (textContent === emContent) {
          em.classList.add('section-intro');
        }
      });
    }
  }, [currentMarkdown, currentMetadata, currentModel, isStreaming]);

  // Set up collapsible section click handlers
  useEffect(() => {
    if (!outputRef.current || isStreaming) return;

    const headers = outputRef.current.querySelectorAll('.collapsible-section-header');
    const handleClick = function() {
      this.parentElement.classList.toggle('collapsed');
    };

    headers.forEach((header) => {
      header.addEventListener('click', handleClick);
    });

    return () => {
      headers.forEach((header) => {
        header.removeEventListener('click', handleClick);
      });
    };
  }, [currentMarkdown, isStreaming]);

  // Render streaming content if active
  if (isStreaming && streamingSections) {
    return (
      <div id="output" className="output-container" ref={outputRef}>
        {renderStreamingContent()}
      </div>
    );
  }

  // Render loading skeleton if no content
  if (!currentMarkdown && !isStreaming) {
    return (
      <div id="output" className="output-container" ref={outputRef}>
        <h1>{title}</h1>
        <LoadingSection title="TLDR" />
        <LoadingSection title="Key Insights" />
        <LoadingSection title="Action Items & Takeaways" />
        <LoadingSection title="Summary" />
      </div>
    );
  }

  // Container for final rendered markdown
  return (
    <div id="output" className="output-container" ref={outputRef} />
  );
}
