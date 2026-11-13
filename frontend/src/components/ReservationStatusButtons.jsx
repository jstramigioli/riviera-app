import React, { useEffect, useRef, useState } from 'react';
import { FaChevronDown, FaTrash } from 'react-icons/fa';
import useReservationStatuses from '../hooks/useReservationStatuses';
import { getStatusLabel, isDangerStatus } from '../utils/reservationStatusUtils';
import styles from './ReservationStatusButtons.module.css';

const ReservationStatusButtons = ({
  reservation,
  onStatusChange,
  onDelete,
  variant = 'light',
  menuPlacement = 'above'
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const { statuses } = useReservationStatuses();

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!reservation) return null;

  // Todos los estados del enum BE (canónico); se puede ir "hacia atrás" (p.ej. INGRESADA → PENDIENTE)
  const options = statuses;

  const handleSelect = async (option) => {
    if (option.value === reservation.status) return;
    setOpen(false);
    if (onStatusChange) {
      await onStatusChange(reservation.id, option.value, 'set-status');
    }
  };

  const handleDelete = () => {
    setOpen(false);
    if (onDelete) onDelete(reservation);
  };

  return (
    <div className={`${styles.statusButtonsContainer} ${variant === 'dark' ? styles.onDark : ''}`} ref={rootRef}>
      <button
        type="button"
        className={`${styles.dropdownTrigger} ${styles[`tone_${reservation.status}`] || ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Cambiar estado"
      >
        <span className={styles.triggerLabel}>{getStatusLabel(reservation.status, statuses)}</span>
        <FaChevronDown className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} />
      </button>

      {open && (
        <div
          className={`${styles.dropdownMenu} ${menuPlacement === 'below' ? styles.dropdownMenuBelow : ''}`}
          role="menu"
        >
          {options.map((option) => {
            const isCurrent = option.value === reservation.status;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitem"
                aria-current={isCurrent ? 'true' : undefined}
                disabled={isCurrent}
                className={`${styles.dropdownItem} ${isDangerStatus(option.value) ? styles.dangerItem : ''} ${isCurrent ? styles.currentItem : ''}`}
                onClick={() => handleSelect(option)}
              >
                {option.label}
              </button>
            );
          })}
          {onDelete && (
            <>
              {options.length > 0 && <div className={styles.menuDivider} />}
              <button
                type="button"
                role="menuitem"
                className={`${styles.dropdownItem} ${styles.deleteItem}`}
                onClick={handleDelete}
              >
                <FaTrash />
                Eliminar
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ReservationStatusButtons;
