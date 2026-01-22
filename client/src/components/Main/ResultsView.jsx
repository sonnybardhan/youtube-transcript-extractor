import { useCallback, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useExtraction } from '../../hooks/useExtraction';
import { useAnnotation } from '../../hooks/useAnnotation';
import { fetchHistoryItem, fetchAnnotations } from '../../utils/api';
import { parseMetadataForRerun, parseKnowledgeGraph } from '../../utils/markdown';
import { ResultsHeader } from './ResultsHeader';
import { OutputPane } from './OutputPane';
import { InfoPane } from './InfoPane';

export function ResultsView() {
  const { state, actions } = useApp();
  const { handleRerunLLM, isStreaming } = useExtraction();
  const { startAnnotation } = useAnnotation();
  const lastSyncedFileRef = useRef(null);
  const isMountedRef = useRef(false);

  // Sync data when component mounts or when returning from another page
  // This ensures metadata/transcript/signal are loaded after navigation
  useEffect(() => {
    const { currentFilename, currentMetadata, signalData, isStreaming: streaming, processingFilename } = state;

    // Skip if no filename
    if (!currentFilename) {
      return;
    }

    // If actively streaming this file, only sync if metadata is missing
    // (metadata should have been set before streaming started)
    if (streaming && currentFilename === processingFilename) {
      // During streaming, metadata should be in state from before streaming
      // If it's missing, something went wrong - but we can't fetch incomplete file
      // Just log and return
      if (!currentMetadata) {
        console.warn('Metadata missing during streaming - this should not happen');
      }
      return;
    }

    // Skip if we already synced this exact file in this mount cycle
    if (lastSyncedFileRef.current === currentFilename && isMountedRef.current) {
      return;
    }

    // Mark as mounted and track synced file
    isMountedRef.current = true;
    lastSyncedFileRef.current = currentFilename;

    // Reload data to ensure consistency after page navigation
    // This runs when: 1) component mounts with a file, 2) file changes, 3) streaming completes
    (async () => {
      try {
        const [data, fileAnnotations] = await Promise.all([
          fetchHistoryItem(currentFilename),
          fetchAnnotations(currentFilename).catch(() => []),
        ]);

        const titleMatch = data.content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1] : currentFilename.replace('.md', '');
        const parsedMetadata = parseMetadataForRerun(data.content, title);

        actions.setCurrentExtraction({
          metadata: parsedMetadata,
          transcript: parsedMetadata.transcript || '',
        });

        if (data.signal) {
          actions.setSignalData(data.signal);
        } else {
          const knowledgeGraph = parseKnowledgeGraph(data.content);
          actions.setSignalData(knowledgeGraph);
        }

        actions.setAnnotations(fileAnnotations);
      } catch (err) {
        console.error('Failed to sync file data:', err);
      }
    })();
  }, [state.currentFilename, state.currentMetadata, state.signalData, state.isStreaming, state.processingFilename, actions]);

  // Reset mount flag when component unmounts (for next mount cycle)
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      lastSyncedFileRef.current = null;
    };
  }, []);

  // Only show streaming content if viewing the item being processed
  const isViewingStreamingItem = state.currentFilename === state.processingFilename;
  const shouldShowStreaming = isStreaming && isViewingStreamingItem;
  const streamingSections = shouldShowStreaming ? (state.streamingState?.lastSections || null) : null;

  // Handle rerun
  const onRerun = useCallback(() => {
    handleRerunLLM();
  }, [handleRerunLLM]);

  // Handle elaborate request - uses default question
  const handleElaborate = useCallback((selectionData) => {
    startAnnotation(selectionData);
  }, [startAnnotation]);

  // Handle custom question - opens modal
  const handleAskCustom = useCallback((selectionData) => {
    actions.setAskQuestionModal(true, {
      selectionData,
      onSubmit: (question) => {
        startAnnotation(selectionData, question);
      },
    });
  }, [actions, startAnnotation]);

  return (
    <div id="results-view" className="view">
      <ResultsHeader onRerun={onRerun} />

      <div className="results-content">
        <div className="results-main">
          <OutputPane
            streamingSections={streamingSections}
            isStreaming={shouldShowStreaming}
            onElaborate={handleElaborate}
            onAskCustom={handleAskCustom}
          />
        </div>
        <InfoPane />
      </div>
    </div>
  );
}
