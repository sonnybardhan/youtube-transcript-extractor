import { useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useExtraction } from '../../hooks/useExtraction';

export function InputView() {
  const { state, actions } = useApp();
  const { handleExtract } = useExtraction();
  const [urls, setUrls] = useState('');
  const textareaRef = useRef(null);

  const { apiConfig, isLoading } = state;
  const hasAnyKey = apiConfig.hasOpenAI || apiConfig.hasAnthropic || apiConfig.hasOpenRouter;

  const onExtract = useCallback(async () => {
    const urlList = urls
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u);

    if (urlList.length === 0) {
      actions.showToast('Please enter at least one YouTube URL');
      return;
    }

    await handleExtract(urlList);
  }, [urls, handleExtract, actions]);

  const handleKeyDown = useCallback((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onExtract();
    }
  }, [onExtract]);

  // Focus textarea when view becomes active
  useEffect(() => {
    if (state.view === 'input' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [state.view]);

  return (
    <div id="input-view" className="view">
      <div className="content-wrapper">
        <div className="page-header">
          <h2>Batch Extraction</h2>
          <p>
            Generate comprehensive summaries and extract structured data from
            multiple YouTube videos simultaneously.
          </p>
        </div>

        <div className="input-panel">
          <div className="textarea-wrapper">
            <textarea
              ref={textareaRef}
              placeholder={`https://youtube.com/watch?v=...\nhttps://youtube.com/watch?v=...\nhttps://youtube.com/watch?v=...`}
              spellCheck="false"
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className="textarea-hint">
              <span>One URL per line</span>
            </div>
          </div>
        </div>

        <div className="action-area">
          <button
            className="extract-btn"
            onClick={onExtract}
            disabled={isLoading || !urls.trim()}
          >
            <span className="material-symbols-outlined">bolt</span>
            <span>Extract Transcripts</span>
          </button>
        </div>

        <div className="footer-status">
          <p>
            API Status:{' '}
            <span className={hasAnyKey ? 'status-ok' : 'status-error'}>
              {hasAnyKey ? 'Operational' : 'No API Keys'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
