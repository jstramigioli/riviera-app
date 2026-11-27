import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatMoneyArs } from '../utils/formatMoney';
import ReservationIdChip from './ReservationIdChip';
import RoomNameChip from './RoomNameChip';
import GuestCheckInStatusCell from './GuestCheckInStatusCell';
import ReservationStatusPlain from './ReservationStatusPlain';
import ColumnFilter from './ColumnFilter';
import { DateRangeFilter, NumberRangeFilter, OptionsFilter, TextFilter } from './ColumnFilterControls';
import { getStatusLabel } from '../utils/reservationStatusUtils';
import {
  inDateRange,
  inNumberRange,
  isFilterActive,
  matchesOptions,
  matchesText
} from '../utils/columnFilters';
import styles from '../styles/ReservationsTable.module.css';

export default function ReservationsTable({ 
  reservations, 
  rooms, 
  clients, 
  onReservationClick,
  operationalPeriods = [] 
}) {
  const navigate = useNavigate();

  const openInternalGuestCheckIn = (reservation) => {
    if (!reservation?.id) return;
    navigate(`/reservations/${reservation.id}`, {
      state: { activeTab: 'huespedes', openGuestForm: true }
    });
  };
  const [sortField, setSortField] = useState('checkIn');
  const [sortDirection, setSortDirection] = useState('asc');
  /** Filtros por columna: texto, rangos de fechas/montos y opciones (estado, servicio). */
  const [filters, setFilters] = useState({});
  const setFilter = (key) => (value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const hasFilters = Object.values(filters).some(isFilterActive);
  const [searchTerm, setSearchTerm] = useState('');
  const [serviceTypes, setServiceTypes] = useState([]);

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
        case 'reservationType':
          aValue = getReservationTypeText(a);
          bValue = getReservationTypeText(b);
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

    filtered = filtered.filter((r) => {
      const clientName = `${r.mainClient?.firstName || ''} ${r.mainClient?.lastName || ''}`;
      return (
        matchesText(String(r.id), String(filters.id || '').replace(/^#/, '')) &&
        matchesText(r.room?.name, filters.room) &&
        matchesText(clientName, filters.client) &&
        inDateRange(r.checkIn, filters.checkIn) &&
        inDateRange(r.checkOut, filters.checkOut) &&
        inNumberRange(r.totalAmount, filters.amount) &&
        matchesOptions(getReservationServiceNames(r), filters.service) &&
        matchesOptions(r.status, filters.status)
      );
    });

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

  // Cargar tipos de servicio al montar el componente
  useEffect(() => {
    const loadServiceTypes = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/service-types?hotelId=default-hotel');
        if (response.ok) {
          const data = await response.json();
          setServiceTypes(data.data || []);
        }
      } catch (error) {
        console.error('Error loading service types:', error);
      }
    };
    loadServiceTypes();
  }, []);

  // Función para obtener el nombre del tipo de servicio
  const getServiceTypeName = useCallback((serviceTypeId) => {
    if (!serviceTypeId) return 'No especificado';
    const serviceType = serviceTypes.find(st => st.id === serviceTypeId);
    return serviceType ? serviceType.name : serviceTypeId;
  }, [serviceTypes]);

  // Función para obtener el tipo de reserva en español (desde segments)
  const getReservationTypeText = (reservation) => {
    if (!reservation.segments || reservation.segments.length === 0) {
      return 'No especificado';
    }
    // Obtener el primer servicio del primer segmento
    const firstService = reservation.segments[0].services?.[0];
    return getServiceTypeName(firstService);
  };

  /** Servicios de todos los tramos activos (una reserva puede combinar regímenes). */
  const getReservationServiceNames = (reservation) => {
    const names = new Set();
    for (const seg of reservation.segments || []) {
      if (seg.isActive === false) continue;
      for (const sid of seg.services || []) names.add(getServiceTypeName(sid));
    }
    return names.size ? [...names] : ['No especificado'];
  };

  const serviceOptions = [...new Set(reservations.flatMap(getReservationServiceNames))].sort((a, b) =>
    a.localeCompare(b, 'es')
  );
  const statusOptions = [...new Set(reservations.map((r) => r.status).filter(Boolean))].map((st) => ({
    value: st,
    label: getStatusLabel(st)
  }));

  const renderHeader = (field, label, filter) => (
    <th onClick={() => handleSort(field)} className={styles.sortableHeader}>
      {label}
      {sortField === field && (
        <span className={styles.sortIndicator}>{sortDirection === 'asc' ? '↑' : '↓'}</span>
      )}
      {filter ? (
        <ColumnFilter label={label} active={isFilterActive(filters[filter.key])}>
          {filter.render(filters[filter.key], setFilter(filter.key), label)}
        </ColumnFilter>
      ) : null}
    </th>
  );

  const text = (key, placeholder) => ({
    key,
    render: (value, onChange, label) => (
      <TextFilter label={label} value={value} onChange={onChange} placeholder={placeholder} />
    )
  });
  const dates = (key) => ({
    key,
    render: (value, onChange, label) => <DateRangeFilter label={label} value={value} onChange={onChange} />
  });
  const numbers = (key) => ({
    key,
    render: (value, onChange, label) => <NumberRangeFilter label={label} value={value} onChange={onChange} />
  });
  const opciones = (key, options) => ({
    key,
    render: (value, onChange, label) => (
      <OptionsFilter label={label} options={options} value={value} onChange={onChange} />
    )
  });

  // Función para manejar el clic en el nombre del cliente
  const handleClientClick = (e, clientId) => {
    e.stopPropagation(); // Evitar que se active el clic de la fila
    navigate(`/clients/${clientId}`);
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
        
        {hasFilters ? (
          <button type="button" className={styles.clearFilters} onClick={() => setFilters({})}>
            Quitar filtros
          </button>
        ) : null}
      </div>

      {/* Tabla de reservas */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              {renderHeader('id', 'ID', text('id', '# reserva'))}
              {renderHeader('roomName', 'Habitación', text('room'))}
              {renderHeader('clientName', 'Cliente', text('client'))}
              {renderHeader('checkIn', 'Ingreso', dates('checkIn'))}
              {renderHeader('checkOut', 'Egreso', dates('checkOut'))}
              {renderHeader('totalAmount', 'Monto', numbers('amount'))}
              {renderHeader('reservationType', 'Tipo', opciones('service', serviceOptions))}
              {renderHeader('status', 'Estado', opciones('status', statusOptions))}
              <th className={styles.sortableHeader}>Check-in</th>
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
                  <td className={styles.cell}>
                    <ReservationIdChip
                      id={reservation.id}
                      source={reservation.source}
                      status={reservation.status}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/reservations/${reservation.id}`);
                      }}
                      title="Ver reserva"
                    />
                  </td>
                  <td className={styles.cell}>
                    <RoomNameChip
                      name={reservation.room?.name}
                      roomId={reservation.room?.id}
                    />
                  </td>
                  <td className={styles.cell}>
                    <div className={styles.clientInfo}>
                      <div 
                        className={styles.clientName}
                        onClick={(e) => handleClientClick(e, reservation.mainClient?.id)}
                      >
                        {reservation.mainClient?.firstName} {reservation.mainClient?.lastName}
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
                      {formatMoneyArs(reservation.totalAmount || 0, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </td>
                  <td className={styles.cell}>
                    <span className={styles.reservationType}>
                      {getReservationTypeText(reservation)}
                    </span>
                  </td>
                  <td className={styles.cell}>
                    <ReservationStatusPlain status={reservation.status} />
                  </td>
                  <td className={styles.cell}>
                    <GuestCheckInStatusCell
                      reservation={reservation}
                      onOpenInternalForm={openInternalGuestCheckIn}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {processedReservations.length === 0 && (
          <div className={styles.emptyState}>
            <p> No se encontraron reservas que coincidan con los filtros aplicados.</p>
          </div>
        )}
      </div>

      {/* Información de resultados */}
      <div className={styles.resultsInfo}>
        <span> Mostrando {processedReservations.length} de {reservations.length} reservas</span>
      </div>
    </div>
  );
} 