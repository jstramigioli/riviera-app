import React, { useState } from 'react';
import { format } from 'date-fns';
import { FiSave, FiX, FiPlus, FiTrash2 } from 'react-icons/fi';
import { createRates, updateRate, deleteRate } from '../services/api';
import styles from '../styles/RateEditor.module.css';

const RateEditor = ({ onViewMode, rates = [] }) => {
  const [formData, setFormData] = useState({
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    roomTypeId: '',
    price: '',
    minStay: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.startDate || !formData.endDate || !formData.roomTypeId || !formData.price) {
      setError('Todos los campos son requeridos excepto estadía mínima');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await createRates(formData);
      setFormData({
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
        roomTypeId: '',
        price: '',
        minStay: ''
      });
      // Recargar la vista
      onViewMode();
    } catch (err) {
      setError('Error al crear las tarifas');
      console.error('Error creating rates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRate = async (rateId) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta tarifa?')) return;
    
    setLoading(true);
    try {
      await deleteRate(rateId);
      onViewMode(); // Recargar la vista
    } catch (err) {
      setError('Error al eliminar la tarifa');
      console.error('Error deleting rate:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRate = async (rateId, updates) => {
    setLoading(true);
    try {
      await updateRate(rateId, updates);
      onViewMode(); // Recargar la vista
    } catch (err) {
      setError('Error al actualizar la tarifa');
      console.error('Error updating rate:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Editor de Tarifas</h2>
        <button 
          className={styles.viewButton}
          onClick={onViewMode}
        >
          <FiX /> Volver a Vista
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Fecha desde:</label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => handleInputChange('startDate', e.target.value)}
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label>Fecha hasta:</label>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => handleInputChange('endDate', e.target.value)}
              required
            />
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Tipo de habitación:</label>
            <select
              value={formData.roomTypeId}
              onChange={(e) => handleInputChange('roomTypeId', e.target.value)}
              required
            >
              <option value="">Seleccionar tipo</option>
              <option value="1">Single</option>
              <option value="2">Doble</option>
              <option value="3">Triple</option>
              <option value="4">Cuádruple</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label>Precio:</label>
            <input
              type="number"
              value={formData.price}
              onChange={(e) => handleInputChange('price', e.target.value)}
              placeholder="0.00"
              step="0.01"
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label>Estadía mínima (opcional):</label>
            <input
              type="number"
              value={formData.minStay}
              onChange={(e) => handleInputChange('minStay', e.target.value)}
              placeholder="0"
              min="0"
            />
          </div>
        </div>

        <button 
          type="submit" 
          className={styles.submitButton}
          disabled={loading}
        >
          <FiPlus /> Crear Tarifas
        </button>
      </form>

      <div className={styles.existingRates}>
        <h3>Tarifas Existentes</h3>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Precio</th>
                <th>Min. Estadía</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((rate) => (
                <tr key={rate.id}>
                  <td>{format(new Date(rate.date), 'dd/MM/yyyy')}</td>
                  <td>{rate.roomType?.name}</td>
                  <td>
                    <input
                      type="number"
                      defaultValue={rate.price}
                      onBlur={(e) => handleUpdateRate(rate.id, { price: parseFloat(e.target.value) })}
                      step="0.01"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      defaultValue={rate.minStay || ''}
                      onBlur={(e) => handleUpdateRate(rate.id, { minStay: e.target.value ? parseInt(e.target.value) : null })}
                      min="0"
                    />
                  </td>
                  <td>
                    <button
                      className={styles.deleteButton}
                      onClick={() => handleDeleteRate(rate.id)}
                      disabled={loading}
                    >
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RateEditor; 