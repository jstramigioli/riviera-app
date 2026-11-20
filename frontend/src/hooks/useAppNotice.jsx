import { useCallback, useRef, useState } from 'react';
import NotificationModal from '../components/NotificationModal';
import AppToast from '../components/AppToast';

const DEFAULT_TOAST_MS = 2800;

/**
 * Cartel in-app (reemplazo de window.alert) para feedback post-acción.
 * Uso: const { notify, noticeDialog } = useAppNotice();
 *      notify({ title: 'Listo', message: 'Cargo eliminado', type: 'success' });
 *      notify({ message: '...', type: 'success', onClose: () => navigate('/...') });
 *      notify({ message: 'Copiado', type: 'success', autoDismiss: true }); // toast abajo
 */
export function useAppNotice() {
  const [notice, setNotice] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'success',
    autoDismiss: false,
    duration: DEFAULT_TOAST_MS,
  });
  const onCloseRef = useRef(null);

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
    const autoDismiss =
      typeof options === 'object' && Boolean(options?.autoDismiss);
    const duration =
      typeof options === 'object' && Number.isFinite(options?.duration)
        ? options.duration
        : DEFAULT_TOAST_MS;
    onCloseRef.current =
      typeof options === 'object' && options?.onClose ? options.onClose : null;

    setNotice({
      isOpen: true,
      title,
      message,
      type,
      autoDismiss,
      duration,
    });
  }, []);

  const closeNotice = useCallback(() => {
    setNotice((prev) => ({ ...prev, isOpen: false }));
    const cb = onCloseRef.current;
    onCloseRef.current = null;
    if (typeof cb === 'function') cb();
  }, []);

  const noticeDialog = notice.autoDismiss ? (
    <AppToast
      isOpen={notice.isOpen}
      message={notice.message || notice.title}
      type={notice.type}
      duration={notice.duration}
      onClose={closeNotice}
    />
  ) : (
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
