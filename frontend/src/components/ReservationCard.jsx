import React, { useCallback } from 'react';
import { getStatusLabel } from "../utils/reservationStatusUtils";
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import styles from '../styles/ReservationCard.module.css';

const ReservationCard = React.memo(function ReservationCard({
  reservation,
  onEdit,
  onDelete,
  onView,
  isSelected = false,
  showActions = true
}) {
  const handleEdit = useCallback((e) => {
    e.stopPropagation();
    onEdit?.(reservation);
  }, [reservation, onEdit]);

  const handleDelete = useCallback((e) => {
    e.stopPropagation();
    if (window.confirm('¿Está seguro de que desea eliminar esta reserva?')) {
      onDelete?.(reservation.id);
    }
  }, [reservation.id, onDelete]);

  const handleView = useCallback(() => {
    onView?.(reservation);
  }, [reservation, onView]);

  const duration = differenceInDays(
    new Date(reservation.checkOut),
    new Date(reservation.checkIn)
  );

  const getStatusColor = () => {
    const today = new Date();
    const checkIn = new Date(reservation.checkIn);
    const checkOut = new Date(reservation.checkOut);

    if (checkIn <= today && today <= checkOut) {
      return 'active';
    } else if (checkIn > today) {
      return 'upcoming';
    } else {
      return 'past';
    }
  };

  const statusColor = getStatusColor();

  return (
    <div 
      className={`${styles.card} ${isSelected ? styles.selected : ''} ${styles[statusColor]}`}
      onClick={handleView}
    >
      <div className={styles.header}>
        <h3 className={styles.guestName}>
          {reservation.mainClient?.firstName} {reservation.mainClient?.lastName}
        </h3>
        <span className={`${styles.status} ${styles[statusColor]}`}>
          {getStatusLabel(reservation.status)}
          {statusColor === 'upcoming' && '🔵 Próxima'}
          {statusColor === 'past' && '⚫ Pasada'}
        </span>
      </div>

      <div className={styles.details}>
        <div className={styles.dateRange}>
          <div className={styles.date}>
            <span className={styles.label}>Check-in:</span>
            <span className={styles.value}>
              {format(new Date(reservation.checkIn), 'dd/MM/yyyy', { locale: es })}
            </span>
          </div>
          <div className={styles.date}>
            <span className={styles.label}>Check-out:</span>
            <span className={styles.value}>
              {format(new Date(reservation.checkOut), 'dd/MM/yyyy', { locale: es })}
            </span>
          </div>
        </div>

        <div className={styles.info}>
          <div className={styles.room}>
            <span className={styles.label}>Habitación:</span>
            <span className={styles.value}>{reservation.room?.name || 'N/A'}</span>
          </div>
          <div className={styles.duration}>
            <span className={styles.label}>Duración:</span>
            <span className={styles.value}>{duration} {duration === 1 ? 'noche' : 'noches'}</span>
          </div>
        </div>

        {reservation.notes && (
          <div className={styles.notes}>
            <span className={styles.label}>Notas:</span>
            <span className={styles.value}>{reservation.notes}</span>
          </div>
        )}
      </div>

      {showActions && (
        <div className={styles.actions}>
          <button 
            className={`${styles.actionButton} ${styles.edit}`}
            onClick={handleEdit}
            title="Editar reserva"
          >
            ✏️
          </button>
          <button 
            className={`${styles.actionButton} ${styles.delete}`}
            onClick={handleDelete}
            title="Eliminar reserva"
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Comparación personalizada para optimizar re-renders
  return (
    prevProps.reservation.id === nextProps.reservation.id &&
    prevProps.reservation.checkIn === nextProps.reservation.checkIn &&
    prevProps.reservation.checkOut === nextProps.reservation.checkOut &&
    prevProps.reservation.mainClient?.firstName === nextProps.reservation.mainClient?.firstName &&
    prevProps.reservation.mainClient?.lastName === nextProps.reservation.mainClient?.lastName &&
    prevProps.reservation.room?.name === nextProps.reservation.room?.name &&
    prevProps.reservation.notes === nextProps.reservation.notes &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.showActions === nextProps.showActions &&
    prevProps.onEdit === nextProps.onEdit &&
    prevProps.onDelete === nextProps.onDelete &&
    prevProps.onView === nextProps.onView
  );
});

export default ReservationCard; 