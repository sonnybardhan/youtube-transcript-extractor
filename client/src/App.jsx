import { AppProvider } from './context/AppContext';
import { Sidebar } from './components/Sidebar/Sidebar';
import { MainContent } from './components/Main/MainContent';
import { PromptModal } from './components/Modals/PromptModal';
import { DeleteModal } from './components/Modals/DeleteModal';
import { StreamlinerModal } from './components/MetadataStreamliner';
import { Toast } from './components/common/Toast';
import './styles.css';

function App() {
  return (
    <AppProvider>
      <div className="app-container">
        <Sidebar />
        <MainContent />
      </div>

      {/* Modals */}
      <PromptModal />
      <DeleteModal />
      <StreamlinerModal />

      {/* Toast notifications */}
      <Toast />
    </AppProvider>
  );
}

export default App;
