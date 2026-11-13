import React, { useMemo } from 'react';
import { FiDownload, FiUpload, FiHome, FiBarChart2, FiUsers, FiGrid } from 'react-icons/fi';
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

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon} aria-hidden="true"><FiDownload /></div>
            <div className={styles.statInfo}>
              <div className={styles.statValue}>{stats.checkIns}</div>
              <div className={styles.statLabel}>Ingresos de Pasajeros</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon} aria-hidden="true"><FiUpload /></div>
            <div className={styles.statInfo}>
              <div className={styles.statValue}>{stats.checkOuts}</div>
              <div className={styles.statLabel}>Salidas de Pasajeros</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon} aria-hidden="true"><FiHome /></div>
            <div className={styles.statInfo}>
              <div className={styles.statValue}>{stats.occupiedRooms}</div>
              <div className={styles.statLabel}>Habitaciones Ocupadas</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon} aria-hidden="true"><FiBarChart2 /></div>
            <div className={styles.statInfo}>
              <div className={styles.statValue}>
                {stats.roomOccupancyPercentage.toFixed(1)}%
              </div>
              <div className={styles.statLabel}>Ocupación (Habitaciones)</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon} aria-hidden="true"><FiUsers /></div>
            <div className={styles.statInfo}>
              <div className={styles.statValue}>
                {stats.guestOccupancyPercentage.toFixed(1)}%
              </div>
              <div className={styles.statLabel}>Ocupación (Pasajeros)</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon} aria-hidden="true"><FiGrid /></div>
            <div className={styles.statInfo}>
              <div className={styles.statValue}>{stats.totalGuests}</div>
              <div className={styles.statLabel}>Pasajeros Alojados</div>
            </div>
          </div>
        </div>

        <div className={styles.summary}>
          <h4>Resumen del Día</h4>
          <p>
            El {shortDate} se registraron{' '}
            <strong>{stats.checkIns} ingresos</strong> y{' '}
            <strong>{stats.checkOuts} salidas</strong> de pasajeros. La ocupación de
            habitaciones fue del{' '}
            <strong>{stats.roomOccupancyPercentage.toFixed(1)}%</strong> y la de
            pasajeros del{' '}
            <strong>{stats.guestOccupancyPercentage.toFixed(1)}%</strong> (
            <strong>{stats.totalGuests}</strong> de{' '}
            <strong>{stats.totalGuestCapacity}</strong> plazas).
          </p>
        </div>

        <div className={styles.details}>
          <h4>Detalles</h4>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Total de habitaciones:</span>
            <span className={styles.detailValue}>{stats.totalRooms}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Habitaciones disponibles:</span>
            <span className={styles.detailValue}>
              {stats.totalRooms - stats.occupiedRooms}
            </span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Capacidad de pasajeros:</span>
            <span className={styles.detailValue}>{stats.totalGuestCapacity}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Tasa ocupación habitaciones:</span>
            <span className={styles.detailValue}>
              {stats.roomOccupancyPercentage.toFixed(1)}%
            </span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Tasa ocupación pasajeros:</span>
            <span className={styles.detailValue}>
              {stats.guestOccupancyPercentage.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </SidePanel>
  );
}
