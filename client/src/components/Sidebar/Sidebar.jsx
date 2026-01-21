import { useApp } from '../../context/AppContext';
import { SidebarHeader } from './SidebarHeader';
import { HistorySection } from './HistorySection';
import { LLMSettings } from './LLMSettings';
import { SidebarFooter } from './SidebarFooter';

export function Sidebar() {
  const { actions } = useApp();

  const handleNewExtraction = () => {
    actions.clearCurrent();
    actions.setView('input');
  };

  return (
    <aside className="sidebar">
      <SidebarHeader />

      <div className="sidebar-content">
        <button className="new-extraction-btn" onClick={handleNewExtraction}>
          <span className="material-symbols-outlined">add</span>
          <span>New Extraction</span>
        </button>

        <HistorySection />
      </div>

      <LLMSettings />
      <SidebarFooter />
    </aside>
  );
}
