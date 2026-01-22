import { useState, useEffect, useRef } from 'react';

export function SelectionToolbar({ onElaborate, onAskCustom, containerRef }) {
  const [position, setPosition] = useState(null);
  const [selectionData, setSelectionData] = useState(null);
  const toolbarRef = useRef(null);

  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;

    const handleSelectionChange = () => {
      const selection = window.getSelection();

      // Check if selection is within our container
      if (
        !selection.rangeCount ||
        !selection.toString().trim() ||
        !container.contains(selection.anchorNode)
      ) {
        setPosition(null);
        setSelectionData(null);
        return;
      }

      const selectedText = selection.toString().trim();
      if (selectedText.length < 3) {
        setPosition(null);
        setSelectionData(null);
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Find the section this selection belongs to
      let section = 'General';
      let node = range.startContainer;
      while (node && node !== container) {
        // Look for h2, h3, or collapsible section headers
        if (node.nodeType === Node.ELEMENT_NODE) {
          const heading = node.querySelector?.('h2, h3') ||
            (node.tagName === 'H2' || node.tagName === 'H3' ? node : null);
          if (heading) {
            section = heading.textContent.trim();
            break;
          }
          // Check previous siblings for headings
          let sibling = node.previousElementSibling;
          while (sibling) {
            if (sibling.tagName === 'H2' || sibling.tagName === 'H3') {
              section = sibling.textContent.trim();
              break;
            }
            sibling = sibling.previousElementSibling;
          }
          if (section !== 'General') break;
        }
        node = node.parentElement;
      }

      // Get surrounding context (~250 chars before and after)
      const textContainer = range.commonAncestorContainer.parentElement;
      let surroundingText = '';
      if (textContainer) {
        const fullText = textContainer.textContent || '';
        const selectionStart = fullText.indexOf(selectedText);
        if (selectionStart !== -1) {
          const before = fullText.slice(Math.max(0, selectionStart - 250), selectionStart);
          const after = fullText.slice(
            selectionStart + selectedText.length,
            selectionStart + selectedText.length + 250
          );
          surroundingText = `...${before}[SELECTED]${after}...`;
        } else {
          surroundingText = fullText.slice(0, 500);
        }
      }

      // Calculate toolbar position
      const toolbarHeight = 36;
      const toolbarWidth = 100;
      let top = rect.top - toolbarHeight - 8;
      let left = rect.left + rect.width / 2 - toolbarWidth / 2;

      // Flip below if near top
      if (top < containerRect.top + 10) {
        top = rect.bottom + 8;
      }

      // Keep within container bounds
      left = Math.max(containerRect.left + 10, Math.min(left, containerRect.right - toolbarWidth - 10));

      setPosition({ top, left });
      setSelectionData({
        selectedText,
        section,
        surroundingText,
      });
    };

    // Debounce selection changes
    let timeout;
    const debouncedHandler = () => {
      clearTimeout(timeout);
      timeout = setTimeout(handleSelectionChange, 150);
    };

    document.addEventListener('selectionchange', debouncedHandler);

    // Hide toolbar on scroll
    const handleScroll = () => {
      setPosition(null);
      setSelectionData(null);
    };
    container.addEventListener('scroll', handleScroll);

    return () => {
      document.removeEventListener('selectionchange', debouncedHandler);
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(timeout);
    };
  }, [containerRef]);

  const clearSelection = () => {
    window.getSelection().removeAllRanges();
    setPosition(null);
    setSelectionData(null);
  };

  const handleElaborateClick = () => {
    if (selectionData && onElaborate) {
      onElaborate(selectionData);
      clearSelection();
    }
  };

  const handleAskClick = () => {
    if (selectionData && onAskCustom) {
      onAskCustom(selectionData);
      clearSelection();
    }
  };

  if (!position || !selectionData) return null;

  return (
    <div
      ref={toolbarRef}
      className="selection-toolbar"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
      }}
    >
      <button className="selection-toolbar-btn" onClick={handleElaborateClick} title="Explain this in more detail">
        <span className="material-symbols-outlined">auto_awesome</span>
        <span>Elaborate</span>
      </button>
      <button className="selection-toolbar-btn secondary" onClick={handleAskClick} title="Ask a custom question">
        <span className="material-symbols-outlined">chat</span>
        <span>Ask</span>
      </button>
    </div>
  );
}
