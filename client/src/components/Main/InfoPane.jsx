import { useApp } from '../../context/AppContext';

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

export function InfoPane() {
  const { state, actions } = useApp();
  const { infoPaneCollapsed, activeInfoTab, currentMetadata, originalTranscript, signalData } = state;

  const tabs = [
    { id: 'transcript', label: 'Transcript', icon: 'description' },
    { id: 'metadata', label: 'Metadata', icon: 'info' },
    { id: 'signal', label: 'Signal', icon: 'sensors' },
  ];

  const handleTabClick = (tabId) => {
    actions.setActiveInfoTab(tabId);
  };

  const handleToggle = () => {
    actions.setInfoPaneCollapsed(!infoPaneCollapsed);
  };

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
          <TranscriptTab metadata={currentMetadata} transcript={originalTranscript} />
        </div>
        <div className={`info-tab-content ${activeInfoTab === 'metadata' ? 'active' : ''}`}>
          <MetadataTab metadata={currentMetadata} />
        </div>
        <div className={`info-tab-content ${activeInfoTab === 'signal' ? 'active' : ''}`}>
          <SignalTab signalData={signalData} />
        </div>
      </div>
    </aside>
  );
}
