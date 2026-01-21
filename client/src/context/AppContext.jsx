import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { fetchConfig, fetchPrompt, fetchHistory } from '../utils/api';
import { DEFAULT_PROVIDER, DEFAULT_MODEL, DEFAULT_COMPRESSION } from '../utils/config';

// Initial state
const initialState = {
  // API config
  apiConfig: { hasOpenAI: false, hasAnthropic: false, hasOpenRouter: false },

  // LLM settings
  provider: DEFAULT_PROVIDER,
  model: DEFAULT_MODEL,
  compressionLevel: DEFAULT_COMPRESSION,

  // Prompts
  defaultPrompt: '',
  customPrompt: null,

  // Current extraction
  currentFilename: null,
  currentMarkdown: '',
  currentMetadata: null,
  originalTranscript: '',
  currentModel: null,

  // History
  history: [],
  selectedItems: new Set(),
  searchQuery: '',

  // UI state
  view: 'input', // 'input' | 'results'
  isLoading: false,
  loadingMessage: 'Loading...',
  processingFilename: null,

  // Streaming
  streamingState: null,
  isStreaming: false,

  // Modals
  promptModalOpen: false,
  deleteModalOpen: false,
  deleteModalData: null,

  // Toast
  toast: null,

  // Theme
  theme: 'dark',

  // Info pane
  infoPaneCollapsed: false,
  activeInfoTab: 'transcript',

  // Signal data
  signalData: null,
};

// Action types
const ActionTypes = {
  SET_API_CONFIG: 'SET_API_CONFIG',
  SET_PROVIDER: 'SET_PROVIDER',
  SET_MODEL: 'SET_MODEL',
  SET_COMPRESSION: 'SET_COMPRESSION',
  SET_PROMPTS: 'SET_PROMPTS',
  SET_CUSTOM_PROMPT: 'SET_CUSTOM_PROMPT',
  SET_CURRENT_EXTRACTION: 'SET_CURRENT_EXTRACTION',
  SET_HISTORY: 'SET_HISTORY',
  SET_SELECTED_ITEMS: 'SET_SELECTED_ITEMS',
  SET_SEARCH_QUERY: 'SET_SEARCH_QUERY',
  SET_VIEW: 'SET_VIEW',
  SET_LOADING: 'SET_LOADING',
  SET_PROCESSING_FILENAME: 'SET_PROCESSING_FILENAME',
  SET_STREAMING_STATE: 'SET_STREAMING_STATE',
  SET_IS_STREAMING: 'SET_IS_STREAMING',
  SET_PROMPT_MODAL: 'SET_PROMPT_MODAL',
  SET_DELETE_MODAL: 'SET_DELETE_MODAL',
  SET_TOAST: 'SET_TOAST',
  SET_THEME: 'SET_THEME',
  SET_INFO_PANE_COLLAPSED: 'SET_INFO_PANE_COLLAPSED',
  SET_ACTIVE_INFO_TAB: 'SET_ACTIVE_INFO_TAB',
  SET_SIGNAL_DATA: 'SET_SIGNAL_DATA',
  CLEAR_CURRENT: 'CLEAR_CURRENT',
  UPDATE_STATE: 'UPDATE_STATE',
};

// Reducer
function appReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_API_CONFIG:
      return { ...state, apiConfig: action.payload };

    case ActionTypes.SET_PROVIDER:
      return { ...state, provider: action.payload };

    case ActionTypes.SET_MODEL:
      return { ...state, model: action.payload };

    case ActionTypes.SET_COMPRESSION:
      return { ...state, compressionLevel: action.payload };

    case ActionTypes.SET_PROMPTS:
      return {
        ...state,
        defaultPrompt: action.payload.defaultPrompt,
        customPrompt: action.payload.customPrompt,
      };

    case ActionTypes.SET_CUSTOM_PROMPT:
      return { ...state, customPrompt: action.payload };

    case ActionTypes.SET_CURRENT_EXTRACTION:
      return {
        ...state,
        currentFilename: action.payload.filename ?? state.currentFilename,
        currentMarkdown: action.payload.markdown ?? state.currentMarkdown,
        currentMetadata: action.payload.metadata ?? state.currentMetadata,
        originalTranscript: action.payload.transcript ?? state.originalTranscript,
        currentModel: action.payload.model ?? state.currentModel,
      };

    case ActionTypes.SET_HISTORY:
      return { ...state, history: action.payload };

    case ActionTypes.SET_SELECTED_ITEMS:
      return { ...state, selectedItems: action.payload };

    case ActionTypes.SET_SEARCH_QUERY:
      return { ...state, searchQuery: action.payload };

    case ActionTypes.SET_VIEW:
      return { ...state, view: action.payload };

    case ActionTypes.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload.isLoading,
        loadingMessage: action.payload.message ?? state.loadingMessage,
      };

    case ActionTypes.SET_PROCESSING_FILENAME:
      return { ...state, processingFilename: action.payload };

    case ActionTypes.SET_STREAMING_STATE:
      return { ...state, streamingState: action.payload };

    case ActionTypes.SET_IS_STREAMING:
      return { ...state, isStreaming: action.payload };

    case ActionTypes.SET_PROMPT_MODAL:
      return { ...state, promptModalOpen: action.payload };

    case ActionTypes.SET_DELETE_MODAL:
      return {
        ...state,
        deleteModalOpen: action.payload.open,
        deleteModalData: action.payload.data ?? state.deleteModalData,
      };

    case ActionTypes.SET_TOAST:
      return { ...state, toast: action.payload };

    case ActionTypes.SET_THEME:
      return { ...state, theme: action.payload };

    case ActionTypes.SET_INFO_PANE_COLLAPSED:
      return { ...state, infoPaneCollapsed: action.payload };

    case ActionTypes.SET_ACTIVE_INFO_TAB:
      return { ...state, activeInfoTab: action.payload };

    case ActionTypes.SET_SIGNAL_DATA:
      return { ...state, signalData: action.payload };

    case ActionTypes.CLEAR_CURRENT:
      return {
        ...state,
        currentFilename: null,
        currentMarkdown: '',
        currentMetadata: null,
        originalTranscript: '',
        currentModel: null,
        signalData: null,
      };

    case ActionTypes.UPDATE_STATE:
      return { ...state, ...action.payload };

    default:
      return state;
  }
}

// Context
const AppContext = createContext(null);

// Provider component
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const abortControllerRef = useRef(null);

  // Action creators
  const actions = {
    setApiConfig: (config) =>
      dispatch({ type: ActionTypes.SET_API_CONFIG, payload: config }),

    setProvider: (provider) =>
      dispatch({ type: ActionTypes.SET_PROVIDER, payload: provider }),

    setModel: (model) =>
      dispatch({ type: ActionTypes.SET_MODEL, payload: model }),

    setCompression: (level) =>
      dispatch({ type: ActionTypes.SET_COMPRESSION, payload: level }),

    setPrompts: (prompts) =>
      dispatch({ type: ActionTypes.SET_PROMPTS, payload: prompts }),

    setCustomPrompt: (prompt) =>
      dispatch({ type: ActionTypes.SET_CUSTOM_PROMPT, payload: prompt }),

    setCurrentExtraction: (data) =>
      dispatch({ type: ActionTypes.SET_CURRENT_EXTRACTION, payload: data }),

    setHistory: (history) =>
      dispatch({ type: ActionTypes.SET_HISTORY, payload: history }),

    setSelectedItems: (items) =>
      dispatch({ type: ActionTypes.SET_SELECTED_ITEMS, payload: items }),

    setSearchQuery: (query) =>
      dispatch({ type: ActionTypes.SET_SEARCH_QUERY, payload: query }),

    setView: (view) =>
      dispatch({ type: ActionTypes.SET_VIEW, payload: view }),

    setLoading: (isLoading, message) =>
      dispatch({ type: ActionTypes.SET_LOADING, payload: { isLoading, message } }),

    setProcessingFilename: (filename) =>
      dispatch({ type: ActionTypes.SET_PROCESSING_FILENAME, payload: filename }),

    setStreamingState: (state) =>
      dispatch({ type: ActionTypes.SET_STREAMING_STATE, payload: state }),

    setIsStreaming: (isStreaming) =>
      dispatch({ type: ActionTypes.SET_IS_STREAMING, payload: isStreaming }),

    setPromptModalOpen: (open) =>
      dispatch({ type: ActionTypes.SET_PROMPT_MODAL, payload: open }),

    setDeleteModal: (open, data = null) =>
      dispatch({ type: ActionTypes.SET_DELETE_MODAL, payload: { open, data } }),

    showToast: (message, type = 'error') => {
      dispatch({ type: ActionTypes.SET_TOAST, payload: { message, type } });
      setTimeout(() => {
        dispatch({ type: ActionTypes.SET_TOAST, payload: null });
      }, 5000);
    },

    clearToast: () =>
      dispatch({ type: ActionTypes.SET_TOAST, payload: null }),

    setTheme: (theme) => {
      dispatch({ type: ActionTypes.SET_THEME, payload: theme });
      document.documentElement.className = theme;
      localStorage.setItem('theme', theme);
    },

    toggleTheme: () => {
      const newTheme = state.theme === 'dark' ? 'light' : 'dark';
      actions.setTheme(newTheme);
    },

    setInfoPaneCollapsed: (collapsed) =>
      dispatch({ type: ActionTypes.SET_INFO_PANE_COLLAPSED, payload: collapsed }),

    setActiveInfoTab: (tab) =>
      dispatch({ type: ActionTypes.SET_ACTIVE_INFO_TAB, payload: tab }),

    setSignalData: (data) =>
      dispatch({ type: ActionTypes.SET_SIGNAL_DATA, payload: data }),

    clearCurrent: () =>
      dispatch({ type: ActionTypes.CLEAR_CURRENT }),

    updateState: (updates) =>
      dispatch({ type: ActionTypes.UPDATE_STATE, payload: updates }),

    // Abort controller management
    setAbortController: (controller) => {
      abortControllerRef.current = controller;
    },

    getAbortController: () => abortControllerRef.current,

    cancelCurrentRequest: () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        actions.setIsStreaming(false);
        actions.showToast('Request cancelled', 'info');
      }
    },
  };

  // Load initial data
  const loadInitialData = useCallback(async () => {
    try {
      const [config, prompt, history] = await Promise.all([
        fetchConfig(),
        fetchPrompt(),
        fetchHistory(),
      ]);

      actions.setApiConfig(config);
      actions.setPrompts(prompt);
      actions.setHistory(history);
    } catch (err) {
      console.error('Failed to load initial data:', err);
      actions.showToast('Failed to load initial data');
    }
  }, []);

  // Reload history
  const reloadHistory = useCallback(async () => {
    try {
      const history = await fetchHistory();
      actions.setHistory(history);
    } catch (err) {
      console.error('Failed to reload history:', err);
    }
  }, []);

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    actions.setTheme(savedTheme);
  }, []);

  // Load initial data on mount
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Restore info pane state from localStorage
  useEffect(() => {
    const savedCollapsed = localStorage.getItem('infoPaneCollapsed');
    if (savedCollapsed !== null) {
      actions.setInfoPaneCollapsed(savedCollapsed === 'true');
    }
  }, []);

  // Save info pane state to localStorage
  useEffect(() => {
    localStorage.setItem('infoPaneCollapsed', String(state.infoPaneCollapsed));
  }, [state.infoPaneCollapsed]);

  return (
    <AppContext.Provider value={{ state, actions, reloadHistory }}>
      {children}
    </AppContext.Provider>
  );
}

// Hook to use the context
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

export { ActionTypes };
