import React, { useState, useEffect } from 'react';
import LocationSelector from './LocationSelector';
import api from '../services/api';
import styles from './FieldEditor.module.css';

const FieldEditor = ({ 
  fieldName, 
  currentValue, 
  onSave, 
  onCancel, 
  clientId,
  client 
}) => {
  const [value, setValue] = useState('');
  const [documentType, setDocumentType] = useState('DNI');
  const [documentNumber, setDocumentNumber] = useState('');
  const [location, setLocation] = useState({
    country: 'AR',
    province: '',
    city: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (fieldName === 'document') {
      setDocumentType(client.documentType || 'DNI');
      setDocumentNumber(client.documentNumber || '');
    } else if (['country', 'province', 'city'].includes(fieldName)) {
      setLocation({
        country: client.country || 'AR',
        province: client.province || '',
        city: client.city || ''
      });
    } else {
      setValue(currentValue || '');
    }
  }, [fieldName, currentValue, client]);

  const getFieldLabel = () => {
    const labels = {
      firstName: 'Nombre',
      lastName: 'Apellido',
      email: 'Email',
      phone: 'Teléfono',
      document: 'Documento',
      country: 'País',
      province: 'Provincia',
      city: 'Ciudad'
    };
    return labels[fieldName] || fieldName;
  };

  const validateField = (fieldValue) => {
    switch (fieldName) {
      case 'email':
        if (fieldValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fieldValue)) {
          return 'Formato de email inválido';
        }
        return '';
      
      case 'phone':
        if (fieldValue && !/^[\d\s\-\+\(\)]+$/.test(fieldValue)) {
          return 'Teléfono inválido (solo números, espacios, guiones, paréntesis y +)';
        }
        return '';
      
      case 'document':
        if (fieldName === 'document' && !documentNumber.trim()) {
          return 'Número de documento es requerido';
        }
        if (fieldName === 'document' && documentNumber.length < 7) {
          return 'Documento debe tener al menos 7 caracteres';
        }
        return '';
      
      default:
        return '';
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');

      // El backend siempre requiere firstName y lastName
      let updateData = {
        firstName: client.firstName,
        lastName: client.lastName
      };
      let fieldValue = '';

      if (fieldName === 'document') {
        fieldValue = documentNumber;
        const validationError = validateField();
        if (validationError) {
          setError(validationError);
          return;
        }
        updateData = {
          ...updateData,
          documentType,
          documentNumber
        };
      } else if (['country', 'province', 'city'].includes(fieldName)) {
        fieldValue = location[fieldName];
        updateData = {
          ...updateData,
          ...location
        };
      } else {
        fieldValue = value;
        const validationError = validateField(fieldValue);
        if (validationError) {
          setError(validationError);
          return;
        }
        updateData = {
          ...updateData,
          [fieldName]: fieldValue
        };
      }

      console.log('Enviando datos al backend:', updateData);
      const updatedClient = await api.updateClient(clientId, updateData);
      console.log('Respuesta del backend:', updatedClient);
      onSave(updatedClient);
    } catch (error) {
      console.error('Error actualizando campo:', error);
      setError('Error al actualizar el campo. Por favor, inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !loading) {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handlePhoneChange = (e) => {
    const inputValue = e.target.value;
    // Permitir solo números, espacios, guiones, paréntesis y +
    if (/^[\d\s\-\+\(\)]*$/.test(inputValue)) {
      setValue(inputValue);
    }
  };

  const renderField = () => {
    switch (fieldName) {
      case 'phone':
        return (
          <input
            type="tel"
            value={value}
            onChange={handlePhoneChange}
            onKeyDown={handleKeyDown}
            className={styles.fieldInput}
            placeholder="Ej: +54 11 1234-5678"
            autoFocus
          />
        );

      case 'email':
        return (
          <input
            type="email"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className={styles.fieldInput}
            placeholder="ejemplo@correo.com"
            autoFocus
          />
        );

      case 'document':
        return (
          <div className={styles.documentEditor}>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className={styles.documentTypeSelect}
            >
              <option value="DNI">DNI</option>
              <option value="Pasaporte">Pasaporte</option>
              <option value="Cédula">Cédula</option>
              <option value="Otro">Otro</option>
            </select>
            <input
              type="text"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              onKeyDown={handleKeyDown}
              className={styles.documentNumberInput}
              placeholder="Número de documento"
              autoFocus
            />
          </div>
        );

      case 'country':
      case 'province':
      case 'city':
        return (
          <div className={styles.locationEditor}>
            <LocationSelector
              country={location.country}
              province={location.province}
              city={location.city}
              onCountryChange={(value) => setLocation(prev => ({ ...prev, country: value }))}
              onProvinceChange={(value) => setLocation(prev => ({ ...prev, province: value }))}
              onCityChange={(value) => setLocation(prev => ({ ...prev, city: value }))}
              required={false}
            />
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className={styles.fieldInput}
            placeholder={`Ingrese ${getFieldLabel().toLowerCase()}`}
            autoFocus
          />
        );
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3>Editar {getFieldLabel()}</h3>
          <button 
            className={styles.modalClose}
            onClick={onCancel}
            disabled={loading}
          >
            ×
          </button>
        </div>
        
        <div className={styles.modalBody}>
          {error && (
            <div className={styles.errorMessage}>
              ⚠️ {error}
            </div>
          )}
          
          {renderField()}
        </div>
        
        <div className={styles.modalFooter}>
          <button 
            className={styles.modalButtonCancel}
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </button>
          <button 
            className={styles.modalButtonSave}
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FieldEditor;
