import { useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Sidebar } from '../Sidebar/Sidebar';
import { AnalysisConfig } from './AnalysisConfig';
import { AnalysisOutput } from './AnalysisOutput';
import { AnalysisViewer } from './AnalysisViewer';
import { SavedAnalysesList } from './SavedAnalysesList';

export function AnalysisPage() {
  const { state, actions } = useApp();
  const { savedAnalyses, analyzeResponse, analyzeIsStreaming, currentAnalysis } = state;

  // Load saved analyses when page mounts
  useEffect(() => {
    actions.loadSavedAnalyses();
  }, []);

  // Determine what to show in the main area
  const showStreaming = analyzeResponse || analyzeIsStreaming;
  const showViewer = currentAnalysis && !showStreaming;
  const showConfig = !showStreaming && !showViewer;

  return (
    <div className="analysis-page">
      <Sidebar />
      <main className="analysis-main">
        <div className="analysis-main-header">
          <h2>
            <span className="material-symbols-outlined">query_stats</span>
            Multi-Summary Analysis
          </h2>
          <p>Cross-reference selected summaries using AI analysis</p>
        </div>

        {showConfig && <AnalysisConfig />}
        {showStreaming && <AnalysisOutput />}
        {showViewer && <AnalysisViewer />}
      </main>
      <aside className="analysis-panel">
        <div className="analysis-panel-inner">
          <SavedAnalysesList analyses={savedAnalyses} />
        </div>
      </aside>
    </div>
  );
}
