import {
  loadSourceColors,
  resolveReservationBarColors,
  sourceLabel
} from '../constants/reservationSource';
import styles from '../styles/ReservationIdChip.module.css';

/**
 * Nº de reserva en chip con el color de barra del Libro (medio / finalizada).
 */
export default function ReservationIdChip({
  id,
  source = null,
  status = null,
  onClick = null,
  title = null,
  className = '',
  'data-testid': dataTestId,
  prefix = '#'
}) {
  if (id == null || id === '') return <span className={className}>—</span>;

  const colors = resolveReservationBarColors(source, status, loadSourceColors());
  const label = `${prefix}${id}`;
  const medio = sourceLabel(source);
  const tip =
    title ||
    (status === 'FINALIZADA'
      ? `Reserva ${label} · Finalizada`
      : `Reserva ${label} · ${medio}`);

  const classNames = [
    styles.chip,
    colors.finished ? styles.finished : '',
    onClick ? styles.clickable : '',
    className
  ]
    .filter(Boolean)
    .join(' ');

  const style = {
    backgroundColor: colors.backgroundColor,
    borderColor: colors.borderColor,
    color: colors.color
  };

  if (onClick) {
    return (
      <button
        type="button"
        className={classNames}
        style={style}
        onClick={onClick}
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
