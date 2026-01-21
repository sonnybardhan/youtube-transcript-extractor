import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar/Sidebar';
import { MainContent } from './components/Main/MainContent';
import { MetadataExplorerPage } from './components/MetadataExplorer';
import { PromptModal } from './components/Modals/PromptModal';
import { DeleteModal } from './components/Modals/DeleteModal';
import { AnalyzeModal } from './components/Modals/AnalyzeModal';
import { StreamlinerModal } from './components/MetadataStreamliner';
import { Toast } from './components/common/Toast';
import './styles.css';

function AppContent() {
  const { state } = useApp();
  const { currentPage } = state;

  if (currentPage === 'explorer') {
    return <MetadataExplorerPage />;
  }

  return (
    <div className="app-container">
      <Sidebar />
      <MainContent />
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
      <AnalyzeModal />
      <StreamlinerModal />

      {/* Toast notifications */}
      <Toast />
    </AppProvider>
  );
}

export default App;
