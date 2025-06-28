import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import SidePanel from './SidePanel';
import styles from '../styles/DayInfoSidePanel.module.css';

export default function DayInfoSidePanel({ 
  selectedDate, 
  rooms, 
  reservations, 
  isOpen, 
  onClose 
}) {
  if (!selectedDate) return null;

  // Calcular estadísticas del día
  const calculateDayStats = () => {
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(23, 59, 59, 999);

    console.log('Calculando estadísticas para:', selectedDate.toISOString());
    console.log('Día inicio:', dayStart.toISOString());
    console.log('Día fin:', dayEnd.toISOString());

    // Reservas que están activas en este día (ocupando habitación)
    const activeReservations = reservations.filter(reservation => {
      const checkIn = new Date(reservation.checkIn);
      const checkOut = new Date(reservation.checkOut);
      return checkIn <= dayEnd && checkOut > dayStart;
    });

    console.log('Reservas activas:', activeReservations.length);

    // Habitaciones ocupadas
    const occupiedRooms = activeReservations.length;
    const totalRooms = rooms.length;
    const roomOccupancyPercentage = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

    // Pasajeros alojados (asumiendo 1 pasajero por reserva por ahora)
    const totalGuests = activeReservations.length;
    const guestOccupancyPercentage = totalRooms > 0 ? (totalGuests / totalRooms) * 100 : 0;

    // Ingresos (check-ins en este día)
    const checkIns = reservations.filter(reservation => {
      const checkIn = new Date(reservation.checkIn);
      return checkIn >= dayStart && checkIn <= dayEnd;
    }).length;

    console.log('Check-ins encontrados:', checkIns);

    // Salidas (check-outs en este día) - CORREGIDO
    // Una salida ocurre cuando la fecha de checkout es exactamente este día
    const checkOuts = reservations.filter(reservation => {
      const checkOut = new Date(reservation.checkOut);
      // La reserva termina en este día (checkOut es igual al día actual)
      const isCheckOutToday = checkOut >= dayStart && checkOut <= dayEnd;
      
      if (isCheckOutToday) {
        console.log('Salida encontrada:', {
          reservationId: reservation.id,
          checkOut: checkOut.toISOString(),
          client: reservation.mainClient?.firstName + ' ' + reservation.mainClient?.lastName
        });
      }
      
      return isCheckOutToday;
    }).length;

    console.log('Check-outs encontrados:', checkOuts);

    return {
      checkIns,
      checkOuts,
      occupiedRooms,
      totalRooms,
      roomOccupancyPercentage,
      totalGuests,
      guestOccupancyPercentage
    };
  };

  const stats = calculateDayStats();
  const formattedDate = format(selectedDate, 'EEEE, d \'de\' MMMM \'de\' yyyy', { locale: es });

  return (
    <SidePanel
      open={isOpen}
      onClose={onClose}
      title={`Información del ${format(selectedDate, 'd \'de\' MMMM', { locale: es })}`}
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
              <div className={styles.statValue}>{stats.roomOccupancyPercentage.toFixed(1)}%</div>
              <div className={styles.statLabel}>Ocupación (Habitaciones)</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>👥</div>
            <div className={styles.statInfo}>
              <div className={styles.statValue}>{stats.guestOccupancyPercentage.toFixed(1)}%</div>
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
            El {format(selectedDate, 'd \'de\' MMMM', { locale: es })} se registraron{' '}
            <strong>{stats.checkIns} ingresos</strong> y <strong>{stats.checkOuts} salidas</strong>.
            La ocupación de habitaciones fue del <strong>{stats.roomOccupancyPercentage.toFixed(1)}%</strong> 
            con <strong>{stats.totalGuests} pasajeros</strong> alojados.
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
            <span className={styles.detailValue}>{stats.totalRooms - stats.occupiedRooms}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Tasa de ocupación:</span>
            <span className={styles.detailValue}>{stats.roomOccupancyPercentage.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </SidePanel>
  );
} 