import React, { useState } from 'react';
import { getStatusLabel } from "../utils/reservationStatusUtils";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import styles from '../styles/ReservationsTable.module.css';

export default function ReservationsTable({ 
  reservations, 
  rooms, 
  clients, 
  onReservationClick,
  operationalPeriods = [] 
}) {
  const [sortField, setSortField] = useState('checkIn');
  const [sortDirection, setSortDirection] = useState('asc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Función para determinar si un día está en un período cerrado
  const isDayClosed = (day) => {
    if (!operationalPeriods || operationalPeriods.length === 0) {
      return false;
    }

    const dayDate = new Date(day);
    dayDate.setHours(0, 0, 0, 0);

    for (const period of operationalPeriods) {
      const periodStart = new Date(period.startDate);
      const periodEnd = new Date(period.endDate);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd.setHours(0, 0, 0, 0);

      if (dayDate >= periodStart && dayDate <= periodEnd) {
        return false;
      }
    }

    return true;
  };

  // Función para ordenar las reservas
  const sortReservations = (reservations) => {
    return [...reservations].sort((a, b) => {
      let aValue, bValue;

      switch (sortField) {
        case 'checkIn':
          aValue = new Date(a.checkIn);
          bValue = new Date(b.checkIn);
          break;
        case 'checkOut':
          aValue = new Date(a.checkOut);
          bValue = new Date(b.checkOut);
          break;
        case 'totalAmount':
          aValue = a.totalAmount || 0;
          bValue = b.totalAmount || 0;
          break;
        case 'roomName':
          aValue = a.room?.name || '';
          bValue = b.room?.name || '';
          break;
        case 'clientName':
          aValue = `${a.mainClient?.firstName || ''} ${a.mainClient?.lastName || ''}`.trim();
          bValue = `${b.mainClient?.firstName || ''} ${b.mainClient?.lastName || ''}`.trim();
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        default:
          aValue = a[sortField] || '';
          bValue = b[sortField] || '';
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  };

  // Función para filtrar las reservas
  const filterReservations = (reservations) => {
    let filtered = reservations;

    // Filtrar por estado
    if (filterStatus !== 'all') {
      filtered = filtered.filter(reservation => reservation.status === filterStatus);
    }

    // Filtrar por término de búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(reservation => {
        const roomName = reservation.room?.name?.toLowerCase() || '';
        const clientName = `${reservation.mainClient?.firstName || ''} ${reservation.mainClient?.lastName || ''}`.toLowerCase();
        const clientEmail = reservation.mainClient?.email?.toLowerCase() || '';
        const clientPhone = reservation.mainClient?.phone?.toLowerCase() || '';
        
        return roomName.includes(term) || 
               clientName.includes(term) || 
               clientEmail.includes(term) || 
               clientPhone.includes(term) ||
               reservation.id.toString().includes(term);
      });
    }

    return filtered;
  };

  // Función para manejar el ordenamiento
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Función para obtener el estado en español
  const getStatusText = (status) => getStatusLabel(status);

  // Función para obtener el tipo de reserva en español
  const getReservationTypeText = (type) => {
    switch (type) {
      case 'con_desayuno': return 'Con desayuno';
      case 'media_pension': return 'Media pensión';
      case 'pension_completa': return 'Pensión completa';
      case 'solo_alojamiento': return 'Solo alojamiento';
      default: return type;
    }
  };

  // Función para obtener la clase de estado
  const getStatusClass = (status) => {
    switch (status) {
      case 'active': return styles.statusActive;
      case 'finished': return styles.statusFinished;
      case 'cancelled': return styles.statusCancelled;
      default: return styles.statusDefault;
    }
  };

  // Procesar las reservas
  const processedReservations = sortReservations(filterReservations(reservations));

  return (
    <div className={styles.container}>
      {/* Controles de filtro y búsqueda */}
      <div className={styles.controls}>
        <div className={styles.searchContainer}>
          <input
            type="text"
            placeholder="Buscar por habitación, cliente, email, teléfono o ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        
        <div className={styles.filterContainer}>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">Todos los estados</option>
                <option value="pendiente">Pendientes</option>
                <option value="confirmada">Confirmadas</option>
                <option value="ingresada">Ingresadas</option>
                <option value="finalizada">Finalizadas</option>
                <option value="cancelada">Canceladas</option>
                <option value="no presentada">No presentadas</option>
          </select>
        </div>
      </div>

      {/* Tabla de reservas */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th onClick={() => handleSort('id')} className={styles.sortableHeader}>
                ID
                {sortField === 'id' && (
                  <span className={styles.sortIndicator}>
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th onClick={() => handleSort('roomName')} className={styles.sortableHeader}>
                Habitación
                {sortField === 'roomName' && (
                  <span className={styles.sortIndicator}>
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th onClick={() => handleSort('clientName')} className={styles.sortableHeader}>
                Cliente
                {sortField === 'clientName' && (
                  <span className={styles.sortIndicator}>
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th onClick={() => handleSort('checkIn')} className={styles.sortableHeader}>
                Check-in
                {sortField === 'checkIn' && (
                  <span className={styles.sortIndicator}>
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th onClick={() => handleSort('checkOut')} className={styles.sortableHeader}>
                Check-out
                {sortField === 'checkOut' && (
                  <span className={styles.sortIndicator}>
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th onClick={() => handleSort('totalAmount')} className={styles.sortableHeader}>
                Monto
                {sortField === 'totalAmount' && (
                  <span className={styles.sortIndicator}>
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th onClick={() => handleSort('reservationType')} className={styles.sortableHeader}>
                Tipo
                {sortField === 'reservationType' && (
                  <span className={styles.sortIndicator}>
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
              <th onClick={() => handleSort('status')} className={styles.sortableHeader}>
                Estado
                {sortField === 'status' && (
                  <span className={styles.sortIndicator}>
                    {sortDirection === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {processedReservations.map((reservation) => {
              const isCheckInClosed = isDayClosed(reservation.checkIn);
              const isCheckOutClosed = isDayClosed(reservation.checkOut);
              
              return (
                <tr 
                  key={reservation.id} 
                  className={styles.tableRow}
                  onClick={() => onReservationClick(reservation)}
                >
                  <td className={styles.cell}>#{reservation.id}</td>
                  <td className={styles.cell}>
                    <span className={styles.roomName}>{reservation.room?.name}</span>
                  </td>
                  <td className={styles.cell}>
                    <div className={styles.clientInfo}>
                      <div className={styles.clientName}>
                        {reservation.mainClient?.firstName} {reservation.mainClient?.lastName}
                      </div>
                      <div className={styles.clientDetails}>
                        {reservation.mainClient?.email && (
                          <span className={styles.clientEmail}>{reservation.mainClient.email}</span>
                        )}
                        {reservation.mainClient?.phone && (
                          <span className={styles.clientPhone}>{reservation.mainClient.phone}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className={styles.cell}>
                    <span className={isCheckInClosed ? styles.closedDate : ''}>
                      {format(new Date(reservation.checkIn), 'dd/MM/yyyy', { locale: es })}
                    </span>
                  </td>
                  <td className={styles.cell}>
                    <span className={isCheckOutClosed ? styles.closedDate : ''}>
                      {format(new Date(reservation.checkOut), 'dd/MM/yyyy', { locale: es })}
                    </span>
                  </td>
                  <td className={styles.cell}>
                    <span className={styles.amount}>
                      ${reservation.totalAmount?.toLocaleString('es-AR')}
                    </span>
                  </td>
                  <td className={styles.cell}>
                    <span className={styles.reservationType}>
                      {getReservationTypeText(reservation.reservationType)}
                    </span>
                  </td>
                  <td className={styles.cell}>
                    <span className={`${styles.status} ${getStatusClass(reservation.status)}`}>
                      {getStatusText(reservation.status)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {processedReservations.length === 0 && (
          <div className={styles.emptyState}>
            <p>No se encontraron reservas que coincidan con los filtros aplicados.</p>
          </div>
        )}
      </div>

      {/* Información de resultados */}
      <div className={styles.resultsInfo}>
        <span>Mostrando {processedReservations.length} de {reservations.length} reservas</span>
      </div>
    </div>
  );
} 