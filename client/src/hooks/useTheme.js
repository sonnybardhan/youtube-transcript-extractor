import { useApp } from '../context/AppContext';

export function useTheme() {
  const { state, actions } = useApp();

  return {
    theme: state.theme,
    isDark: state.theme === 'dark',
    toggleTheme: actions.toggleTheme,
    setTheme: actions.setTheme,
  };
}
