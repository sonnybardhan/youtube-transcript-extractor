import { useTheme } from '../../hooks/useTheme';
import { useApp } from '../../context/AppContext';

export function SidebarFooter() {
  const { isDark, toggleTheme } = useTheme();
  const { actions } = useApp();

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
        id="settings-btn"
        onClick={() => actions.setPromptModalOpen(true)}
      >
        <span className="material-symbols-outlined">settings</span>
        <span>Settings</span>
      </button>
    </div>
  );
}
