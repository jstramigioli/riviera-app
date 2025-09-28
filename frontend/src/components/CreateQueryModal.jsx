import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useTags } from '../hooks/useTags';
import styles from '../styles/CreateQueryModal.module.css';

export default function CreateQueryModal({ 
  isOpen, 
  onClose
}) {
  const navigate = useNavigate();
  const { tags } = useTags();
  const [formData, setFormData] = useState({
    checkIn: format(new Date(), 'yyyy-MM-dd'),
    checkOut: format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    requiredGuests: 1,
    requiredTags: []
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

  const handleTagToggle = (tagId) => {
    const newTags = formData.requiredTags.includes(tagId)
      ? formData.requiredTags.filter(id => id !== tagId)
      : [...formData.requiredTags, tagId];
    
    setFormData(prev => ({
      ...prev,
      requiredTags: newTags
    }));
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

    // Cerrar el modal y navegar a la nueva página con los datos de la consulta
    handleClose();
    navigate('/consulta', { 
      state: { 
        queryData: {
          checkIn: formData.checkIn,
          checkOut: formData.checkOut,
          requiredGuests: formData.requiredGuests,
          requiredTags: formData.requiredTags
        }
      }
    });
  };

  const handleClose = () => {
    setFormData({
      checkIn: format(new Date(), 'yyyy-MM-dd'),
      checkOut: format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      requiredGuests: 1,
      requiredTags: []
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Consulta</h2>
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

          {/* Selección de Etiquetas */}
          <div className={styles.formGroup}>
            <label>Etiquetas Requeridas (Opcional)</label>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              marginTop: '8px'
            }}>
              {tags.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleTagToggle(tag.id.toString())}
                  style={{
                    padding: '8px 12px',
                    border: formData.requiredTags.includes(tag.id.toString())
                      ? '2px solid var(--color-primary)'
                      : '1px solid var(--color-border)',
                    borderRadius: '16px',
                    backgroundColor: formData.requiredTags.includes(tag.id.toString())
                      ? tag.color
                      : 'var(--color-bg-white)',
                    color: formData.requiredTags.includes(tag.id.toString())
                      ? 'var(--color-text-light)'
                      : 'var(--color-text-main)',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-medium)',
                    transition: 'all 0.2s'
                  }}
                >
                  {tag.name}
                </button>
              ))}
            </div>
            <p style={{
              margin: '8px 0 0 0',
              fontSize: 'var(--font-size-small)',
              color: 'var(--color-text-muted)'
            }}>
              Las etiquetas seleccionadas filtrarán las habitaciones disponibles según sus características
            </p>
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