import { useApp } from '../../context/AppContext';

export function SidebarHeader() {
  const { actions } = useApp();

  const handleExploreClick = () => {
    actions.setCurrentPage('explorer');
  };

  return (
    <div className="sidebar-header">
      <div className="sidebar-header-main">
        <div className="logo-icon">
          <span className="material-symbols-outlined">smart_display</span>
        </div>
        <div className="logo-text">
          <h1>YT Extractor</h1>
          <p>v1.0.0</p>
        </div>
      </div>
      <button
        className="explore-btn"
        onClick={handleExploreClick}
        title="Explore Metadata"
      >
        <span className="material-symbols-outlined">hub</span>
      </button>
    </div>
  );
}
