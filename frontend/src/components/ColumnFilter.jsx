import { useCallback, useEffect, useRef, useState } from 'react';
import { FiFilter } from 'react-icons/fi';
import styles from './ColumnFilter.module.css';

/**
 * Botón de filtro para el encabezado de una columna (mismo patrón que Cobros):
 * abre un menú flotante con los controles que se pasan como children.
 * No dispara el ordenamiento del <th> (stopPropagation).
 */
export default function ColumnFilter({ label, active = false, children }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const sync = useCallback(() => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.min(rect.left, window.innerWidth - 260);
    setPos({ top: rect.bottom + 4, left: Math.max(8, left) });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    sync();
    const onPointerDown = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync, true);
    };
  }, [open, sync]);

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        className={`${styles.filterBtn} ${open ? styles.filterBtnOpen : ''} ${active ? styles.filterBtnActive : ''}`}
        aria-label={`Filtrar ${label}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <FiFilter size={13} aria-hidden="true" />
      </button>
      {open ? (
        <div
          ref={menuRef}
          className={styles.filterMenu}
          role="dialog"
          aria-label={`Filtro ${label}`}
          style={{ top: pos.top, left: pos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      ) : null}
    </>
  );
}
