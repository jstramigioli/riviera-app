import {
  GUEST_CHECKIN_STATUS,
  getReservationGuestCheckInLabel,
  getReservationGuestCheckInStatus
} from '../utils/reservationGuestCheckIn';
import styles from './GuestCheckInStatusCell.module.css';

/**
 * Columna Check-in: Completo / Pendiente / No enviado.
 * Si no está completo, el click abre el form interno de huésped (callback).
 */
export default function GuestCheckInStatusCell({
  reservation,
  onOpenInternalForm,
  className = ''
}) {
  const status = getReservationGuestCheckInStatus(reservation);
  const label = getReservationGuestCheckInLabel(status);
  const isComplete = status === GUEST_CHECKIN_STATUS.COMPLETO;
  const toneClass =
    status === GUEST_CHECKIN_STATUS.COMPLETO
      ? styles.completo
      : status === GUEST_CHECKIN_STATUS.PENDIENTE
        ? styles.pendiente
        : styles.noEnviado;

  if (isComplete || typeof onOpenInternalForm !== 'function') {
    return (
      <span
        className={`${styles.root} ${toneClass} ${className}`.trim()}
        data-testid="guest-checkin-status"
        data-status={status}
      >
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`${styles.root} ${styles.action} ${toneClass} ${className}`.trim()}
      data-testid="guest-checkin-status"
      data-status={status}
      onClick={(e) => {
        e.stopPropagation();
        onOpenInternalForm(reservation);
      }}
      title="Abrir check-in manual interno"
    >
      {label}
    </button>
  );
}
