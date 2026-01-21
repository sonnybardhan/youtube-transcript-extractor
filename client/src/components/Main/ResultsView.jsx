import { useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useExtraction } from '../../hooks/useExtraction';
import { useAnnotation } from '../../hooks/useAnnotation';
import { ResultsHeader } from './ResultsHeader';
import { OutputPane } from './OutputPane';
import { InfoPane } from './InfoPane';

export function ResultsView() {
  const { state } = useApp();
  const { handleRerunLLM, isStreaming } = useExtraction();
  const { startAnnotation } = useAnnotation();

  // Only show streaming content if viewing the item being processed
  const isViewingStreamingItem = state.currentFilename === state.processingFilename;
  const shouldShowStreaming = isStreaming && isViewingStreamingItem;
  const streamingSections = shouldShowStreaming ? (state.streamingState?.lastSections || null) : null;

  // Handle rerun
  const onRerun = useCallback(() => {
    handleRerunLLM();
  }, [handleRerunLLM]);

  // Handle annotation request - stream directly to side pane
  const handleAskLLM = useCallback((selectionData) => {
    startAnnotation(selectionData);
  }, [startAnnotation]);

  return (
    <div id="results-view" className="view">
      <ResultsHeader onRerun={onRerun} />

      <div className="results-content">
        <div className="results-main">
          <OutputPane
            streamingSections={streamingSections}
            isStreaming={shouldShowStreaming}
            onAskLLM={handleAskLLM}
          />
        </div>
        <InfoPane />
      </div>
    </div>
  );
}
