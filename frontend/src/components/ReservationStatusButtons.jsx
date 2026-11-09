import React, { useEffect, useRef, useState } from 'react';
import { isAfter } from 'date-fns';
import { FaChevronDown, FaTrash } from 'react-icons/fa';
import { getStatusLabel } from '../utils/reservationStatusUtils';
import styles from './ReservationStatusButtons.module.css';

const getStatusOptions = (status, checkInPassed) => {
  switch (status) {
    case 'PENDIENTE':
      return [
        { status: 'CONFIRMADA', actionType: 'confirm', label: 'Confirmar' },
        { status: 'CANCELADA', actionType: 'cancel', label: 'Cancelar', danger: true },
      ];
    case 'CONFIRMADA':
      return [
        { status: 'INGRESADA', actionType: 'check-in', label: 'Check-in' },
        ...(checkInPassed
          ? [{ status: 'NO_PRESENTADA', actionType: 'no-show', label: 'No-show', danger: true }]
          : []),
        { status: 'CANCELADA', actionType: 'cancel', label: 'Cancelar', danger: true },
      ];
    case 'INGRESADA':
      return [
        { status: 'FINALIZADA', actionType: 'check-out', label: 'Registrar check-out' },
        { status: 'CANCELADA', actionType: 'cancel', label: 'Cancelar', danger: true },
      ];
    case 'FINALIZADA':
      return [
        { status: 'INGRESADA', actionType: 'reopen', label: 'Reabrir estadía' },
      ];
    case 'CANCELADA':
    case 'NO_PRESENTADA':
      return [
        { status: 'CONFIRMADA', actionType: 'reactivate', label: 'Reactivar' },
      ];
    default:
      return [];
  }
};

const ReservationStatusButtons = ({ reservation, onStatusChange, onDelete, variant = 'light' }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

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

  const checkInDate = reservation.segments?.[0]?.startDate || reservation.checkIn;
  const checkInPassed = checkInDate && isAfter(new Date(), new Date(checkInDate));
  const options = getStatusOptions(reservation.status, checkInPassed);

  const handleSelect = async (option) => {
    setOpen(false);
    if (onStatusChange) {
      await onStatusChange(reservation.id, option.status, option.actionType);
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
        <span className={styles.triggerLabel}>{getStatusLabel(reservation.status)}</span>
        <FaChevronDown className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} />
      </button>

      {open && (
        <div className={styles.dropdownMenu} role="menu">
          {options.map((option) => (
            <button
              key={`${option.actionType}-${option.status}`}
              type="button"
              role="menuitem"
              className={`${styles.dropdownItem} ${option.danger ? styles.dangerItem : ''}`}
              onClick={() => handleSelect(option)}
            >
              {option.label}
            </button>
          ))}
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
