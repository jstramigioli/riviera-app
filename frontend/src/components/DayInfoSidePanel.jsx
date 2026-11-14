import React, { useEffect, useMemo, useState } from 'react';
import { FiArrowDown, FiArrowUp } from 'react-icons/fi';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import SidePanel from './SidePanel';
import styles from '../styles/DayInfoSidePanel.module.css';
import { isoDate } from '../utils/calendarDates';
import { computeDayInfoStats } from '../utils/dayInfoStats';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/** date-fns format() usa TZ local: construir Date civil local evita corrimiento UTC. */
function civilLocalDate(dayIso) {
  const [y, m, d] = dayIso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function OccupancyBar({ label, percentage }) {
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
    </div>
  );
}

function MovementColumn({ title, total, items, variant, icon, onOpenReservation }) {
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
        {(items || []).map((item, idx) => (
          <li key={`${item.reservationId}-${idx}`} className={styles.movementItem}>
            <span className={styles.movementDot} aria-hidden="true" />
            <button
              type="button"
              className={styles.movementLink}
              onClick={() => onOpenReservation?.(item.reservationId)}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function DayInfoSidePanel({
  selectedDate,
  rooms,
  reservations,
  isOpen,
  onClose,
  serviceTypes: serviceTypesProp
}) {
  const navigate = useNavigate();
  const [serviceTypesLoaded, setServiceTypesLoaded] = useState([]);

  useEffect(() => {
    if (serviceTypesProp != null || !isOpen) return undefined;
    let cancelled = false;
    const loadServiceTypes = async () => {
      try {
        const response = await fetch(
          `${API_URL}/service-types?hotelId=default-hotel`
        );
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setServiceTypesLoaded(data.data || []);
      } catch (error) {
        console.error('Error loading service types for day info:', error);
      }
    };
    loadServiceTypes();
    return () => {
      cancelled = true;
    };
  }, [isOpen, serviceTypesProp]);

  const serviceTypes =
    serviceTypesProp != null ? serviceTypesProp : serviceTypesLoaded;

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
    () => computeDayInfoStats(dayIso, rooms, reservations, serviceTypes),
    [dayIso, rooms, reservations, serviceTypes]
  );

  const openReservation = (reservationId) => {
    if (reservationId == null) return;
    onClose?.();
    navigate(`/reservations/${reservationId}`);
  };

  if (!selectedDate || !dayIso) return null;

  const dateForFormat = civilLocalDate(dayIso);
  const formattedDate = format(dateForFormat, "EEEE, d 'de' MMMM 'de' yyyy", {
    locale: es
  });

  return (
    <SidePanel
      open={isOpen}
      onClose={onClose}
      title={formattedDate}
      width={450}
    >
      <div className={styles.content}>
        <div className={styles.movementsGrid}>
          <MovementColumn
            title="Ingresos"
            total={stats.checkIns}
            items={stats.checkInItems}
            variant="arrivals"
            icon={<FiArrowDown />}
            onOpenReservation={openReservation}
          />
          <MovementColumn
            title="Salidas"
            total={stats.checkOuts}
            items={stats.checkOutItems}
            variant="departures"
            icon={<FiArrowUp />}
            onOpenReservation={openReservation}
          />
        </div>

        <div className={styles.countsSection}>
          <div className={styles.countsGrid}>
            <div className={styles.countItem}>
              <span className={styles.countLabel}>Pasajeros</span>
              <span className={styles.countValue}>{stats.totalGuests}</span>
            </div>
            <div className={styles.countItem}>
              <span className={styles.countLabel}>Habitaciones ocupadas</span>
              <span className={styles.countValue}>{stats.occupiedRooms}</span>
            </div>
            <div className={styles.countItem}>
              <span className={styles.countLabel}>Desayuno</span>
              <span className={styles.countValue}>{stats.breakfastGuests}</span>
            </div>
            <div className={styles.countItem}>
              <span className={styles.countLabel}>Cena</span>
              <span className={styles.countValue}>{stats.dinnerGuests}</span>
            </div>
          </div>
        </div>

        <div className={styles.occupancySection}>
          <h4 className={styles.sectionTitle}>Ocupación</h4>
          <OccupancyBar
            label="Ocupación habitaciones"
            percentage={stats.roomOccupancyPercentage}
          />
          <OccupancyBar
            label="Ocupación pasajeros"
            percentage={stats.guestOccupancyPercentage}
          />
        </div>
      </div>
    </SidePanel>
  );
}
