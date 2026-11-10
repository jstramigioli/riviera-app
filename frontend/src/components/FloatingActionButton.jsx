import { useEffect, useId, useRef, useState } from 'react';
import { FiPlus, FiX, FiFileText, FiCalendar, FiShoppingCart } from 'react-icons/fi';
import styles from '../styles/FloatingActionButton.module.css';

/**
 * Hub flotante del Libro: Hoy arriba del +; el + abre menú de alta.
 */
export default function FloatingActionButton({
  onToday,
  onCreateQuery,
  onCreateReservation,
  onCreateConsumption
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;

    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  const run = (fn) => {
    setOpen(false);
    if (typeof fn === 'function') fn();
  };

  const actions = [
    {
      key: 'consulta',
      label: 'Nueva consulta',
      icon: FiFileText,
      onSelect: onCreateQuery
    },
    {
      key: 'reserva',
      label: 'Nueva reserva',
      icon: FiCalendar,
      onSelect: onCreateReservation
    },
    {
      key: 'consumo',
      label: 'Nuevo consumo',
      icon: FiShoppingCart,
      onSelect: onCreateConsumption
    }
  ];

  return (
    <div className={styles.floatingActionContainer} ref={rootRef}>
      <button
        type="button"
        className={styles.todayButton}
        onClick={() => run(onToday)}
        aria-label="Ir a hoy"
        title="Hoy"
      >
        Hoy
      </button>

      <div
        id={menuId}
        className={`${styles.actionButtons} ${open ? styles.expanded : ''}`}
        role="menu"
        aria-hidden={!open}
      >
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.key}
              type="button"
              role="menuitem"
              className={styles.actionButton}
              tabIndex={open ? 0 : -1}
              onClick={() => run(action.onSelect)}
            >
              <span className={styles.actionIcon} aria-hidden="true">
                <Icon />
              </span>
              <span className={styles.actionLabel}>{action.label}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className={`${styles.mainButton} ${open ? styles.expanded : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Cerrar menú' : 'Abrir menú de altas'}
        aria-expanded={open}
        aria-controls={menuId}
        title={open ? 'Cerrar' : 'Nuevo'}
      >
        <span className={styles.plusIcon} aria-hidden="true">
          {open ? <FiX /> : <FiPlus />}
        </span>
      </button>
    </div>
  );
}
