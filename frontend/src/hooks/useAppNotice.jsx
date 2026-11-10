import { useCallback, useState } from 'react';
import NotificationModal from '../components/NotificationModal';

/**
 * Cartel in-app (reemplazo de window.alert) para feedback post-acción.
 * Uso: const { notify, noticeDialog } = useAppNotice();
 *      notify({ title: 'Listo', message: 'Cargo eliminado', type: 'success' });
 */
export function useAppNotice() {
  const [notice, setNotice] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'success',
  });

  const notify = useCallback((options = {}) => {
    const message = typeof options === 'string' ? options : options.message || '';
    const title =
      typeof options === 'string'
        ? 'Aviso'
        : options.title ||
          (options.type === 'error'
            ? 'Error'
            : options.type === 'warning'
              ? 'Atención'
              : 'Aviso');
    const type = typeof options === 'string' ? 'info' : options.type || 'info';

    setNotice({
      isOpen: true,
      title,
      message,
      type,
    });
  }, []);

  const closeNotice = useCallback(() => {
    setNotice((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const noticeDialog = (
    <NotificationModal
      isOpen={notice.isOpen}
      onClose={closeNotice}
      title={notice.title}
      message={notice.message}
      type={notice.type}
    />
  );

  return { notify, noticeDialog, closeNotice };
}

export default useAppNotice;
