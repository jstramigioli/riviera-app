import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import ConfirmationModal from './ConfirmationModal';
import styles from '../styles/QueriesTable.module.css';

function QueriesTable({ queries, onDeleteQuery }) {
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');
  const [modalOpen, setModalOpen] = useState(false);
  const [queryToDelete, setQueryToDelete] = useState(null);
  const [serviceTypes, setServiceTypes] = useState([]);
  const navigate = useNavigate();

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
        case 'nights':
          aValue = calculateNights(a.checkIn, a.checkOut);
          bValue = calculateNights(b.checkIn, b.checkOut);
          break;
        case 'room':
          aValue = a.room ? a.room.name : '';
          bValue = b.room ? b.room.name : '';
          break;
        case 'guests':
          aValue = a.requiredGuests || 1;
          bValue = b.requiredGuests || 1;
          break;
        case 'type':
          aValue = getServiceTypeName(a.serviceType);
          bValue = getServiceTypeName(b.serviceType);
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
  }, [queries, sortField, sortDirection, getServiceTypeName]);

  const getSortIcon = (field) => {
    if (sortField !== field) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const calculateNights = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return 0;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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

  const handleDeleteQuery = (query) => {
    setQueryToDelete(query);
    setModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (queryToDelete) {
      onDeleteQuery(queryToDelete.id);
      setModalOpen(false);
      setQueryToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setModalOpen(false);
    setQueryToDelete(null);
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
              onClick={() => handleSort('nights')}
            >
              Noches {getSortIcon('nights')}
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
            <th className={styles.actionHeader}>
              Acciones
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
              <td className={styles.nightsCell}>
                {calculateNights(query.checkIn, query.checkOut)}
              </td>
              <td className={styles.roomCell}>
                {query.room ? query.room.name : 'No especificada'}
              </td>
              <td className={styles.guestsCell}>
                {query.requiredGuests || 1}
              </td>
              <td className={styles.typeCell}>
                {getServiceTypeName(query.serviceType)}
              </td>
              <td className={styles.updatedAtCell}>
                {query.updatedAt ? format(new Date(query.updatedAt), 'dd/MM/yyyy HH:mm') : 'Sin fecha'}
              </td>
              <td className={styles.actionCell}>
                <button 
                  className={styles.deleteButton}
                  onClick={(e) => {
                    e.stopPropagation(); // Evitar que se active el clic de la fila
                    handleDeleteQuery(query);
                  }}
                  title="Eliminar consulta"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <ConfirmationModal
        isOpen={modalOpen}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Eliminar Consulta"
        message={
          queryToDelete ? 
            `¿Estás seguro de que quieres eliminar la consulta #${queryToDelete.id} de ${
              queryToDelete.mainClient ? 
                `${queryToDelete.mainClient.firstName} ${queryToDelete.mainClient.lastName}` : 
                'Sin cliente'
            }?` : 
            ''
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        confirmButtonClass="confirm"
      />
    </div>
  );
}

export default QueriesTable;
