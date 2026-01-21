import { useApp } from '../../context/AppContext';

export function Header() {
  const { state, actions } = useApp();
  const { selectedItems, currentPage } = state;

  const handleLogoClick = () => {
    actions.clearCurrent();
    actions.setView('input');
    actions.setCurrentPage('main');
  };

  const handleNewExtraction = () => {
    actions.clearCurrent();
    actions.setView('input');
    actions.setCurrentPage('main');
  };

  const handleAnalyzeClick = () => {
    actions.setCurrentPage('analysis');
  };

  const handleSettingsClick = () => {
    actions.setPromptModalOpen(true);
  };

  const selectedCount = selectedItems.size;

  return (
    <header className="app-header">
      <div className="header-left">
        <button className="logo-btn" onClick={handleLogoClick}>
          <span className="material-symbols-outlined">smart_display</span>
          <span className="logo-text">YT Extractor</span>
        </button>
      </div>
      <div className="header-right">
        <button className="header-action" onClick={handleNewExtraction}>
          <span className="material-symbols-outlined">add</span>
          <span className="header-action-label">New</span>
        </button>
        <button
          className={`header-action ${currentPage === 'analysis' ? 'active' : ''}`}
          onClick={handleAnalyzeClick}
          title={selectedCount >= 2 ? `Analyze ${selectedCount} summaries` : 'Go to Analysis page'}
        >
          <span className="material-symbols-outlined">query_stats</span>
          <span className="header-action-label">Analyze</span>
          {selectedCount >= 2 && <span className="header-badge">{selectedCount}</span>}
        </button>
        <button className="header-action icon-only" onClick={handleSettingsClick} title="Settings">
          <span className="material-symbols-outlined">settings</span>
        </button>
      </div>
    </header>
  );
}
