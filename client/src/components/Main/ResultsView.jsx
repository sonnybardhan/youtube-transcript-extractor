import { useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useExtraction } from '../../hooks/useExtraction';
import { ResultsHeader } from './ResultsHeader';
import { OutputPane } from './OutputPane';
import { InfoPane } from './InfoPane';

export function ResultsView() {
  const { state } = useApp();
  const { handleRerunLLM, isStreaming } = useExtraction();

  // Get streaming sections directly from global state
  const streamingSections = state.streamingState?.lastSections || null;

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
            isStreaming={isStreaming}
          />
        </div>
        <InfoPane />
      </div>
    </div>
  );
}
