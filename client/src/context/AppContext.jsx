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

  // Annotations
  annotations: [],
  // Pending annotation being streamed (persists across page changes)
  pendingAnnotation: null, // { filename, selectedText, section, question, response, isStreaming, error }

  // Page navigation
  currentPage: 'main', // 'main' | 'explorer'

  // Metadata Explorer
  metadataIndex: null,
  explorerSelectedTerms: { concepts: [], entities: [], tags: [], categories: [] },
  explorerFilterMode: 'AND', // 'AND' | 'OR'

  // Metadata Streamliner
  streamlinerModalOpen: false,
  streamlinerPhase: 'setup', // 'setup' | 'analyzing' | 'review' | 'applying' | 'complete'
  streamlinerProgress: null, // { type, processed, total, current, message, field, count }
  streamlinerProposedChanges: null,
  streamlinerResult: null, // { updatedFiles, indexFile }

  // Multi-Summary Analysis
  analyzeModalOpen: false,
  analyzeSelectedPrompt: 'similarities',
  analyzeCustomPrompt: '',
  analyzeResponse: '',
  analyzeIsStreaming: false,
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
  SET_ANNOTATIONS: 'SET_ANNOTATIONS',
  ADD_ANNOTATION: 'ADD_ANNOTATION',
  DELETE_ANNOTATION: 'DELETE_ANNOTATION',
  SET_PENDING_ANNOTATION: 'SET_PENDING_ANNOTATION',
  UPDATE_PENDING_ANNOTATION: 'UPDATE_PENDING_ANNOTATION',
  CLEAR_PENDING_ANNOTATION: 'CLEAR_PENDING_ANNOTATION',
  CLEAR_CURRENT: 'CLEAR_CURRENT',
  UPDATE_STATE: 'UPDATE_STATE',
  SET_CURRENT_PAGE: 'SET_CURRENT_PAGE',
  SET_METADATA_INDEX: 'SET_METADATA_INDEX',
  SET_EXPLORER_SELECTED_TERMS: 'SET_EXPLORER_SELECTED_TERMS',
  SET_EXPLORER_FILTER_MODE: 'SET_EXPLORER_FILTER_MODE',
  RESET_EXPLORER: 'RESET_EXPLORER',
  SET_STREAMLINER_MODAL: 'SET_STREAMLINER_MODAL',
  SET_STREAMLINER_PHASE: 'SET_STREAMLINER_PHASE',
  SET_STREAMLINER_PROGRESS: 'SET_STREAMLINER_PROGRESS',
  SET_STREAMLINER_PROPOSED_CHANGES: 'SET_STREAMLINER_PROPOSED_CHANGES',
  SET_STREAMLINER_RESULT: 'SET_STREAMLINER_RESULT',
  RESET_STREAMLINER: 'RESET_STREAMLINER',
  // Multi-Summary Analysis
  SET_ANALYZE_MODAL: 'SET_ANALYZE_MODAL',
  SET_ANALYZE_SELECTED_PROMPT: 'SET_ANALYZE_SELECTED_PROMPT',
  SET_ANALYZE_CUSTOM_PROMPT: 'SET_ANALYZE_CUSTOM_PROMPT',
  SET_ANALYZE_RESPONSE: 'SET_ANALYZE_RESPONSE',
  SET_ANALYZE_IS_STREAMING: 'SET_ANALYZE_IS_STREAMING',
  RESET_ANALYZE: 'RESET_ANALYZE',
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

    case ActionTypes.SET_ANNOTATIONS:
      return { ...state, annotations: action.payload };

    case ActionTypes.ADD_ANNOTATION:
      return { ...state, annotations: [...state.annotations, action.payload] };

    case ActionTypes.DELETE_ANNOTATION:
      return {
        ...state,
        annotations: state.annotations.filter((a) => a.id !== action.payload),
      };

    case ActionTypes.SET_PENDING_ANNOTATION:
      return { ...state, pendingAnnotation: action.payload };

    case ActionTypes.UPDATE_PENDING_ANNOTATION:
      return {
        ...state,
        pendingAnnotation: state.pendingAnnotation
          ? { ...state.pendingAnnotation, ...action.payload }
          : null,
      };

    case ActionTypes.CLEAR_PENDING_ANNOTATION:
      return { ...state, pendingAnnotation: null };

    case ActionTypes.CLEAR_CURRENT:
      return {
        ...state,
        currentFilename: null,
        currentMarkdown: '',
        currentMetadata: null,
        originalTranscript: '',
        currentModel: null,
        signalData: null,
        annotations: [],
      };

    case ActionTypes.UPDATE_STATE:
      return { ...state, ...action.payload };

    case ActionTypes.SET_CURRENT_PAGE:
      return { ...state, currentPage: action.payload };

    case ActionTypes.SET_METADATA_INDEX:
      return { ...state, metadataIndex: action.payload };

    case ActionTypes.SET_EXPLORER_SELECTED_TERMS:
      return { ...state, explorerSelectedTerms: action.payload };

    case ActionTypes.SET_EXPLORER_FILTER_MODE:
      return { ...state, explorerFilterMode: action.payload };

    case ActionTypes.RESET_EXPLORER:
      return {
        ...state,
        explorerSelectedTerms: { concepts: [], entities: [], tags: [], categories: [] },
        explorerFilterMode: 'AND',
      };

    case ActionTypes.SET_STREAMLINER_MODAL:
      return { ...state, streamlinerModalOpen: action.payload };

    case ActionTypes.SET_STREAMLINER_PHASE:
      return { ...state, streamlinerPhase: action.payload };

    case ActionTypes.SET_STREAMLINER_PROGRESS:
      return { ...state, streamlinerProgress: action.payload };

    case ActionTypes.SET_STREAMLINER_PROPOSED_CHANGES:
      return { ...state, streamlinerProposedChanges: action.payload };

    case ActionTypes.SET_STREAMLINER_RESULT:
      return { ...state, streamlinerResult: action.payload };

    case ActionTypes.RESET_STREAMLINER:
      return {
        ...state,
        streamlinerModalOpen: false,
        streamlinerPhase: 'setup',
        streamlinerProgress: null,
        streamlinerProposedChanges: null,
        streamlinerResult: null,
      };

    // Multi-Summary Analysis
    case ActionTypes.SET_ANALYZE_MODAL:
      return { ...state, analyzeModalOpen: action.payload };

    case ActionTypes.SET_ANALYZE_SELECTED_PROMPT:
      return { ...state, analyzeSelectedPrompt: action.payload };

    case ActionTypes.SET_ANALYZE_CUSTOM_PROMPT:
      return { ...state, analyzeCustomPrompt: action.payload };

    case ActionTypes.SET_ANALYZE_RESPONSE:
      return { ...state, analyzeResponse: action.payload };

    case ActionTypes.SET_ANALYZE_IS_STREAMING:
      return { ...state, analyzeIsStreaming: action.payload };

    case ActionTypes.RESET_ANALYZE:
      return {
        ...state,
        analyzeModalOpen: false,
        analyzeSelectedPrompt: 'similarities',
        analyzeCustomPrompt: '',
        analyzeResponse: '',
        analyzeIsStreaming: false,
      };

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

    setAnnotations: (annotations) =>
      dispatch({ type: ActionTypes.SET_ANNOTATIONS, payload: annotations }),

    addAnnotation: (annotation) =>
      dispatch({ type: ActionTypes.ADD_ANNOTATION, payload: annotation }),

    deleteAnnotation: (id) =>
      dispatch({ type: ActionTypes.DELETE_ANNOTATION, payload: id }),

    setPendingAnnotation: (annotation) =>
      dispatch({ type: ActionTypes.SET_PENDING_ANNOTATION, payload: annotation }),

    updatePendingAnnotation: (updates) =>
      dispatch({ type: ActionTypes.UPDATE_PENDING_ANNOTATION, payload: updates }),

    clearPendingAnnotation: () =>
      dispatch({ type: ActionTypes.CLEAR_PENDING_ANNOTATION }),

    clearCurrent: () =>
      dispatch({ type: ActionTypes.CLEAR_CURRENT }),

    updateState: (updates) =>
      dispatch({ type: ActionTypes.UPDATE_STATE, payload: updates }),

    // Page navigation
    setCurrentPage: (page) =>
      dispatch({ type: ActionTypes.SET_CURRENT_PAGE, payload: page }),

    // Metadata Explorer actions
    setMetadataIndex: (index) =>
      dispatch({ type: ActionTypes.SET_METADATA_INDEX, payload: index }),

    setExplorerSelectedTerms: (terms) =>
      dispatch({ type: ActionTypes.SET_EXPLORER_SELECTED_TERMS, payload: terms }),

    setExplorerFilterMode: (mode) =>
      dispatch({ type: ActionTypes.SET_EXPLORER_FILTER_MODE, payload: mode }),

    resetExplorer: () =>
      dispatch({ type: ActionTypes.RESET_EXPLORER }),

    // Streamliner actions
    setStreamlinerModalOpen: (open) =>
      dispatch({ type: ActionTypes.SET_STREAMLINER_MODAL, payload: open }),

    setStreamlinerPhase: (phase) =>
      dispatch({ type: ActionTypes.SET_STREAMLINER_PHASE, payload: phase }),

    setStreamlinerProgress: (progress) =>
      dispatch({ type: ActionTypes.SET_STREAMLINER_PROGRESS, payload: progress }),

    setStreamlinerProposedChanges: (changes) =>
      dispatch({ type: ActionTypes.SET_STREAMLINER_PROPOSED_CHANGES, payload: changes }),

    setStreamlinerResult: (result) =>
      dispatch({ type: ActionTypes.SET_STREAMLINER_RESULT, payload: result }),

    resetStreamliner: () =>
      dispatch({ type: ActionTypes.RESET_STREAMLINER }),

    // Multi-Summary Analysis actions
    setAnalyzeModalOpen: (open) =>
      dispatch({ type: ActionTypes.SET_ANALYZE_MODAL, payload: open }),

    setAnalyzeSelectedPrompt: (prompt) =>
      dispatch({ type: ActionTypes.SET_ANALYZE_SELECTED_PROMPT, payload: prompt }),

    setAnalyzeCustomPrompt: (prompt) =>
      dispatch({ type: ActionTypes.SET_ANALYZE_CUSTOM_PROMPT, payload: prompt }),

    setAnalyzeResponse: (response) =>
      dispatch({ type: ActionTypes.SET_ANALYZE_RESPONSE, payload: response }),

    setAnalyzeIsStreaming: (isStreaming) =>
      dispatch({ type: ActionTypes.SET_ANALYZE_IS_STREAMING, payload: isStreaming }),

    resetAnalyze: () =>
      dispatch({ type: ActionTypes.RESET_ANALYZE }),

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
