/**
 * API interaction functions
 */
import { getElements } from "./elements.js";
import { setState, updateState } from "./state.js";
import { LLM_MODELS } from "./config.js";

export async function loadConfig() {
  const elements = getElements();

  try {
    const res = await fetch("/api/config");
    const apiConfig = await res.json();
    setState("apiConfig", apiConfig);

    // Update provider options
    Array.from(elements.providerSelect.options).forEach((opt) => {
      if (opt.value === "openai" && !apiConfig.hasOpenAI) {
        opt.disabled = true;
        opt.textContent += " (no key)";
      }
      if (opt.value === "anthropic" && !apiConfig.hasAnthropic) {
        opt.disabled = true;
        opt.textContent += " (no key)";
      }
      if (opt.value === "openrouter" && !apiConfig.hasOpenRouter) {
        opt.disabled = true;
        opt.textContent += " (no key)";
      }
    });

    // Update status
    const hasAnyKey =
      apiConfig.hasOpenAI || apiConfig.hasAnthropic || apiConfig.hasOpenRouter;
    elements.apiStatus.textContent = hasAnyKey ? "Operational" : "No API Keys";
    elements.apiStatus.className = hasAnyKey ? "status-ok" : "status-error";

    // Initialize model dropdown based on default provider selection
    const selectedProvider = elements.providerSelect.value;
    if (selectedProvider && LLM_MODELS[selectedProvider]) {
      const models = LLM_MODELS[selectedProvider];
      elements.modelSelect.disabled = false;
      elements.modelSelect.textContent = "";

      models.forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m.value;
        opt.textContent = m.label;
        elements.modelSelect.appendChild(opt);
      });

      // Default to gpt-5-nano for OpenAI
      if (selectedProvider === "openai") {
        elements.modelSelect.value = "gpt-5-nano";
      }
    }
  } catch (err) {
    console.error("Failed to load config:", err);
    elements.apiStatus.textContent = "Error";
    elements.apiStatus.className = "status-error";
  }
}

export async function loadPrompt() {
  try {
    const res = await fetch("/api/prompt");
    const data = await res.json();
    updateState({
      defaultPrompt: data.defaultPrompt,
      customPrompt: data.customPrompt,
    });
  } catch (err) {
    console.error("Failed to load prompt:", err);
  }
}
