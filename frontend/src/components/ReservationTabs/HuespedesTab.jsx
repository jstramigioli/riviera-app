import React, { useState, useEffect, useMemo } from 'react';
import { FaPlus, FaTrash, FaEdit, FaUser, FaTimes, FaUserPlus } from 'react-icons/fa';
import { API_URL } from '../../services/api';
import styles from './ReservationTabs.module.css';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useAppNotice } from '../../hooks/useAppNotice';
import { getDisplaySegments } from '../../utils/virtualRoomReservation';

const HuespedesTab = ({ reservation, onClientClick, onGuestUpdate }) => {
  const { confirm, confirmDialog } = useConfirmDialog();
  const { notify, noticeDialog } = useAppNotice();
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

  useEffect(() => {
    if (reservation?.guests) {
      setGuests(reservation.guests);
    }
  }, [reservation]);

  const displaySegments = useMemo(
    () => getDisplaySegments(reservation?.segments || []),
    [reservation?.segments]
  );
  const requiredGuests =
    displaySegments[0]?.guestCount || reservation?.requiredGuests || 1;

  // Capacidad = plazas de huéspedes (Guest[]); el responsable no ocupa plaza salvo que esté en la lista
  const maxGuests = Math.max(1, Number(requiredGuests) || 1);
  const currentGuests = guests.length;
  const remainingSlots = Math.max(0, maxGuests - currentGuests);

  const holderClientId = reservation?.mainClient?.id || reservation?.mainClientId || null;
  const holderGuest = useMemo(() => {
    if (!holderClientId) return null;
    return guests.find((g) => Number(g.clientId) === Number(holderClientId)) || null;
  }, [guests, holderClientId]);
  const holderIsGuest = Boolean(holderGuest);

  const handleAddClick = () => {
    setEditingGuest(null);
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
    const target = guests.find((g) => g.id === guestId);
    const isHolder = holderClientId && Number(target?.clientId) === Number(holderClientId);
    const ok = await confirm({
      title: isHolder ? 'Quitar responsable de huéspedes' : 'Eliminar huésped',
      message: isHolder
        ? 'Se quita de la lista de huéspedes. Sigue siendo el responsable de la reserva.'
        : '¿Confirmás eliminar este huésped? Esta acción no se puede deshacer.',
      confirmText: isHolder ? 'Quitar de huéspedes' : 'Eliminar',
    });
    if (!ok) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/guests/${guestId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Error al eliminar el huésped');

      setGuests(guests.filter((g) => g.id !== guestId));
      notify({
        title: isHolder ? 'Responsable quitado de huéspedes' : 'Huésped eliminado',
        message: isHolder
          ? 'El responsable de la reserva no se modificó.'
          : 'Se eliminó correctamente.',
        type: 'success'
      });
      if (onGuestUpdate) onGuestUpdate();
    } catch (error) {
      console.error('Error eliminando huésped:', error);
      notify({ title: 'Error', message: error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleIncludeHolder = async () => {
    if (!reservation?.id || holderIsGuest || remainingSlots <= 0) return;
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/guests/from-holder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId: reservation.id })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo incorporar al responsable');
      }
      setGuests((prev) => {
        if (prev.some((g) => g.id === data.id)) return prev;
        return [...prev, data];
      });
      notify({
        title: 'Listo',
        message: 'El responsable se incorporó como huésped.',
        type: 'success'
      });
      if (onGuestUpdate) onGuestUpdate();
    } catch (error) {
      notify({ title: 'Error', message: error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);

      if (editingGuest === null) {
        const response = await fetch(`${API_URL}/guests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            reservationId: reservation.id
          })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Error al crear el huésped');

        setGuests([...guests, data]);
        notify({ title: 'Listo', message: 'Huésped agregado exitosamente', type: 'success' });
      } else {
        const guestId = guests[editingGuest]?.id;
        if (!guestId) return;

        const response = await fetch(`${API_URL}/guests/${guestId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Error al actualizar el huésped');

        const updatedGuests = [...guests];
        updatedGuests[editingGuest] = data;
        setGuests(updatedGuests);
        notify({ title: 'Listo', message: 'Huésped actualizado exitosamente', type: 'success' });
      }

      setShowModal(false);
      if (onGuestUpdate) onGuestUpdate();
    } catch (error) {
      console.error('Error guardando huésped:', error);
      notify({ title: 'Error', message: error.message, type: 'error' });
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

  const emptySlots = [];
  for (let i = 0; i < remainingSlots; i++) {
    emptySlots.push(i);
  }

  if (!reservation) return null;

  return (
    <div className={styles.tabContent}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Huéspedes</h3>
      </div>

      <div className={styles.guestsGrid}>
        {/* Responsable (administrativo; no cuenta como plaza salvo que esté en Guest[]) */}
        <div
          className={`${styles.guestCardMain} ${styles.guestCardClickable}`}
          onClick={onClientClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClientClick?.();
            }
          }}
          title="Ver perfil del responsable"
          data-testid="guest-holder-card"
        >
          <div className={styles.guestBadge}>Responsable</div>
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
                <strong>{reservation.mainClient.documentType}:</strong>{' '}
                {reservation.mainClient.documentNumber}
              </div>
            )}
            <div className={styles.guestDetail} data-testid="holder-guest-status">
              {holderIsGuest
                ? 'También figura como huésped'
                : 'No se aloja en esta habitación'}
            </div>
          </div>
          {!holderIsGuest && remainingSlots > 0 && (
            <button
              type="button"
              className={styles.includeHolderButton}
              data-testid="include-holder-as-guest"
              disabled={loading}
              onClick={(e) => {
                e.stopPropagation();
                handleIncludeHolder();
              }}
            >
              <FaUserPlus aria-hidden /> Incluir como huésped
            </button>
          )}
        </div>

        {/* Huéspedes (ocupación real) */}
        {guests.map((guest, index) => {
          const isHolderGuest =
            holderClientId && Number(guest.clientId) === Number(holderClientId);
          return (
            <div
              key={guest.id}
              className={styles.guestCard}
              data-testid={isHolderGuest ? 'holder-guest-card' : 'guest-card'}
            >
              <div className={styles.guestCardHeader}>
                <span className={styles.guestBadgeSecundary}>
                  {isHolderGuest ? 'Huésped (responsable)' : `Huésped ${index + 1}`}
                </span>
                <div className={styles.guestActions}>
                  <button
                    className={styles.iconButton}
                    onClick={() => handleEditClick(guest, index)}
                    title="Editar"
                    type="button"
                  >
                    <FaEdit />
                  </button>
                  <button
                    className={styles.iconButton}
                    onClick={() => handleDelete(guest.id)}
                    title={isHolderGuest ? 'Quitar de huéspedes' : 'Eliminar'}
                    type="button"
                    data-testid={isHolderGuest ? 'remove-holder-guest' : 'remove-guest'}
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
          );
        })}

        {emptySlots.map((_, index) => (
          <div
            key={`empty-${index}`}
            className={styles.emptyGuestSlot}
            onClick={handleAddClick}
            data-testid="empty-guest-slot"
          >
            <div className={styles.emptySlotIcon}>
              <FaPlus />
            </div>
            <p className={styles.emptySlotText}>
              Agregar huésped {currentGuests + index + 1}
            </p>
          </div>
        ))}
      </div>

      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{editingGuest === null ? 'Agregar' : 'Editar'} huésped</h3>
              <button
                className={styles.closeButton}
                onClick={() => setShowModal(false)}
                disabled={loading}
                type="button"
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
                <button type="submit" className={styles.submitButton} disabled={loading}>
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {confirmDialog}
      {noticeDialog}
    </div>
  );
};

export default HuespedesTab;
