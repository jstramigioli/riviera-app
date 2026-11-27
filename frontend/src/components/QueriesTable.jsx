import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { FiX } from 'react-icons/fi';
import ConfirmationModal from './ConfirmationModal';
import ReservationIdChip from './ReservationIdChip';
import ColumnFilter from './ColumnFilter';
import { DateRangeFilter, NumberRangeFilter, TextFilter } from './ColumnFilterControls';
import { inDateRange, inNumberRange, isFilterActive, matchesText } from '../utils/columnFilters';
import styles from '../styles/QueriesTable.module.css';

function calculateNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const diffTime = Math.abs(new Date(checkOut) - new Date(checkIn));
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function QueriesTable({ queries, onDeleteQuery }) {
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('asc');
  const [modalOpen, setModalOpen] = useState(false);
  const [queryToDelete, setQueryToDelete] = useState(null);
  const [filters, setFilters] = useState({});
  const setFilter = (key) => (value) => setFilters((prev) => ({ ...prev, [key]: value }));
  const hasFilters = Object.values(filters).some(isFilterActive);
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

    const filtered = queries.filter((q) => {
      const client = q.mainClient ? `${q.mainClient.firstName} ${q.mainClient.lastName}` : '';
      return (
        matchesText(String(q.id), String(filters.id || '').replace(/^#/, '')) &&
        matchesText(client, filters.client) &&
        inDateRange(q.checkIn, filters.checkIn) &&
        inDateRange(q.checkOut, filters.checkOut) &&
        inNumberRange(calculateNights(q.checkIn, q.checkOut), filters.nights) &&
        inNumberRange(q.requiredGuests || 1, filters.guests) &&
        inDateRange(q.updatedAt, filters.updatedAt)
      );
    });

    return filtered.sort((a, b) => {
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
        case 'guests':
          aValue = a.requiredGuests || 1;
          bValue = b.requiredGuests || 1;
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
  }, [queries, sortField, sortDirection, filters]);

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

  const renderHeader = (field, label, filter) => (
    <th className={styles.sortableHeader} onClick={() => handleSort(field)}>
      {label}
      {sortField === field ? (
        <span className={styles.sortIndicator}>{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
      ) : null}
      <ColumnFilter label={label} active={isFilterActive(filters[filter.key])}>
        {filter.render(filters[filter.key], setFilter(filter.key), label)}
      </ColumnFilter>
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

  if (!queries || queries.length === 0) {
    return (
      <div className={styles.noData}>
        <p> No hay consultas registradas</p>
      </div>
    );
  }

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            {renderHeader('id', 'ID', text('id', '# consulta'))}
            {renderHeader('client', 'Cliente', text('client'))}
            {renderHeader('checkIn', 'Check-in', dates('checkIn'))}
            {renderHeader('checkOut', 'Check-out', dates('checkOut'))}
            {renderHeader('nights', 'Noches', numbers('nights'))}
            {renderHeader('guests', 'Huéspedes', numbers('guests'))}
            {renderHeader('updatedAt', 'Última Modificación', dates('updatedAt'))}
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
              <td className={styles.idCell}>
                <ReservationIdChip
                  id={query.id}
                  variant="neutral"
                  navigateToDetail={false}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleQueryClick(query);
                  }}
                  title={`Ver consulta #${query.id}`}
                />
              </td>
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
              <td className={styles.guestsCell}>
                {query.requiredGuests || 1}
              </td>
              <td className={styles.updatedAtCell}>
                {query.updatedAt ? format(new Date(query.updatedAt), 'dd/MM/yyyy HH:mm') : 'Sin fecha'}
              </td>
              <td className={styles.actionCell}>
                <button
                  type="button"
                  className={styles.deleteButton}
                  onClick={(e) => {
                    e.stopPropagation(); // Evitar que se active el clic de la fila
                    handleDeleteQuery(query);
                  }}
                  title="Eliminar consulta"
                  aria-label="Eliminar consulta"
                >
                  <FiX aria-hidden="true" size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sortedQueries.length === 0 ? (
        <div className={styles.noData}>
          <p>No hay consultas que coincidan con los filtros.</p>
        </div>
      ) : null}
      {hasFilters ? (
        <button type="button" className={styles.clearFilters} onClick={() => setFilters({})}>
          Quitar filtros
        </button>
      ) : null}
      
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
