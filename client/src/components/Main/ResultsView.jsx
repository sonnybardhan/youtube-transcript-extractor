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
  const syncAttemptedRef = useRef(null);

  // Sync data when component mounts with a filename but missing data
  // This handles the case where user navigated away during streaming and came back
  useEffect(() => {
    const { currentFilename, currentMetadata, signalData, isStreaming: streaming, processingFilename } = state;

    // Skip if no filename, currently streaming this file, or already attempted sync for this file
    if (!currentFilename || (streaming && currentFilename === processingFilename)) {
      return;
    }

    // Skip if we already attempted sync for this file
    if (syncAttemptedRef.current === currentFilename) {
      return;
    }

    // Check if data appears to be missing (no metadata or signal)
    const needsSync = !currentMetadata || !signalData;

    if (needsSync) {
      syncAttemptedRef.current = currentFilename;

      // Reload data for the current file
      (async () => {
        try {
          const [data, fileAnnotations] = await Promise.all([
            fetchHistoryItem(currentFilename),
            fetchAnnotations(currentFilename).catch(() => []),
          ]);

          // Only update if we're still viewing the same file
          if (state.currentFilename !== currentFilename) return;

          const titleMatch = data.content.match(/^#\s+(.+)$/m);
          const title = titleMatch ? titleMatch[1] : currentFilename.replace('.md', '');
          const parsedMetadata = parseMetadataForRerun(data.content, title);

          actions.setCurrentExtraction({
            markdown: data.content,
            filename: currentFilename,
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
    }
  }, [state.currentFilename, state.currentMetadata, state.signalData, state.isStreaming, state.processingFilename, actions]);

  // Reset sync ref when filename changes
  useEffect(() => {
    if (state.currentFilename !== syncAttemptedRef.current) {
      syncAttemptedRef.current = null;
    }
  }, [state.currentFilename]);

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
