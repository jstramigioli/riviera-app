import { useCallback, useRef, useState } from 'react';
import ConfirmationModal from '../components/ConfirmationModal';

/**
 * Confirmación destructiva in-app (reemplazo de window.confirm).
 * Uso: const { confirm, confirmDialog } = useConfirmDialog();
 *      if (!(await confirm({ title, message }))) return;
 */
export function useConfirmDialog() {
  const resolveRef = useRef(null);
  const [state, setState] = useState({
    isOpen: false,
    title: 'Confirmar',
    message: '',
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    type: 'danger',
    confirmButtonClass: 'confirm',
  });

  const close = useCallback((result) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setState((prev) => ({ ...prev, isOpen: false }));
    if (resolve) resolve(result);
  }, []);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({
        isOpen: true,
        title: options.title || 'Confirmar',
        message: options.message || '',
        confirmText: options.confirmText || 'Eliminar',
        cancelText: options.cancelText || 'Cancelar',
        type: options.type || 'danger',
        confirmButtonClass: options.confirmButtonClass || 'confirm',
      });
    });
  }, []);

  const confirmDialog = (
    <ConfirmationModal
      isOpen={state.isOpen}
      onClose={() => close(false)}
      onConfirm={() => close(true)}
      title={state.title}
      message={state.message}
      confirmText={state.confirmText}
      cancelText={state.cancelText}
      type={state.type}
      confirmButtonClass={state.confirmButtonClass}
    />
  );

  return { confirm, confirmDialog };
}

export default useConfirmDialog;
