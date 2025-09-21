import React from 'react';
import { format, isAfter } from 'date-fns';
import styles from './ReservationStatusButtons.module.css';

const ReservationStatusButtons = ({ reservation, onStatusChange }) => {
  if (!reservation) return null;

  // Obtener la fecha de check-in del primer segmento
  const checkInDate = reservation.segments?.[0]?.startDate || reservation.checkIn;
  const today = new Date();
  const checkInPassed = checkInDate && isAfter(today, new Date(checkInDate));

  const handleStatusChange = async (newStatus, actionType) => {
    if (onStatusChange) {
      await onStatusChange(reservation.id, newStatus, actionType);
    }
  };

  const renderButtons = () => {
    switch (reservation.status) {
      case 'pendiente':
        return (
          <>
            <button 
              className={`${styles.actionButton} ${styles.confirm}`}
              onClick={() => handleStatusChange('confirmada', 'confirm')}
            >
              ✅ Confirmar reserva
            </button>
            <button 
              className={`${styles.actionButton} ${styles.cancel}`}
              onClick={() => handleStatusChange('cancelada', 'cancel')}
            >
              ❌ Cancelar reserva
            </button>
          </>
        );

      case 'confirmada':
        return (
          <>
            <button 
              className={`${styles.actionButton} ${styles.checkIn}`}
              onClick={() => handleStatusChange('ingresada', 'check-in')}
            >
              ✅ Registrar check-in
            </button>
            <button 
              className={`${styles.actionButton} ${styles.cancel}`}
              onClick={() => handleStatusChange('cancelada', 'cancel')}
            >
              ❌ Cancelar reserva
            </button>
            {checkInPassed && (
              <button 
                className={`${styles.actionButton} ${styles.noShow}`}
                onClick={() => handleStatusChange('no presentada', 'no-show')}
              >
                ⚠️ Marcar como no presentada
              </button>
            )}
          </>
        );

      case 'ingresada':
        return (
          <button 
            className={`${styles.actionButton} ${styles.checkOut}`}
            onClick={() => handleStatusChange('finalizada', 'check-out')}
          >
            ✅ Registrar check-out
          </button>
        );

      case 'finalizada':
        return (
          <button 
            className={`${styles.actionButton} ${styles.reopen}`}
            onClick={() => handleStatusChange('ingresada', 'reopen')}
          >
            🔄 Reabrir estadía
          </button>
        );

      case 'cancelada':
        return (
          <button 
            className={`${styles.actionButton} ${styles.reactivate}`}
            onClick={() => handleStatusChange('confirmada', 'reactivate')}
          >
            🔄 Reactivar
          </button>
        );

      case 'no presentada':
        return (
          <button 
            className={`${styles.actionButton} ${styles.reactivate}`}
            onClick={() => handleStatusChange('confirmada', 'reactivate')}
          >
            🔄 Reactivar
          </button>
        );

      default:
        return null;
    }
  };

  const buttons = renderButtons();
  if (!buttons) return null;

  return (
    <div className={styles.statusButtonsContainer}>
      <div className={styles.buttonsGrid}>
        {buttons}
      </div>
    </div>
  );
};

export default ReservationStatusButtons;
