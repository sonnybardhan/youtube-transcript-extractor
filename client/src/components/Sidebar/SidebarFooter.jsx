import { useTheme } from '../../hooks/useTheme';
import { useApp } from '../../context/AppContext';
import { useMetadataStreamliner } from '../../hooks/useMetadataStreamliner';

export function SidebarFooter() {
  const { isDark, toggleTheme } = useTheme();
  const { actions } = useApp();
  const { openModal } = useMetadataStreamliner();

  return (
    <div className="sidebar-footer">
      <button
        className="sidebar-footer-btn"
        id="theme-toggle-btn"
        title="Toggle light/dark mode"
        onClick={toggleTheme}
      >
        <span className="material-symbols-outlined">
          {isDark ? 'light_mode' : 'dark_mode'}
        </span>
      </button>
      <button
        className="sidebar-footer-btn"
        id="streamliner-btn"
        title="Streamline metadata across all documents"
        onClick={openModal}
      >
        <span className="material-symbols-outlined">auto_fix_high</span>
      </button>
      <button
        className="sidebar-footer-btn"
        id="settings-btn"
        onClick={() => actions.setPromptModalOpen(true)}
      >
        <span className="material-symbols-outlined">settings</span>
        <span>Settings</span>
      </button>
    </div>
  );
}
