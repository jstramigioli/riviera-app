import React, { useState, useEffect } from 'react';
import { FaPlus, FaTrash, FaEdit, FaUser, FaTimes } from 'react-icons/fa';
import { API_URL } from '../../services/api';
import styles from './ReservationTabs.module.css';

const HuespedesTab = ({ reservation, onClientClick, onGuestUpdate }) => {
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingGuest, setEditingGuest] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    documentType: 'DNI',
    documentNumber: '',
    phone: '',
    email: '',
    address: '',
    city: ''
  });

  // Cargar acompañantes de la reserva
  useEffect(() => {
    if (reservation?.guests) {
      setGuests(reservation.guests);
    }
  }, [reservation]);

  // Obtener la cantidad de huéspedes requeridos desde el primer segmento
  const requiredGuests = reservation?.segments?.[0]?.guestCount || reservation?.requiredGuests || 1;
  
  // Calcular cuántos acompañantes se necesitan (excluyendo el cliente principal)
  // Si requiredGuests = 1, no necesita acompañantes
  // Si requiredGuests = 4, necesita 3 acompañantes (4 - 1 del principal)
  const maxGuests = Math.max(0, requiredGuests - 1);
  const currentGuests = guests.length;

  const handleAddClick = (index) => {
    setEditingGuest(index);
    setFormData({
      firstName: '',
      lastName: '',
      documentType: 'DNI',
      documentNumber: '',
      phone: '',
      email: '',
      address: '',
      city: ''
    });
    setShowModal(true);
  };

  const handleEditClick = (guest, index) => {
    setEditingGuest(index);
    setFormData({
      firstName: guest.firstName || '',
      lastName: guest.lastName || '',
      documentType: guest.documentType || 'DNI',
      documentNumber: guest.documentNumber || '',
      phone: guest.phone || '',
      email: guest.email || '',
      address: guest.address || '',
      city: guest.city || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (guestId) => {
    if (!confirm('¿Estás seguro de eliminar este acompañante?')) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/guests/${guestId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Error al eliminar el huésped');

      // Actualizar lista local
      setGuests(guests.filter(g => g.id !== guestId));
      alert('Acompañante eliminado exitosamente');
    } catch (error) {
      console.error('Error eliminando huésped:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);

      if (editingGuest === null) {
        // Crear nuevo huésped
        const response = await fetch(`${API_URL}/guests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            reservationId: reservation.id
          })
        });

        if (!response.ok) throw new Error('Error al crear el huésped');

        const newGuest = await response.json();
        setGuests([...guests, newGuest]);
        alert('Acompañante agregado exitosamente');
      } else {
        // Actualizar huésped existente
        const guestId = guests[editingGuest]?.id;
        if (!guestId) return;

        const response = await fetch(`${API_URL}/guests/${guestId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        if (!response.ok) throw new Error('Error al actualizar el huésped');

        const updatedGuest = await response.json();
        const updatedGuests = [...guests];
        updatedGuests[editingGuest] = updatedGuest;
        setGuests(updatedGuests);
        alert('Acompañante actualizado exitosamente');
      }

      setShowModal(false);
      if (onGuestUpdate) onGuestUpdate();
    } catch (error) {
      console.error('Error guardando huésped:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Crear slots vacíos para completar el grid
  // Solo mostramos slots vacíos si aún hay capacidad para más acompañantes
  const emptySlots = [];
  const actualDisplayedGuests = Math.min(currentGuests, maxGuests);
  const remainingSlots = Math.max(0, maxGuests - actualDisplayedGuests);

  for (let i = 0; i < remainingSlots; i++) {
    emptySlots.push(i);
  }

  if (!reservation) return null;

  return (
    <div className={styles.tabContent}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>👥 Huéspedes</h3>
      </div>

      {/* Grid de cards */}
      <div className={styles.guestsGrid}>
        {/* Cliente Principal */}
        <div className={styles.guestCardMain}>
          <div className={styles.guestBadge}>Cliente Principal</div>
          <div className={styles.guestIcon}>
            <FaUser />
          </div>
          <h4 className={styles.guestNameMain}>
            {reservation.mainClient?.firstName} {reservation.mainClient?.lastName}
          </h4>
          <div className={styles.guestDetails}>
            {reservation.mainClient?.email && (
              <div className={styles.guestDetail}>
                <strong>Email:</strong> {reservation.mainClient.email}
              </div>
            )}
            {reservation.mainClient?.phone && (
              <div className={styles.guestDetail}>
                <strong>Teléfono:</strong> {reservation.mainClient.phone}
              </div>
            )}
            {reservation.mainClient?.documentNumber && (
              <div className={styles.guestDetail}>
                <strong>{reservation.mainClient.documentType}:</strong> {reservation.mainClient.documentNumber}
              </div>
            )}
          </div>
        </div>

        {/* Acompañantes existentes */}
        {guests.map((guest, index) => index < maxGuests && (
          <div key={guest.id} className={styles.guestCard}>
            <div className={styles.guestCardHeader}>
              <span className={styles.guestBadgeSecundary}>Acompañante {index + 1}</span>
              <div className={styles.guestActions}>
                <button
                  className={styles.iconButton}
                  onClick={() => handleEditClick(guest, index)}
                  title="Editar"
                >
                  <FaEdit />
                </button>
                <button
                  className={styles.iconButton}
                  onClick={() => handleDelete(guest.id)}
                  title="Eliminar"
                >
                  <FaTrash />
                </button>
              </div>
            </div>
            <div className={styles.guestIcon}>
              <FaUser />
            </div>
            <h4 className={styles.guestName}>
              {guest.firstName} {guest.lastName}
            </h4>
            <div className={styles.guestDetails}>
              {guest.documentNumber && (
                <div className={styles.guestDetail}>
                  <strong>{guest.documentType}:</strong> {guest.documentNumber}
                </div>
              )}
              {guest.email && (
                <div className={styles.guestDetail}>
                  <strong>Email:</strong> {guest.email}
                </div>
              )}
              {guest.phone && (
                <div className={styles.guestDetail}>
                  <strong>Tel:</strong> {guest.phone}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Slots vacíos para agregar más acompañantes */}
        {emptySlots.map((_, index) => (
          <div
            key={`empty-${index}`}
            className={styles.emptyGuestSlot}
            onClick={() => handleAddClick(null)}
          >
            <div className={styles.emptySlotIcon}>
              <FaPlus />
            </div>
            <p className={styles.emptySlotText}>
              Agregar acompañante {currentGuests + index + 1}
            </p>
          </div>
        ))}
      </div>

      {/* Modal para agregar/editar acompañante */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>
                {editingGuest === null ? 'Agregar' : 'Editar'} Acompañante
              </h3>
              <button
                className={styles.closeButton}
                onClick={() => setShowModal(false)}
                disabled={loading}
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label htmlFor="firstName">Nombre *</label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="lastName">Apellido *</label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="documentType">Tipo de Documento</label>
                <select
                  id="documentType"
                  name="documentType"
                  value={formData.documentType}
                  onChange={handleInputChange}
                  disabled={loading}
                >
                  <option value="DNI">DNI</option>
                  <option value="Pasaporte">Pasaporte</option>
                  <option value="Cédula">Cédula</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="documentNumber">Número de Documento</label>
                <input
                  type="text"
                  id="documentNumber"
                  name="documentNumber"
                  value={formData.documentNumber}
                  onChange={handleInputChange}
                  disabled={loading}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="phone">Teléfono</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  disabled={loading}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={loading}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="address">Dirección</label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  disabled={loading}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="city">Ciudad</label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  disabled={loading}
                />
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => setShowModal(false)}
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={loading}
                >
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HuespedesTab;


