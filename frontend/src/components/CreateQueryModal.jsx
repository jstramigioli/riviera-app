import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import styles from '../styles/CreateQueryModal.module.css';

export default function CreateQueryModal({ 
  isOpen, 
  onClose
}) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    checkIn: format(new Date(), 'yyyy-MM-dd'),
    checkOut: format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    requiredGuests: 1
  });

  const [errors, setErrors] = useState({});

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Limpiar error del campo
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.checkIn) {
      newErrors.checkIn = 'Debe seleccionar fecha de entrada';
    }
    if (!formData.checkOut) {
      newErrors.checkOut = 'Debe seleccionar fecha de salida';
    }
    if (formData.checkIn && formData.checkOut && formData.checkIn >= formData.checkOut) {
      newErrors.checkOut = 'La fecha de salida debe ser posterior a la fecha de entrada';
    }
    if (!formData.requiredGuests || formData.requiredGuests < 1) {
      newErrors.requiredGuests = 'Debe especificar al menos 1 huésped';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Cerrar el modal y navegar a la nueva página sin parámetros
    handleClose();
    navigate('/nueva-consulta');
  };

  const handleClose = () => {
    setFormData({
      checkIn: format(new Date(), 'yyyy-MM-dd'),
      checkOut: format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      requiredGuests: 1
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Nueva Consulta</h2>
          <button className={styles.closeButton} onClick={handleClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="checkIn">Fecha de Entrada *</label>
            <input
              type="date"
              id="checkIn"
              value={formData.checkIn}
              onChange={(e) => handleInputChange('checkIn', e.target.value)}
              className={errors.checkIn ? styles.error : ''}
            />
            {errors.checkIn && <span className={styles.errorText}>{errors.checkIn}</span>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="checkOut">Fecha de Salida *</label>
            <input
              type="date"
              id="checkOut"
              value={formData.checkOut}
              onChange={(e) => handleInputChange('checkOut', e.target.value)}
              className={errors.checkOut ? styles.error : ''}
            />
            {errors.checkOut && <span className={styles.errorText}>{errors.checkOut}</span>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="requiredGuests">Cantidad de Huéspedes *</label>
            <input
              type="number"
              id="requiredGuests"
              min="1"
              max="10"
              value={formData.requiredGuests}
              onChange={(e) => handleInputChange('requiredGuests', parseInt(e.target.value))}
              className={errors.requiredGuests ? styles.error : ''}
            />
            {errors.requiredGuests && <span className={styles.errorText}>{errors.requiredGuests}</span>}
          </div>

          <div className={styles.modalActions}>
            <button type="button" onClick={handleClose} className={styles.cancelButton}>
              Cancelar
            </button>
            <button type="submit" className={styles.submitButton}>
              Consultar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 