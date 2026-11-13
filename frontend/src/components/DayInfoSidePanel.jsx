import React, { useMemo } from 'react';
import { FiArrowDown, FiArrowUp } from 'react-icons/fi';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import SidePanel from './SidePanel';
import styles from '../styles/DayInfoSidePanel.module.css';
import { isoDate } from '../utils/calendarDates';
import { computeDayInfoStats } from '../utils/dayInfoStats';

/** date-fns format() usa TZ local: construir Date civil local evita corrimiento UTC. */
function civilLocalDate(dayIso) {
  const [y, m, d] = dayIso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function OccupancyBar({ label, percentage, detail }) {
  const pct = Number.isFinite(percentage) ? Math.max(0, Math.min(100, percentage)) : 0;
  const display = pct.toFixed(1);

  return (
    <div className={styles.occupancyRow}>
      <div className={styles.occupancyHeader}>
        <span className={styles.occupancyLabel}>{label}</span>
        <span className={styles.occupancyPct}>{display}%</span>
      </div>
      <div
        className={styles.occupancyTrack}
        role="progressbar"
        aria-valuenow={Number(display)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className={styles.occupancyFill} style={{ width: `${pct}%` }} />
      </div>
      {detail ? <div className={styles.occupancyDetail}>{detail}</div> : null}
    </div>
  );
}

function MovementColumn({ title, total, names, variant, icon }) {
  const empty = !names?.length;

  return (
    <section className={`${styles.movementCol} ${styles[variant]}`}>
      <header className={styles.movementHeader}>
        <span className={styles.movementIcon} aria-hidden="true">
          {icon}
        </span>
        <div className={styles.movementTitleBlock}>
          <div className={styles.movementTitle}>{title}</div>
          <div className={styles.movementTotal}>{total}</div>
        </div>
      </header>
      <ul className={styles.movementList}>
        {empty ? (
          <li className={styles.movementEmpty}>Sin movimientos</li>
        ) : (
          names.map((name, idx) => (
            <li key={`${name}-${idx}`} className={styles.movementItem}>
              <span className={styles.movementDot} aria-hidden="true" />
              <span className={styles.movementName}>{name}</span>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

export default function DayInfoSidePanel({
  selectedDate,
  rooms,
  reservations,
  isOpen,
  onClose
}) {
  const dayIso = useMemo(() => {
    if (!selectedDate) return null;
    if (typeof selectedDate === 'string') return selectedDate.slice(0, 10);
    try {
      return isoDate(selectedDate);
    } catch {
      return format(selectedDate, 'yyyy-MM-dd');
    }
  }, [selectedDate]);

  const stats = useMemo(
    () => computeDayInfoStats(dayIso, rooms, reservations),
    [dayIso, rooms, reservations]
  );

  if (!selectedDate || !dayIso) return null;

  const dateForFormat = civilLocalDate(dayIso);
  const formattedDate = format(dateForFormat, "EEEE, d 'de' MMMM 'de' yyyy", {
    locale: es
  });
  const shortDate = format(dateForFormat, "d 'de' MMMM", { locale: es });

  return (
    <SidePanel
      open={isOpen}
      onClose={onClose}
      title={`Información del ${shortDate}`}
      width={450}
    >
      <div className={styles.content}>
        <div className={styles.dateHeader}>
          <h3>{formattedDate}</h3>
        </div>

        <div className={styles.movementsGrid}>
          <MovementColumn
            title="Ingresos"
            total={stats.checkIns}
            names={stats.checkInNames}
            variant="arrivals"
            icon={<FiArrowDown />}
          />
          <MovementColumn
            title="Salidas"
            total={stats.checkOuts}
            names={stats.checkOutNames}
            variant="departures"
            icon={<FiArrowUp />}
          />
        </div>

        <div className={styles.occupancySection}>
          <h4 className={styles.sectionTitle}>Ocupación</h4>
          <OccupancyBar
            label="Ocupación habitaciones"
            percentage={stats.roomOccupancyPercentage}
            detail={`${stats.occupiedRooms} de ${stats.totalRooms} habitaciones`}
          />
          <OccupancyBar
            label="Ocupación pasajeros"
            percentage={stats.guestOccupancyPercentage}
            detail={`${stats.totalGuests} de ${stats.totalGuestCapacity} plazas`}
          />
        </div>
      </div>
    </SidePanel>
  );
}
