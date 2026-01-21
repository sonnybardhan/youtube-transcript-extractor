import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { useApp } from '../../context/AppContext';
import { useMetadataStreamliner } from '../../hooks/useMetadataStreamliner';
import { LLM_MODELS } from '../../utils/config';

export function SidebarFooter() {
  const { isDark, toggleTheme } = useTheme();
  const { state, actions } = useApp();
  const { openModal } = useMetadataStreamliner();
  const [showLLMPopup, setShowLLMPopup] = useState(false);
  const popupRef = useRef(null);
  const buttonRef = useRef(null);

  const { provider, model, compressionLevel, apiConfig } = state;

  const handleExploreClick = () => {
    actions.setCurrentPage('explorer');
  };

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        showLLMPopup &&
        popupRef.current &&
        !popupRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setShowLLMPopup(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLLMPopup]);

  // LLM Settings handlers
  const handleProviderChange = (e) => {
    const newProvider = e.target.value;
    actions.setProvider(newProvider);
    if (newProvider && LLM_MODELS[newProvider]?.length > 0) {
      const defaultModel = newProvider === 'openai' ? 'gpt-5-nano' : LLM_MODELS[newProvider][0].value;
      actions.setModel(defaultModel);
    } else {
      actions.setModel('');
    }
  };

  const handleModelChange = (e) => {
    actions.setModel(e.target.value);
  };

  const handleCompressionChange = (e) => {
    actions.setCompression(parseInt(e.target.value, 10));
  };

  const isProviderDisabled = (prov) => {
    if (prov === 'openai' && !apiConfig.hasOpenAI) return true;
    if (prov === 'anthropic' && !apiConfig.hasAnthropic) return true;
    if (prov === 'openrouter' && !apiConfig.hasOpenRouter) return true;
    return false;
  };

  const getProviderLabel = (prov, label) => {
    if (isProviderDisabled(prov)) return `${label} (no key)`;
    return label;
  };

  const models = provider ? LLM_MODELS[provider] || [] : [];
  const currentModelInfo = models.find((m) => m.value === model);

  return (
    <div className="sidebar-footer">
      <button
        ref={buttonRef}
        className={`sidebar-footer-btn llm-btn ${showLLMPopup ? 'active' : ''}`}
        id="llm-settings-btn"
        title="LLM Settings"
        onClick={() => setShowLLMPopup(!showLLMPopup)}
      >
        <span className="material-symbols-outlined">smart_toy</span>
        {provider && currentModelInfo && (
          <span className="llm-btn-label">{currentModelInfo.label}</span>
        )}
        {!provider && <span className="llm-btn-label">Raw</span>}
      </button>

      {showLLMPopup && (
        <div className="llm-popup" ref={popupRef}>
          <div className="llm-popup-header">
            <span className="material-symbols-outlined">smart_toy</span>
            <span>LLM Settings</span>
          </div>
          <div className="llm-popup-content">
            <div className="settings-group">
              <label>Provider</label>
              <div className="select-wrapper compact">
                <select value={provider} onChange={handleProviderChange}>
                  <option value="">None (Raw)</option>
                  <option value="openai" disabled={isProviderDisabled('openai')}>
                    {getProviderLabel('openai', 'OpenAI')}
                  </option>
                  <option value="anthropic" disabled={isProviderDisabled('anthropic')}>
                    {getProviderLabel('anthropic', 'Anthropic')}
                  </option>
                  <option value="openrouter" disabled={isProviderDisabled('openrouter')}>
                    {getProviderLabel('openrouter', 'OpenRouter')}
                  </option>
                </select>
                <span className="material-symbols-outlined">expand_more</span>
              </div>
            </div>

            <div className="settings-group">
              <label>Model</label>
              <div className="select-wrapper compact">
                <select
                  value={model}
                  onChange={handleModelChange}
                  disabled={!provider || models.length === 0}
                >
                  {!provider && <option value="">Select provider</option>}
                  {models.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined">expand_more</span>
              </div>
            </div>

            <div className="settings-group">
              <label>Detail Level</label>
              <div className="slider-wrapper compact">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={compressionLevel}
                  onChange={handleCompressionChange}
                />
                <span className="slider-value">{compressionLevel}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        className="sidebar-footer-btn"
        id="explore-btn"
        title="Explore Metadata"
        onClick={handleExploreClick}
      >
        <span className="material-symbols-outlined">hub</span>
      </button>
      <button
        className="sidebar-footer-btn"
        id="streamliner-btn"
        title="Streamline metadata across all documents"
        onClick={openModal}
      >
        <span className="material-symbols-outlined">auto_fix_high</span>
      </button>
      <button
        className="sidebar-footer-btn"
        id="theme-toggle-btn"
        title="Toggle light/dark mode"
        onClick={toggleTheme}
      >
        <span className="material-symbols-outlined">
          {isDark ? 'light_mode' : 'dark_mode'}
        </span>
      </button>
    </div>
  );
}
