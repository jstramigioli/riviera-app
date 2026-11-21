import { useCallback, useRef } from 'react';

/**
 * Cierra un modal por backdrop solo si mousedown Y mouseup fueron en el overlay.
 * Evita cerrar al arrastrar desde el diálogo hacia afuera (mouseup en backdrop).
 *
 * Uso: <div className={overlay} {...overlayDismissProps}>...</div>
 */
export function useOverlayDismiss(onDismiss, { enabled = true } = {}) {
  const mouseDownOnOverlay = useRef(false);

  const onMouseDown = useCallback((e) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  }, []);

  const onMouseUp = useCallback(
    (e) => {
      const shouldClose =
        enabled &&
        mouseDownOnOverlay.current &&
        e.target === e.currentTarget;
      mouseDownOnOverlay.current = false;
      if (shouldClose) onDismiss?.();
    },
    [onDismiss, enabled]
  );

  return { onMouseDown, onMouseUp };
}

export default useOverlayDismiss;
