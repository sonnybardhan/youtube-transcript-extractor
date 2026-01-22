import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar/Sidebar';
import { MainContent } from './components/Main/MainContent';
import { MetadataExplorerPage } from './components/MetadataExplorer';
import { AnalysisPage } from './components/Analysis';
import { PromptModal } from './components/Modals/PromptModal';
import { DeleteModal } from './components/Modals/DeleteModal';
import { AskQuestionModal } from './components/Modals/AskQuestionModal';
import { StreamlinerModal } from './components/MetadataStreamliner';
import { Toast } from './components/common/Toast';
import './styles.css';

function MainPage() {
  return (
    <div className="main-page">
      <Sidebar />
      <MainContent />
    </div>
  );
}

function AppContent() {
  const { state } = useApp();
  const { currentPage } = state;

  return (
    <div className="app-layout">
      <Header />
      <div className="app-body">
        {currentPage === 'main' && <MainPage />}
        {currentPage === 'explorer' && <MetadataExplorerPage />}
        {currentPage === 'analysis' && <AnalysisPage />}
      </div>
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />

      {/* Modals */}
      <PromptModal />
      <DeleteModal />
      <AskQuestionModal />
      <StreamlinerModal />

      {/* Toast notifications */}
      <Toast />
    </AppProvider>
  );
}

export default App;
