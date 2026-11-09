import React, { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import SidePanel from './SidePanel';
import styles from '../styles/DayInfoSidePanel.module.css';
import { isoDate, toDateOnlyUtc } from '../utils/calendarDates';

function civilOf(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return isoDate(value);
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
    // Prefer local calendar day if Date came from UI click on civil iso via parseISO
    try {
      return isoDate(selectedDate);
    } catch {
      return format(selectedDate, 'yyyy-MM-dd');
    }
  }, [selectedDate]);

  const stats = useMemo(() => {
    if (!dayIso) {
      return {
        checkIns: 0,
        checkOuts: 0,
        occupiedRooms: 0,
        totalRooms: rooms?.length || 0,
        roomOccupancyPercentage: 0,
        totalGuests: 0,
        guestOccupancyPercentage: 0
      };
    }

    const totalRooms = rooms?.length || 0;

    // Half-open: ocupada si algún segmento activo cubre la noche dayIso
    // (start <= day < end)
    let occupiedRoomIds = new Set();
    let checkIns = 0;
    let checkOuts = 0;
    let guestsOnDay = 0;

    for (const reservation of reservations || []) {
      const segments =
        reservation.segments?.filter((s) => s.isActive !== false) || [];

      if (segments.length) {
        for (const seg of segments) {
          const start = civilOf(seg.startDate);
          const end = civilOf(seg.endDate);
          if (!start || !end) continue;
          if (start === dayIso) checkIns += 1;
          if (end === dayIso) checkOuts += 1;
          if (start <= dayIso && dayIso < end) {
            occupiedRoomIds.add(seg.roomId);
            guestsOnDay += seg.guestCount || 1;
          }
        }
      } else {
        // Fallback legacy checkIn/checkOut civiles
        const start = civilOf(reservation.checkIn);
        const end = civilOf(reservation.checkOut);
        if (!start || !end) continue;
        if (start === dayIso) checkIns += 1;
        if (end === dayIso) checkOuts += 1;
        if (start <= dayIso && dayIso < end) {
          occupiedRoomIds.add(reservation.roomId || reservation.id);
          guestsOnDay += 1;
        }
      }
    }

    // Evitar doble conteo de check-ins/outs cuando hay multi-segmento el mismo día
    // (arriba cuenta por segmento; para panel de día es aceptable como movimientos)

    const occupiedRooms = occupiedRoomIds.size;
    const roomOccupancyPercentage =
      totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;
    const guestOccupancyPercentage =
      totalRooms > 0 ? (guestsOnDay / totalRooms) * 100 : 0;

    return {
      checkIns,
      checkOuts,
      occupiedRooms,
      totalRooms,
      roomOccupancyPercentage,
      totalGuests: guestsOnDay,
      guestOccupancyPercentage
    };
  }, [dayIso, rooms, reservations]);

  if (!selectedDate || !dayIso) return null;

  const dateForFormat = toDateOnlyUtc(dayIso);
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
            <div className={styles.statIcon}>📥</div>
            <div className={styles.statInfo}>
              <div className={styles.statValue}>{stats.checkIns}</div>
              <div className={styles.statLabel}>Ingresos de Pasajeros</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>📤</div>
            <div className={styles.statInfo}>
              <div className={styles.statValue}>{stats.checkOuts}</div>
              <div className={styles.statLabel}>Salidas</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>🏨</div>
            <div className={styles.statInfo}>
              <div className={styles.statValue}>{stats.occupiedRooms}</div>
              <div className={styles.statLabel}>Habitaciones Ocupadas</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>📊</div>
            <div className={styles.statInfo}>
              <div className={styles.statValue}>
                {stats.roomOccupancyPercentage.toFixed(1)}%
              </div>
              <div className={styles.statLabel}>Ocupación (Habitaciones)</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>👥</div>
            <div className={styles.statInfo}>
              <div className={styles.statValue}>
                {stats.guestOccupancyPercentage.toFixed(1)}%
              </div>
              <div className={styles.statLabel}>Ocupación (Pasajeros)</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>🛏️</div>
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
            <strong>{stats.checkOuts} salidas</strong>. La ocupación de
            habitaciones fue del{' '}
            <strong>{stats.roomOccupancyPercentage.toFixed(1)}%</strong> con{' '}
            <strong>{stats.totalGuests} pasajeros</strong> alojados.
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
            <span className={styles.detailLabel}>Tasa de ocupación:</span>
            <span className={styles.detailValue}>
              {stats.roomOccupancyPercentage.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </SidePanel>
  );
}
