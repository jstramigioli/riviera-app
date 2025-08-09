import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { FiEdit3 } from 'react-icons/fi';
import { getRates } from '../services/api';
import styles from '../styles/RateViewer.module.css';

const RateViewer = ({ onEditMode }) => {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    roomTypeId: ''
  });

  useEffect(() => {
    fetchRates();
  }, [filters]);

  const fetchRates = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRates(filters);
      setRates(data);
    } catch (err) {
      setError('Error al cargar las tarifas');
      console.error('Error fetching rates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleEditClick = () => {
    onEditMode();
  };

  if (loading) return <div className={styles.loading}>Cargando tarifas...</div>;
  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Tarifas Diarias</h2>
        <button 
          className={styles.editButton}
          onClick={handleEditClick}
        >
          <FiEdit3 /> Editar Tarifas
        </button>
      </div>

      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label>Fecha desde:</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
          />
        </div>
        <div className={styles.filterGroup}>
          <label>Fecha hasta:</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
          />
        </div>
        <div className={styles.filterGroup}>
          <label>Tipo de habitación:</label>
          <select
            value={filters.roomTypeId}
            onChange={(e) => handleFilterChange('roomTypeId', e.target.value)}
          >
            <option value="">Todos los tipos</option>
            <option value="1">Single</option>
            <option value="2">Doble</option>
            <option value="3">Triple</option>
            <option value="4">Cuádruple</option>
          </select>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo de Habitación</th>
              <th>Precio</th>
              <th>Estadía Mínima</th>
            </tr>
          </thead>
          <tbody>
            {rates.length > 0 ? (
              rates.map((rate) => (
                <tr key={rate.id}>
                  <td>{format(new Date(rate.date), 'dd/MM/yyyy')}</td>
                  <td>{rate.roomType?.name || 'N/A'}</td>
                  <td>${rate.price?.toLocaleString('es-AR')}</td>
                  <td>{rate.minStay || '-'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className={styles.noData}>
                  No hay tarifas para el período seleccionado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RateViewer; 