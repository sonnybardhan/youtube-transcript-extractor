import { useApp } from '../context/AppContext';

export function useToast() {
  const { state, actions } = useApp();

  return {
    toast: state.toast,
    showToast: actions.showToast,
    clearToast: actions.clearToast,
  };
}
