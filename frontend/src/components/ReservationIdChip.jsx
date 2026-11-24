import { useNavigate } from 'react-router-dom';
import {
  loadSourceColors,
  resolveReservationBarColors,
  sourceLabel
} from '../constants/reservationSource';
import styles from '../styles/ReservationIdChip.module.css';

/**
 * Nº de reserva (o consulta) en chip con forma de barra del Libro.
 * - default: color de canal / estado; navega a `/reservations/:id`
 * - variant="neutral": fondo blanco (p.ej. IDs de consultas)
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
  stopPropagation = true,
  variant = 'channel'
}) {
  const navigate = useNavigate();

  if (id == null || id === '') return <span className={className}>—</span>;

  const neutral = variant === 'neutral';
  const colors = neutral
    ? null
    : resolveReservationBarColors(source, status, loadSourceColors());
  const label = `${prefix}${id}`;
  const medio = sourceLabel(source);
  const tip =
    title ||
    (neutral
      ? `Consulta ${label}`
      : status === 'FINALIZADA'
        ? `Reserva ${label} · Finalizada`
        : status === 'PENDIENTE'
          ? `Reserva ${label} · Prerreserva · ${medio}`
          : `Reserva ${label} · ${medio}`);

  const handleClick =
    onClick ||
    (!neutral && navigateToDetail
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
    neutral ? styles.neutral : '',
    !neutral && colors?.finished ? styles.finished : '',
    handleClick ? styles.clickable : '',
    className
  ]
    .filter(Boolean)
    .join(' ');

  const style = neutral
    ? undefined
    : {
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
