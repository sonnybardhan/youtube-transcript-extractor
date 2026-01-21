import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useAnalysisPage } from '../../hooks/useAnalysisPage';
import { LLM_MODELS } from '../../utils/config';

const ANALYSIS_PROMPT_OPTIONS = [
  {
    id: 'similarities',
    name: 'Similarities',
    description: 'Find common themes, concepts, and ideas across selected videos',
    icon: 'join_inner',
  },
  {
    id: 'differences',
    name: 'Differences',
    description: 'Identify contrasting viewpoints, unique angles, or disagreements',
    icon: 'compare',
  },
  {
    id: 'saas',
    name: 'SaaS Ideas',
    description: 'Extract product/service opportunities based on problems discussed',
    icon: 'lightbulb',
  },
  {
    id: 'unified',
    name: 'Unified Summary',
    description: 'Merge into a single cohesive document with shared sections',
    icon: 'merge',
  },
  {
    id: 'generic',
    name: 'Generic Analysis',
    description: 'Open-ended analysis of connections between summaries',
    icon: 'psychology',
  },
];

export function AnalysisConfig() {
  const { state, actions } = useApp();
  const { startAnalysis } = useAnalysisPage();

  const {
    selectedItems,
    provider,
    model,
    analyzeSelectedPrompt,
    analyzeCustomPrompt,
    history,
  } = state;

  // Get selected filenames
  const selectedFilenames = Array.from(selectedItems);
  const selectedCount = selectedFilenames.length;

  // Get model info
  const modelInfo = useMemo(() => {
    if (!provider || !model) return null;
    return LLM_MODELS[provider]?.find((m) => m.value === model);
  }, [provider, model]);

  const isCustomPrompt = analyzeSelectedPrompt === 'custom';
  const canRun = provider && model && selectedCount >= 2 && (!isCustomPrompt || analyzeCustomPrompt.trim());

  // Get display titles for selected files
  const getFileTitle = (filename) => {
    const historyItem = history.find((h) => h.filename === filename);
    if (historyItem?.title) {
      return historyItem.title;
    }
    return filename.replace('.md', '').substring(0, 40);
  };

  // Remove a file from selection
  const handleRemoveFile = (filename) => {
    const newSelected = new Set(selectedItems);
    newSelected.delete(filename);
    actions.setSelectedItems(newSelected);
  };

  return (
    <div className="analysis-config">
      {/* Selected Summaries */}
      <div className="config-section">
        <h3>
          <span className="material-symbols-outlined">checklist</span>
          Selected Summaries ({selectedCount})
        </h3>
        {selectedCount === 0 ? (
          <div className="selection-hint">
            <span className="material-symbols-outlined">info</span>
            <p>Select summaries from the sidebar to analyze them. Use the checkboxes to select 2 or more summaries.</p>
          </div>
        ) : selectedCount === 1 ? (
          <div className="selection-hint warning">
            <span className="material-symbols-outlined">warning</span>
            <p>Select at least one more summary to run an analysis. Multi-summary analysis requires 2 or more summaries.</p>
          </div>
        ) : (
          <div className="selected-files-list">
            {selectedFilenames.slice(0, 8).map((filename) => (
              <div key={filename} className="selected-file-chip">
                <span className="material-symbols-outlined">description</span>
                <span className="filename" title={getFileTitle(filename)}>
                  {getFileTitle(filename)}
                </span>
                <button
                  className="chip-remove-btn"
                  onClick={() => handleRemoveFile(filename)}
                  title="Remove from selection"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            ))}
            {selectedCount > 8 && (
              <div className="selected-file-chip more">
                +{selectedCount - 8} more
              </div>
            )}
          </div>
        )}
      </div>

      {/* Prompt Selection */}
      <div className="config-section">
        <h3>
          <span className="material-symbols-outlined">psychology</span>
          Analysis Type
        </h3>
        <div className="prompt-options">
          {ANALYSIS_PROMPT_OPTIONS.map((option) => (
            <label
              key={option.id}
              className={`prompt-option ${analyzeSelectedPrompt === option.id ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name="promptType"
                value={option.id}
                checked={analyzeSelectedPrompt === option.id}
                onChange={() => actions.setAnalyzeSelectedPrompt(option.id)}
              />
              <span className="material-symbols-outlined">{option.icon}</span>
              <div className="prompt-option-content">
                <span className="prompt-option-name">{option.name}</span>
                <span className="prompt-option-desc">{option.description}</span>
              </div>
            </label>
          ))}
          <label
            className={`prompt-option ${analyzeSelectedPrompt === 'custom' ? 'selected' : ''}`}
          >
            <input
              type="radio"
              name="promptType"
              value="custom"
              checked={analyzeSelectedPrompt === 'custom'}
              onChange={() => actions.setAnalyzeSelectedPrompt('custom')}
            />
            <span className="material-symbols-outlined">edit_note</span>
            <div className="prompt-option-content">
              <span className="prompt-option-name">Custom Prompt</span>
              <span className="prompt-option-desc">Write your own analysis instructions</span>
            </div>
          </label>
        </div>
      </div>

      {/* Custom Prompt Input */}
      {isCustomPrompt && (
        <div className="config-section">
          <h3>
            <span className="material-symbols-outlined">edit_note</span>
            Custom Prompt
          </h3>
          <textarea
            className="custom-prompt-input"
            placeholder="Enter your custom analysis prompt..."
            value={analyzeCustomPrompt}
            onChange={(e) => actions.setAnalyzeCustomPrompt(e.target.value)}
            rows={4}
          />
        </div>
      )}

      {/* Run Button */}
      <div className="config-actions">
        {modelInfo && (
          <div className="model-info">
            <span className="material-symbols-outlined">smart_toy</span>
            <span>Using {modelInfo.label}</span>
          </div>
        )}

        {!provider && (
          <div className="config-warning">
            <span className="material-symbols-outlined">warning</span>
            <p>Please select an LLM provider and model in the sidebar settings.</p>
          </div>
        )}

        <button
          className="run-analysis-btn"
          onClick={startAnalysis}
          disabled={!canRun}
        >
          <span className="material-symbols-outlined">play_arrow</span>
          Run Analysis
        </button>
      </div>
    </div>
  );
}
