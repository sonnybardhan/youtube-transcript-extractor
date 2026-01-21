import { useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useExtraction } from '../../hooks/useExtraction';
import { ResultsHeader } from './ResultsHeader';
import { OutputPane } from './OutputPane';
import { InfoPane } from './InfoPane';

export function ResultsView() {
  const { state } = useApp();
  const { handleRerunLLM, isStreaming } = useExtraction();

  // Only show streaming content if viewing the item being processed
  const isViewingStreamingItem = state.currentFilename === state.processingFilename;
  const shouldShowStreaming = isStreaming && isViewingStreamingItem;
  const streamingSections = shouldShowStreaming ? (state.streamingState?.lastSections || null) : null;

  // Handle rerun
  const onRerun = useCallback(() => {
    handleRerunLLM();
  }, [handleRerunLLM]);

  return (
    <div id="results-view" className="view">
      <ResultsHeader onRerun={onRerun} />

      <div className="results-content">
        <div className="results-main">
          <OutputPane
            streamingSections={streamingSections}
            isStreaming={shouldShowStreaming}
          />
        </div>
        <InfoPane />
      </div>
    </div>
  );
}
