import { useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useExtraction } from '../../hooks/useExtraction';
import { ResultsHeader } from './ResultsHeader';
import { OutputPane } from './OutputPane';
import { InfoPane } from './InfoPane';
import { AnnotationModal } from '../Annotations/AnnotationModal';

export function ResultsView() {
  const { state, actions } = useApp();
  const { handleRerunLLM, isStreaming } = useExtraction();

  // Only show streaming content if viewing the item being processed
  const isViewingStreamingItem = state.currentFilename === state.processingFilename;
  const shouldShowStreaming = isStreaming && isViewingStreamingItem;
  const streamingSections = shouldShowStreaming ? (state.streamingState?.lastSections || null) : null;

  // Handle rerun
  const onRerun = useCallback(() => {
    handleRerunLLM();
  }, [handleRerunLLM]);

  // Handle opening annotation modal
  const handleAskLLM = useCallback((selectionData) => {
    actions.setAnnotationModal(true, selectionData);
  }, [actions]);

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

      {state.annotationModalOpen && (
        <AnnotationModal />
      )}
    </div>
  );
}
