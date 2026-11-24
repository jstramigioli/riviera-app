import { useNavigate } from 'react-router-dom';
import {
  loadSourceColors,
  resolveReservationBarColors,
  sourceLabel
} from '../constants/reservationSource';
import styles from '../styles/ReservationIdChip.module.css';

/**
 * Nº de reserva en chip con el color de barra del Libro (medio / finalizada).
 * Por defecto navega a `/reservations/:id` (clickeable en toda la app).
 */
export default function ReservationIdChip({
  id,
  source = null,
  status = null,
  onClick = null,
  title = null,
  className = '',
  'data-testid': dataTestId,
  prefix = '#',
  navigateToDetail = true,
  stopPropagation = true
}) {
  const navigate = useNavigate();

  if (id == null || id === '') return <span className={className}>—</span>;

  const colors = resolveReservationBarColors(source, status, loadSourceColors());
  const label = `${prefix}${id}`;
  const medio = sourceLabel(source);
  const tip =
    title ||
    (status === 'FINALIZADA'
      ? `Reserva ${label} · Finalizada`
      : status === 'PENDIENTE'
        ? `Reserva ${label} · Prerreserva · ${medio}`
        : `Reserva ${label} · ${medio}`);

  const handleClick =
    onClick ||
    (navigateToDetail
      ? (event) => {
          if (stopPropagation && event) {
            event.stopPropagation();
            event.preventDefault?.();
          }
          navigate(`/reservations/${id}`);
        }
      : null);

  const classNames = [
    styles.chip,
    colors.finished ? styles.finished : '',
    handleClick ? styles.clickable : '',
    className
  ]
    .filter(Boolean)
    .join(' ');

  const style = {
    backgroundColor: colors.backgroundColor,
    borderColor: colors.borderColor,
    color: colors.color
  };

  if (handleClick) {
    return (
      <button
        type="button"
        className={classNames}
        style={style}
        onClick={handleClick}
        title={tip}
        data-testid={dataTestId}
      >
        {label}
      </button>
    );
  }

  return (
    <span className={classNames} style={style} title={tip} data-testid={dataTestId}>
      {label}
    </span>
  );
}
