import React, { useState, useEffect } from 'react';
import LocationSelector from './LocationSelector';
import api from '../services/api';
import styles from './EditClientModal.module.css';

const EditClientModal = ({ client, isOpen, onClose, onClientUpdated }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    documentType: 'DNI',
    documentNumber: '',
    country: 'AR',
    province: '',
    city: '',
    wantsPromotions: false,
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Función para extraer domicilio de las notas
  const getAddressFromNotes = (notes) => {
    if (!notes) return '';
    const addressMatch = notes.match(/Domicilio:\s*(.+)/);
    return addressMatch ? addressMatch[1].trim() : '';
  };

  // Función para crear notas con domicilio
  const createNotesWithAddress = (notes, address) => {
    if (!address) return notes || '';
    
    // Si ya hay notas con domicilio, actualizar
    if (notes && notes.includes('Domicilio:')) {
      return notes.replace(/Domicilio:\s*[^\n]*/, `Domicilio: ${address}`);
    }
    
    // Si hay otras notas, agregar domicilio al final
    if (notes) {
      return `${notes}\nDomicilio: ${address}`;
    }
    
    // Si no hay notas, crear solo el domicilio
    return `Domicilio: ${address}`;
  };

  // Inicializar formulario cuando se abre el modal
  useEffect(() => {
    if (client && isOpen) {
      const address = getAddressFromNotes(client.notes);
      const notesWithoutAddress = client.notes?.replace(/Domicilio:\s*[^\n]*\n?/, '').trim() || '';
      
      setFormData({
        firstName: client.firstName || '',
        lastName: client.lastName || '',
        email: client.email || '',
        phone: client.phone || '',
        documentType: client.documentType || 'DNI',
        documentNumber: client.documentNumber || '',
        country: client.country || 'AR',
        province: client.province || '',
        city: client.city || '',
        wantsPromotions: client.wantsPromotions || false,
        notes: notesWithoutAddress,
        address: address
      });
      setError(null);
    }
  }, [client, isOpen]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleLocationChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const notesWithAddress = createNotesWithAddress(formData.notes, formData.address);
      
      const updatedClient = await api.updateClient(client.id, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        documentType: formData.documentType,
        documentNumber: formData.documentNumber,
        country: formData.country,
        province: formData.province,
        city: formData.city,
        wantsPromotions: formData.wantsPromotions,
        notes: notesWithAddress
      });

      onClientUpdated(updatedClient);
      onClose();
    } catch (error) {
      console.error('Error actualizando cliente:', error);
      setError('Error al actualizar el cliente. Por favor, inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>✏️ Editar Cliente</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <div className={styles.error}>
              ❌ {error}
            </div>
          )}

          <div className={styles.formGrid}>
            {/* Información Personal */}
            <div className={styles.section}>
              <h3>👤 Información Personal</h3>
              
              <div className={styles.fieldGroup}>
                <label htmlFor="firstName">Nombre *</label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                  className={styles.input}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="lastName">Apellido *</label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                  className={styles.input}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={styles.input}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="phone">Teléfono</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className={styles.input}
                />
              </div>
            </div>

            {/* Documentación */}
            <div className={styles.section}>
              <h3>📄 Documentación</h3>
              
              <div className={styles.fieldGroup}>
                <label htmlFor="documentType">Tipo de Documento</label>
                <select
                  id="documentType"
                  name="documentType"
                  value={formData.documentType}
                  onChange={handleInputChange}
                  className={styles.select}
                >
                  <option value="DNI">DNI</option>
                  <option value="Pasaporte">Pasaporte</option>
                  <option value="Cédula">Cédula</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="documentNumber">Número de Documento</label>
                <input
                  type="text"
                  id="documentNumber"
                  name="documentNumber"
                  value={formData.documentNumber}
                  onChange={handleInputChange}
                  className={styles.input}
                />
              </div>
            </div>

            {/* Ubicación */}
            <div className={styles.section}>
              <h3>📍 Ubicación</h3>
              
              <LocationSelector
                country={formData.country}
                province={formData.province}
                city={formData.city}
                onCountryChange={(value) => handleLocationChange('country', value)}
                onProvinceChange={(value) => handleLocationChange('province', value)}
                onCityChange={(value) => handleLocationChange('city', value)}
              />
            </div>

            {/* Domicilio */}
            <div className={styles.section}>
              <h3>🏠 Domicilio</h3>
              
              <div className={styles.fieldGroup}>
                <label htmlFor="address">Dirección</label>
                <textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Ingresa la dirección completa"
                  className={styles.textarea}
                  rows="3"
                />
              </div>
            </div>

            {/* Preferencias */}
            <div className={styles.section}>
              <h3>⚙️ Preferencias</h3>
              
              <div className={styles.fieldGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    name="wantsPromotions"
                    checked={formData.wantsPromotions}
                    onChange={handleInputChange}
                    className={styles.checkbox}
                  />
                  Deseo recibir información de promociones
                </label>
              </div>
            </div>

            {/* Notas */}
            <div className={styles.section}>
              <h3>📝 Notas Adicionales</h3>
              
              <div className={styles.fieldGroup}>
                <label htmlFor="notes">Notas</label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Información adicional del cliente"
                  className={styles.textarea}
                  rows="3"
                />
              </div>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelButton}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.saveButton}
              disabled={loading}
            >
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditClientModal; 