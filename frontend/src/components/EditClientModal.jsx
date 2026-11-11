import { FiX } from 'react-icons/fi';
import React, { useState, useEffect } from 'react';
import LocationSelector from './LocationSelector';
import {
  CLIENT_DOCUMENT_TYPES,
  VEHICLE_PLATE_HINT,
  VEHICLE_PLATE_LABEL
} from '../constants/clientFormFields';
import {
  createNotesWithAddress,
  getAddressFromNotes,
  stripAddressFromNotes
} from '../utils/clientAddressNotes';
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
    vehiclePlate: '',
    wantsPromotions: false,
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Inicializar formulario cuando se abre el modal
  useEffect(() => {
    if (client && isOpen) {
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
        vehiclePlate: client.vehiclePlate || '',
        wantsPromotions: client.wantsPromotions || false,
        notes: stripAddressFromNotes(client.notes),
        address: getAddressFromNotes(client.notes)
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
        vehiclePlate: formData.vehiclePlate,
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
          <h2> Editar Cliente</h2>
          <button className={styles.closeButton} onClick={onClose}><FiX aria-hidden="true" /></button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          <div className={styles.formGrid}>
            {/* Información Personal */}
            <div className={styles.section}>
              <h3> Información Personal</h3>
              
              <div className={styles.fieldGroup}>
                <label htmlFor="firstName"> Nombre *</label>
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
                <label htmlFor="lastName"> Apellido *</label>
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
                <label htmlFor="email"> Email</label>
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
                <label htmlFor="phone"> Teléfono</label>
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
              <h3> Documentación</h3>
              
              <div className={styles.fieldGroup}>
                <label htmlFor="documentType"> Tipo de Documento</label>
                <select
                  id="documentType"
                  name="documentType"
                  value={formData.documentType}
                  onChange={handleInputChange}
                  className={styles.select}
                >
                  {CLIENT_DOCUMENT_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="documentNumber"> Número de Documento</label>
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
              <h3> Ubicación</h3>
              
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
              <h3> Domicilio</h3>
              
              <div className={styles.fieldGroup}>
                <label htmlFor="address"> Dirección</label>
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

            {/* Vehículo — mismos label/hint que check-in online */}
            <div className={styles.section}>
              <h3>Vehículo</h3>

              <div className={styles.fieldGroup}>
                <label htmlFor="vehiclePlate">{VEHICLE_PLATE_LABEL}</label>
                <input
                  type="text"
                  id="vehiclePlate"
                  name="vehiclePlate"
                  value={formData.vehiclePlate}
                  onChange={handleInputChange}
                  placeholder="Ej. AB123CD"
                  autoCapitalize="characters"
                  className={styles.input}
                />
                <span className={styles.hint}>{VEHICLE_PLATE_HINT}</span>
              </div>
            </div>

            {/* Preferencias */}
            <div className={styles.section}>
              <h3> Preferencias</h3>
              
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
              <h3> Notas Adicionales</h3>
              
              <div className={styles.fieldGroup}>
                <label htmlFor="notes"> Notas</label>
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