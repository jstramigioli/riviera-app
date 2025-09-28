import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { getStatusLabel } from "../utils/reservationStatusUtils";
import styles from '../styles/QueriesTable.module.css';

function QueriesTable({ queries, rooms, clients }) {
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');
  const navigate = useNavigate();

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedQueries = useMemo(() => {
    if (!queries || queries.length === 0) return [];

    return [...queries].sort((a, b) => {
      let aValue, bValue;

      switch (sortField) {
        case 'id':
          aValue = a.id;
          bValue = b.id;
          break;
        case 'client':
          aValue = a.mainClient ? `${a.mainClient.firstName} ${a.mainClient.lastName}` : '';
          bValue = b.mainClient ? `${b.mainClient.firstName} ${b.mainClient.lastName}` : '';
          break;
        case 'checkIn':
          aValue = a.checkIn ? new Date(a.checkIn) : new Date(0);
          bValue = b.checkIn ? new Date(b.checkIn) : new Date(0);
          break;
        case 'checkOut':
          aValue = a.checkOut ? new Date(a.checkOut) : new Date(0);
          bValue = b.checkOut ? new Date(b.checkOut) : new Date(0);
          break;
        case 'room':
          aValue = a.room ? a.room.name : '';
          bValue = b.room ? b.room.name : '';
          break;
        case 'guests':
          aValue = a.requiredGuests || 1;
          bValue = b.requiredGuests || 1;
          break;
        case 'status':
          aValue = a.status || 'pendiente';
          bValue = b.status || 'pendiente';
          break;
        case 'type':
          aValue = a.reservationType || '';
          bValue = b.reservationType || '';
          break;
        case 'updatedAt':
          aValue = a.updatedAt ? new Date(a.updatedAt) : new Date(0);
          bValue = b.updatedAt ? new Date(b.updatedAt) : new Date(0);
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [queries, sortField, sortDirection]);

  const getSortIcon = (field) => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const handleQueryClick = (query) => {
    // Navegar a la página de consulta con los datos precargados
    navigate('/consulta', { 
      state: { 
        queryData: query,
        isEditing: true 
      } 
    });
  };

  if (!queries || queries.length === 0) {
    return (
      <div className={styles.noData}>
        <p>No hay consultas registradas</p>
      </div>
    );
  }

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th 
              className={styles.sortableHeader}
              onClick={() => handleSort('id')}
            >
              ID {getSortIcon('id')}
            </th>
            <th 
              className={styles.sortableHeader}
              onClick={() => handleSort('client')}
            >
              Cliente {getSortIcon('client')}
            </th>
            <th 
              className={styles.sortableHeader}
              onClick={() => handleSort('checkIn')}
            >
              Check-in {getSortIcon('checkIn')}
            </th>
            <th 
              className={styles.sortableHeader}
              onClick={() => handleSort('checkOut')}
            >
              Check-out {getSortIcon('checkOut')}
            </th>
            <th 
              className={styles.sortableHeader}
              onClick={() => handleSort('room')}
            >
              Habitación {getSortIcon('room')}
            </th>
            <th 
              className={styles.sortableHeader}
              onClick={() => handleSort('guests')}
            >
              Huéspedes {getSortIcon('guests')}
            </th>
            <th 
              className={styles.sortableHeader}
              onClick={() => handleSort('status')}
            >
              Estado {getSortIcon('status')}
            </th>
            <th 
              className={styles.sortableHeader}
              onClick={() => handleSort('type')}
            >
              Tipo {getSortIcon('type')}
            </th>
            <th 
              className={styles.sortableHeader}
              onClick={() => handleSort('updatedAt')}
            >
              Última Modificación {getSortIcon('updatedAt')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedQueries.map(query => (
            <tr 
              key={query.id} 
              className={styles.row}
              onClick={() => handleQueryClick(query)}
            >
              <td className={styles.idCell}>#{query.id}</td>
              <td className={styles.clientCell}>
                {query.mainClient ? 
                  `${query.mainClient.firstName} ${query.mainClient.lastName}` : 
                  'Sin cliente'
                }
              </td>
              <td className={styles.dateCell}>
                {query.checkIn ? format(new Date(query.checkIn), 'dd/MM/yyyy') : 'Sin fecha'}
              </td>
              <td className={styles.dateCell}>
                {query.checkOut ? format(new Date(query.checkOut), 'dd/MM/yyyy') : 'Sin fecha'}
              </td>
              <td className={styles.roomCell}>
                {query.room ? query.room.name : 'No especificada'}
              </td>
              <td className={styles.guestsCell}>
                {query.requiredGuests || 1}
              </td>
              <td className={styles.statusCell}>
                <span className={`${styles.statusBadge} ${styles[query.status || 'pendiente']}`}>
                  {getStatusLabel(query.status || 'pendiente')}
                </span>
              </td>
              <td className={styles.typeCell}>
                {query.reservationType === 'con_desayuno' ? 'Con desayuno' :
                 query.reservationType === 'media_pension' ? 'Media pensión' :
                 query.reservationType === 'pension_completa' ? 'Pensión completa' :
                 query.reservationType === 'solo_alojamiento' ? 'Solo alojamiento' :
                 query.reservationType || 'No especificado'}
              </td>
              <td className={styles.dateCell}>
                {query.updatedAt ? format(new Date(query.updatedAt), 'dd/MM/yyyy HH:mm') : 'Sin fecha'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default QueriesTable;
