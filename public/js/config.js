/**
 * LLM provider and model configuration
 */
export const LLM_MODELS = {
  openai: [
    { value: 'gpt-5', label: 'GPT-5' },
    { value: 'gpt-5-mini', label: 'GPT-5 Mini' },
    { value: 'gpt-5-nano', label: 'GPT-5 Nano' },
    { value: 'gpt-4.1', label: 'GPT-4.1' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { value: 'gpt-4o', label: 'GPT-4o (Legacy)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Legacy)' }
  ],
  anthropic: [
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { value: 'claude-haiku-4-20250514', label: 'Claude Haiku 4' }
  ],
  openrouter: [
    { value: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5' },
    { value: 'anthropic/claude-opus-4.5', label: 'Claude Opus 4.5' },
    { value: 'anthropic/claude-haiku-4.5', label: 'Claude Haiku 4.5' },
    { value: 'openai/gpt-5.2', label: 'GPT-5.2' },
    { value: 'google/gemini-3-pro-preview', label: 'Gemini 3 Pro' },
    { value: 'deepseek/deepseek-v3.2', label: 'DeepSeek V3.2' }
  ]
};
