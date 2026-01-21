import { useToast } from '../../hooks/useToast';

export function Toast() {
  const { toast } = useToast();

  if (!toast) return null;

  const iconName = toast.type === 'success' ? 'check_circle' : 'error';

  const toastClass = toast.type === 'success' ? 'toast toast-success' : 'toast toast-error';

  return (
    <div className={toastClass}>
      <span className="material-symbols-outlined">{iconName}</span>
      <span>{toast.message}</span>
    </div>
  );
}
