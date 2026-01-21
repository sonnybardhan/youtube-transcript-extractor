import { useEffect, useState, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { AnnotationItem } from '../Annotations/AnnotationItem';
import { PendingAnnotation } from '../Annotations/PendingAnnotation';
import { useAnnotation } from '../../hooks/useAnnotation';
import { fetchRelatedVideos, fetchHistoryItem, fetchAnnotations, rebuildMetadataIndex } from '../../utils/api';
import { parseMetadataForRerun, parseKnowledgeGraph } from '../../utils/markdown';

function TranscriptTab({ metadata, transcript }) {
  const content = metadata?.transcriptFormatted || metadata?.transcript || transcript;

  if (!content) {
    return (
      <div className="no-content">
        <span className="material-symbols-outlined">subtitles_off</span>
        <p>No transcript available</p>
      </div>
    );
  }

  const paragraphs = content.split('\n\n').filter((p) => p.trim());

  return (
    <>
      {paragraphs.map((p, idx) => (
        <p key={idx}>{p.trim()}</p>
      ))}
    </>
  );
}

function MetadataTab({ metadata }) {
  const fields = [
    { key: 'channel', label: 'Channel' },
    { key: 'publishDate', label: 'Published' },
    { key: 'duration', label: 'Duration' },
    { key: 'views', label: 'Views' },
    { key: 'description', label: 'Description' },
  ];

  const items = fields.filter((f) => metadata?.[f.key]);

  if (items.length === 0) {
    return (
      <div className="no-content">
        <span className="material-symbols-outlined">info</span>
        <p>No metadata available</p>
      </div>
    );
  }

  return (
    <div className="metadata-list">
      {items.map((field) => (
        <div key={field.key} className="metadata-item">
          <span className="label">{field.label}</span>
          <span className="value">{metadata[field.key]}</span>
        </div>
      ))}
    </div>
  );
}

function SignalTab({ signalData }) {
  const hasData =
    signalData?.concepts?.length ||
    signalData?.entities?.length ||
    signalData?.category ||
    signalData?.suggestedTags?.length;

  if (!hasData) {
    return (
      <div className="no-content">
        <span className="material-symbols-outlined">sensors</span>
        <p>No signal data available</p>
      </div>
    );
  }

  return (
    <div className="signal-content">
      {signalData.category && (
        <div className="signal-section">
          <span className="signal-label">Category</span>
          <span className="category-badge">{signalData.category}</span>
        </div>
      )}

      {signalData.concepts?.length > 0 && (
        <div className="signal-section">
          <span className="signal-label">Concepts</span>
          <div className="chip-container">
            {signalData.concepts.map((concept, idx) => (
              <span key={idx} className="chip concept-chip">
                {concept}
              </span>
            ))}
          </div>
        </div>
      )}

      {signalData.entities?.length > 0 && (
        <div className="signal-section">
          <span className="signal-label">Entities</span>
          <div className="chip-container">
            {signalData.entities.map((entity, idx) => (
              <span key={idx} className="chip entity-chip">
                {entity}
              </span>
            ))}
          </div>
        </div>
      )}

      {signalData.suggestedTags?.length > 0 && (
        <div className="signal-section">
          <span className="signal-label">Tags</span>
          <div className="chip-container">
            {signalData.suggestedTags.map((tag, idx) => (
              <span key={idx} className="chip tag-chip">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AnnotationsTab({ annotations, pendingAnnotation, currentFilename, onDelete, onSave, onDiscard, onCancel }) {
  const hasPending = pendingAnnotation && (
    pendingAnnotation.filename === currentFilename || pendingAnnotation.isStreaming
  );
  const hasAnnotations = annotations && annotations.length > 0;

  if (!hasPending && !hasAnnotations) {
    return (
      <div className="annotations-empty">
        <span className="material-symbols-outlined">edit_note</span>
        <p>No annotations yet</p>
        <p className="hint">Select text in the summary and click "Ask LLM" to create annotations</p>
      </div>
    );
  }

  return (
    <div className="annotations-list">
      {hasPending && (
        <PendingAnnotation
          pending={pendingAnnotation}
          onSave={onSave}
          onDiscard={onDiscard}
          onCancel={onCancel}
        />
      )}
      {annotations?.map((annotation) => (
        <AnnotationItem
          key={annotation.id}
          annotation={annotation}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function RelatedTab({ currentFilename, onNavigate }) {
  const [related, setRelated] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [error, setError] = useState(null);

  const loadRelated = useCallback(async () => {
    if (!currentFilename) {
      setRelated([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchRelatedVideos(currentFilename, 5);
      setRelated(result.related || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentFilename]);

  useEffect(() => {
    loadRelated();
  }, [loadRelated]);

  const handleRebuildIndex = async () => {
    setIsRebuilding(true);
    try {
      await rebuildMetadataIndex();
      await loadRelated();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRebuilding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="related-loading">
        <span className="spinner" />
        <p>Finding related videos...</p>
      </div>
    );
  }

  const updateButton = (
    <button
      className="update-index-btn"
      onClick={handleRebuildIndex}
      disabled={isRebuilding}
    >
      <span className="material-symbols-outlined">{isRebuilding ? 'sync' : 'refresh'}</span>
      <span>{isRebuilding ? 'Updating...' : 'Update Index'}</span>
    </button>
  );

  if (error) {
    return (
      <div className="related-tab-container">
        <div className="related-tab-header">
          {updateButton}
        </div>
        <div className="no-content">
          <span className="material-symbols-outlined">error</span>
          <p>Could not load related videos</p>
          <p className="hint">{error}</p>
        </div>
      </div>
    );
  }

  if (related.length === 0) {
    return (
      <div className="related-tab-container">
        <div className="related-tab-header">
          {updateButton}
        </div>
        <div className="no-content">
          <span className="material-symbols-outlined">link_off</span>
          <p>No related videos found</p>
          <p className="hint">Click "Update Index" to discover connections between videos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="related-tab-container">
      <div className="related-tab-header">
        {updateButton}
      </div>
      <div className="related-list">
        {related.map((video) => (
          <button
            key={video.filename}
            className="related-item"
            onClick={() => onNavigate(video.filename)}
          >
            <div className="related-item-header">
              <span className="related-title">{video.title}</span>
              <span className="related-score" title="Similarity score">
                {video.score}
              </span>
            </div>
            {(video.sharedConcepts.length > 0 || video.sharedTags.length > 0 || video.sharedEntities.length > 0) && (
              <div className="related-shared">
                {video.sharedConcepts.slice(0, 3).map((c) => (
                  <span key={c} className="chip concept-chip small">{c}</span>
                ))}
                {video.sharedTags.slice(0, 2).map((t) => (
                  <span key={t} className="chip tag-chip small">{t}</span>
                ))}
                {video.sharedEntities.slice(0, 2).map((e) => (
                  <span key={e} className="chip entity-chip small">{e}</span>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function InfoPane() {
  const { state, actions } = useApp();
  const { infoPaneCollapsed, activeInfoTab, currentMetadata, originalTranscript, signalData, annotations, currentFilename, pendingAnnotation, streamingState, isStreaming } = state;
  const { deleteAnnotation, savePendingAnnotation, discardPendingAnnotation, cancelStream } = useAnnotation();

  // During streaming, use basicInfo from streamingState as fallback for metadata
  const effectiveMetadata = currentMetadata || (isStreaming && streamingState?.basicInfo) || null;
  const effectiveTranscript = originalTranscript || (isStreaming && streamingState?.basicInfo?.transcriptFormatted) || (isStreaming && streamingState?.basicInfo?.transcript) || '';

  // Show indicator if there's a pending annotation
  const annotationCount = (annotations?.length || 0) + (pendingAnnotation ? 1 : 0);

  const tabs = [
    { id: 'transcript', label: 'Transcript', icon: 'description' },
    { id: 'metadata', label: 'Metadata', icon: 'info' },
    { id: 'signal', label: 'Signal', icon: 'sensors' },
    { id: 'annotations', label: 'Notes', icon: 'edit_note', count: annotationCount },
    { id: 'related', label: 'Related', icon: 'hub' },
  ];

  const handleDeleteAnnotation = async (annotationId) => {
    try {
      await deleteAnnotation(annotationId);
    } catch (err) {
      actions.showToast(err.message);
    }
  };

  const handleTabClick = (tabId) => {
    // Expand the pane if collapsed
    if (infoPaneCollapsed) {
      actions.setInfoPaneCollapsed(false);
    }
    actions.setActiveInfoTab(tabId);
  };

  const handleToggle = () => {
    actions.setInfoPaneCollapsed(!infoPaneCollapsed);
  };

  const handleNavigateToRelated = useCallback(async (filename) => {
    try {
      const [data, fileAnnotations] = await Promise.all([
        fetchHistoryItem(filename),
        fetchAnnotations(filename).catch(() => []),
      ]);

      const titleMatch = data.content.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1] : filename.replace('.md', '');
      const parsedMetadata = parseMetadataForRerun(data.content, title);

      actions.setCurrentExtraction({
        markdown: data.content,
        filename,
        metadata: parsedMetadata,
        transcript: parsedMetadata.transcript || '',
        model: null,
      });

      if (data.signal) {
        actions.setSignalData(data.signal);
      } else {
        const knowledgeGraph = parseKnowledgeGraph(data.content);
        actions.setSignalData(knowledgeGraph);
      }

      actions.setAnnotations(fileAnnotations);
      actions.setView('results');
    } catch (err) {
      actions.showToast(err.message);
    }
  }, [actions]);

  return (
    <aside className={`info-pane ${infoPaneCollapsed ? 'collapsed' : ''}`}>
      <div className="info-pane-header">
        <div className="info-pane-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`info-tab ${activeInfoTab === tab.id ? 'active' : ''}`}
              data-tab={tab.id}
              onClick={() => handleTabClick(tab.id)}
            >
              <span className="material-symbols-outlined">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count > 0 && <span className="tab-count">{tab.count}</span>}
            </button>
          ))}
        </div>
        <button
          className="info-pane-toggle"
          title={infoPaneCollapsed ? 'Expand' : 'Collapse'}
          onClick={handleToggle}
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>

      <div className="info-pane-content">
        <div className={`info-tab-content ${activeInfoTab === 'transcript' ? 'active' : ''}`}>
          <TranscriptTab metadata={effectiveMetadata} transcript={effectiveTranscript} />
        </div>
        <div className={`info-tab-content ${activeInfoTab === 'metadata' ? 'active' : ''}`}>
          <MetadataTab metadata={effectiveMetadata} />
        </div>
        <div className={`info-tab-content ${activeInfoTab === 'signal' ? 'active' : ''}`}>
          <SignalTab signalData={signalData} />
        </div>
        <div className={`info-tab-content ${activeInfoTab === 'annotations' ? 'active' : ''}`}>
          <AnnotationsTab
            annotations={annotations}
            pendingAnnotation={pendingAnnotation}
            currentFilename={currentFilename}
            onDelete={handleDeleteAnnotation}
            onSave={savePendingAnnotation}
            onDiscard={discardPendingAnnotation}
            onCancel={cancelStream}
          />
        </div>
        <div className={`info-tab-content ${activeInfoTab === 'related' ? 'active' : ''}`}>
          <RelatedTab
            currentFilename={currentFilename}
            onNavigate={handleNavigateToRelated}
          />
        </div>
      </div>
    </aside>
  );
}
