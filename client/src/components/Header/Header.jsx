import { useApp } from '../../context/AppContext';
import { useTheme } from '../../hooks/useTheme';

export function Header() {
  const { state, actions } = useApp();
  const { selectedItems, currentPage } = state;
  const { isDark, toggleTheme } = useTheme();

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

  const handleNetworkClick = () => {
    actions.setCurrentPage('graph');
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
        <button
          className={`header-action ${currentPage === 'graph' ? 'active' : ''}`}
          onClick={handleNetworkClick}
          title="View network graph of connected documents"
        >
          <span className="material-symbols-outlined">hub</span>
          <span className="header-action-label">Network</span>
        </button>
        <button className="header-action icon-only" onClick={toggleTheme} title="Toggle light/dark mode">
          <span className="material-symbols-outlined">{isDark ? 'light_mode' : 'dark_mode'}</span>
        </button>
      </div>
    </header>
  );
}
