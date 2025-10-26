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
      case 'PENDIENTE':
        return (
          <>
            <button 
              className={`${styles.actionButton} ${styles.confirm}`}
              onClick={() => handleStatusChange('CONFIRMADA', 'confirm')}
            >
              Confirmar reserva
            </button>
            <button 
              className={`${styles.actionButton} ${styles.cancel}`}
              onClick={() => handleStatusChange('CANCELADA', 'cancel')}
            >
              Cancelar reserva
            </button>
          </>
        );

      case 'CONFIRMADA':
        return (
          <>
            <button 
              className={`${styles.actionButton} ${styles.checkIn}`}
              onClick={() => handleStatusChange('INGRESADA', 'check-in')}
            >
              Registrar check-in
            </button>
            <button 
              className={`${styles.actionButton} ${styles.cancel}`}
              onClick={() => handleStatusChange('CANCELADA', 'cancel')}
            >
              Cancelar reserva
            </button>
            {checkInPassed && (
              <button 
                className={`${styles.actionButton} ${styles.noShow}`}
                onClick={() => handleStatusChange('NO_PRESENTADA', 'no-show')}
              >
                Marcar como no presentada
              </button>
            )}
          </>
        );

      case 'INGRESADA':
        return (
          <button 
            className={`${styles.actionButton} ${styles.checkOut}`}
            onClick={() => handleStatusChange('FINALIZADA', 'check-out')}
          >
            Registrar check-out
          </button>
        );

      case 'FINALIZADA':
        return (
          <button 
            className={`${styles.actionButton} ${styles.reopen}`}
            onClick={() => handleStatusChange('INGRESADA', 'reopen')}
          >
            Reabrir estadía
          </button>
        );

      case 'CANCELADA':
        return (
          <button 
            className={`${styles.actionButton} ${styles.reactivate}`}
            onClick={() => handleStatusChange('CONFIRMADA', 'reactivate')}
          >
            Reactivar
          </button>
        );

      case 'NO_PRESENTADA':
        return (
          <button 
            className={`${styles.actionButton} ${styles.reactivate}`}
            onClick={() => handleStatusChange('CONFIRMADA', 'reactivate')}
          >
            Reactivar
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
