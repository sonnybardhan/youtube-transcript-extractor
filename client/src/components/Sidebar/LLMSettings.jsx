import { useApp } from '../../context/AppContext';
import { LLM_MODELS } from '../../utils/config';

export function LLMSettings() {
  const { state, actions } = useApp();
  const { provider, model, compressionLevel, apiConfig } = state;

  const handleProviderChange = (e) => {
    const newProvider = e.target.value;
    actions.setProvider(newProvider);

    // Set default model for the new provider
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

  return (
    <div className="sidebar-settings">
      <p className="settings-label">LLM SETTINGS</p>

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
  );
}
