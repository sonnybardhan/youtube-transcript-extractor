import { useToast } from '../../hooks/useToast';

export function Toast() {
  const { toast } = useToast();

  if (!toast) return null;

  const iconName = toast.type === 'success' ? 'check_circle' : 'error';

  return (
    <div className="toast">
      <span className="material-symbols-outlined">{iconName}</span>
      <span>{toast.message}</span>
    </div>
  );
}
