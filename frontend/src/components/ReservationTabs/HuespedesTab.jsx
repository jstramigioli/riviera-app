import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FaPlus, FaTrash, FaEdit, FaUser, FaTimes, FaUserPlus } from 'react-icons/fa';
import {
  API_URL,
  getClientDocumentPhotos,
  uploadClientDocumentPhoto,
  searchClients
} from '../../services/api';
import styles from './ReservationTabs.module.css';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useAppNotice } from '../../hooks/useAppNotice';
import { useOverlayDismiss } from '../../hooks/useOverlayDismiss';
import { getDisplaySegments } from '../../utils/virtualRoomReservation';
import {
  birthDateInputToPayload,
  birthDateToInputValue,
  formatBirthDateDisplay
} from '../../constants/clientFormFields';
import { getAddressFromNotes } from '../../utils/clientAddressNotes';
import GuestPersonalFormFields, {
  EMPTY_GUEST_PERSONAL_FIELDS
} from '../GuestPersonalFormFields';

function checkInStatusLabel(displayStatus) {
  switch (displayStatus) {
    case 'completo':
      return 'Check-in completo';
    case 'incompleto':
      return 'Check-in incompleto';
    case 'expirado':
      return 'Check-in expirado';
    case 'pendiente':
      return 'Check-in pendiente';
    default:
      return null;
  }
}

const HuespedesTab = ({
  reservation,
  onClientClick,
  onGuestUpdate,
  checkInGuests = [],
  openGuestFormOnMount = false,
  onOpenGuestFormConsumed
}) => {
  const checkInByGuestId = useMemo(() => {
    const map = new Map();
    (checkInGuests || []).forEach((g) => {
      if (g?.guestId != null) map.set(Number(g.guestId), g);
    });
    return map;
  }, [checkInGuests]);
  const { confirm, confirmDialog } = useConfirmDialog();
  const { notify, noticeDialog } = useAppNotice();
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const guestOverlayDismiss = useOverlayDismiss(() => setShowModal(false));
  const [editingGuest, setEditingGuest] = useState(null);
  const [formData, setFormData] = useState({ ...EMPTY_GUEST_PERSONAL_FIELDS });
  const [photos, setPhotos] = useState({
    front: { uploaded: false, name: null },
    back: { uploaded: false, name: null }
  });
  const [photoBusy, setPhotoBusy] = useState(false);
  const [editingClientId, setEditingClientId] = useState(null);
  const [clientSearch, setClientSearch] = useState('');
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const searchAbortRef = useRef(null);

  useEffect(() => {
    if (reservation?.guests) {
      setGuests(reservation.guests);
    }
  }, [reservation]);

  useEffect(() => {
    if (!openGuestFormOnMount) return undefined;
    // Abrir form interno (agregar) desde dashboard / tabla reservas.
    setEditingGuest(null);
    setEditingClientId(null);
    setFormData({ ...EMPTY_GUEST_PERSONAL_FIELDS });
    setPhotos({
      front: { uploaded: false, name: null },
      back: { uploaded: false, name: null }
    });
    setClientSearch('');
    setClientSuggestions([]);
    setShowModal(true);
    if (typeof onOpenGuestFormConsumed === 'function') {
      onOpenGuestFormConsumed();
    }
    return undefined;
  }, [openGuestFormOnMount, onOpenGuestFormConsumed]);

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

  const fieldsFromGuest = (guest) => {
    const client = guest?.client || {};
    return {
      ...EMPTY_GUEST_PERSONAL_FIELDS,
      firstName: guest.firstName || client.firstName || '',
      lastName: guest.lastName || client.lastName || '',
      email: guest.email || client.email || '',
      phone: guest.phone || client.phone || '',
      documentType: guest.documentType || client.documentType || 'DNI',
      documentNumber: guest.documentNumber || client.documentNumber || '',
      documentIssuingCountry:
        guest.documentIssuingCountry ||
        client.documentIssuingCountry ||
        client.country ||
        'AR',
      birthDate: birthDateToInputValue(client.birthDate),
      country: client.country || 'AR',
      province: client.province || '',
      city: guest.city || client.city || '',
      address: guest.address || getAddressFromNotes(client.notes) || '',
      wantsPromotions: Boolean(client.wantsPromotions),
      dietVegetariano: Boolean(guest.dietVegetariano),
      dietVegano: Boolean(guest.dietVegano),
      dietCeliaco: Boolean(guest.dietCeliaco)
    };
  };

  const fieldsFromClient = (client) => ({
    ...EMPTY_GUEST_PERSONAL_FIELDS,
    firstName: client.firstName || '',
    lastName: client.lastName || '',
    email: client.email || '',
    phone: client.phone || '',
    documentType: client.documentType || 'DNI',
    documentNumber: client.documentNumber || '',
    documentIssuingCountry: client.documentIssuingCountry || client.country || 'AR',
    birthDate: birthDateToInputValue(client.birthDate),
    country: client.country || 'AR',
    province: client.province || '',
    city: client.city || '',
    address: getAddressFromNotes(client.notes) || '',
    wantsPromotions: Boolean(client.wantsPromotions)
  });

  useEffect(() => {
    if (!showModal) return undefined;
    const q = clientSearch.trim();
    if (q.length < 2) {
      setClientSuggestions([]);
      return undefined;
    }
    if (searchAbortRef.current) searchAbortRef.current.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    const timer = setTimeout(async () => {
      setSearchBusy(true);
      try {
        const list = await searchClients(q, { signal: controller.signal });
        setClientSuggestions(Array.isArray(list) ? list : []);
      } catch (err) {
        if (err?.name !== 'AbortError') setClientSuggestions([]);
      } finally {
        setSearchBusy(false);
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [clientSearch, showModal]);

  const loadPhotosForClient = async (clientId) => {
    if (!clientId) {
      setPhotos({
        front: { uploaded: false, name: null },
        back: { uploaded: false, name: null }
      });
      return;
    }
    try {
      const meta = await getClientDocumentPhotos(clientId);
      setPhotos({
        front: {
          uploaded: Boolean(meta?.front?.exists),
          name: meta?.front?.originalName || (meta?.front?.exists ? 'Frente' : null)
        },
        back: {
          uploaded: Boolean(meta?.back?.exists),
          name: meta?.back?.originalName || (meta?.back?.exists ? 'Dorso' : null)
        }
      });
    } catch {
      setPhotos({
        front: { uploaded: false, name: null },
        back: { uploaded: false, name: null }
      });
    }
  };

  const resetClientSearch = () => {
    setClientSearch('');
    setClientSuggestions([]);
  };

  const handleAddClick = () => {
    setEditingGuest(null);
    setEditingClientId(null);
    setFormData({ ...EMPTY_GUEST_PERSONAL_FIELDS });
    setPhotos({
      front: { uploaded: false, name: null },
      back: { uploaded: false, name: null }
    });
    resetClientSearch();
    setShowModal(true);
  };

  const handleSelectSuggestedClient = async (client) => {
    if (!client) return;
    setFormData(fieldsFromClient(client));
    setEditingClientId(client.id);
    resetClientSearch();
    await loadPhotosForClient(client.id);
  };

  const handleEditClick = async (guest, index) => {
    setEditingGuest(index);
    setFormData(fieldsFromGuest(guest));
    let cid = guest.clientId || guest.client?.id || null;
    setEditingClientId(cid);
    resetClientSearch();
    setShowModal(true);
    // Si la reserva no traía client embebido, refrescar el huésped.
    if (!guest.client && guest.id) {
      try {
        const response = await fetch(`${API_URL}/guests/${guest.id}`);
        const data = await response.json().catch(() => ({}));
        if (response.ok && data?.id) {
          setFormData(fieldsFromGuest(data));
          cid = data.clientId || data.client?.id || cid;
          setEditingClientId(cid);
          setGuests((prev) =>
            prev.map((g) => (g.id === data.id ? { ...g, ...data } : g))
          );
        }
      } catch {
        /* keep local fields */
      }
    }
    await loadPhotosForClient(cid);
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
      const payload = {
        ...formData,
        birthDate: birthDateInputToPayload(formData.birthDate),
        syncClient: true,
        clientId: editingClientId || undefined
      };

      if (editingGuest === null) {
        const response = await fetch(`${API_URL}/guests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            reservationId: reservation.id
          })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Error al crear el huésped');

        setGuests([...guests, data]);
        setEditingClientId(data.clientId || data.client?.id || null);
        notify({
          title: 'Listo',
          message: data.needsManualReview
            ? 'Huésped agregado. Revisá identidad: el documento coincide con otro nombre.'
            : 'Huésped agregado exitosamente',
          type: data.needsManualReview ? 'warning' : 'success'
        });
      } else {
        const guestId = guests[editingGuest]?.id;
        if (!guestId) return;

        const response = await fetch(`${API_URL}/guests/${guestId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Error al actualizar el huésped');

        const updatedGuests = [...guests];
        updatedGuests[editingGuest] = data;
        setGuests(updatedGuests);
        setEditingClientId(data.clientId || data.client?.id || null);
        notify({
          title: 'Listo',
          message: data.needsManualReview
            ? 'Huésped actualizado. Revisá identidad: el documento coincide con otro nombre.'
            : 'Huésped actualizado exitosamente',
          type: data.needsManualReview ? 'warning' : 'success'
        });
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
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleLocationChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePhotoSelect = async (file, slot) => {
    if (!file || photoBusy) return;
    let clientId = editingClientId;
    // Si aún no hay client (alta nueva), guardar primero para obtener clientId.
    if (!clientId) {
      try {
        setLoading(true);
        const payload = {
          ...formData,
          birthDate: birthDateInputToPayload(formData.birthDate),
          syncClient: true,
          reservationId: reservation.id
        };
        if (editingGuest === null) {
          if (!formData.firstName || !formData.lastName) {
            throw new Error('Completá nombre y apellido antes de subir fotos');
          }
          const response = await fetch(`${API_URL}/guests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || 'Error al crear el huésped');
          setGuests((prev) => [...prev, data]);
          setEditingGuest(guests.length);
          clientId = data.clientId || data.client?.id;
          setEditingClientId(clientId);
        } else {
          const guestId = guests[editingGuest]?.id;
          const response = await fetch(`${API_URL}/guests/${guestId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || 'Error al actualizar el huésped');
          const updatedGuests = [...guests];
          updatedGuests[editingGuest] = data;
          setGuests(updatedGuests);
          clientId = data.clientId || data.client?.id;
          setEditingClientId(clientId);
        }
        if (onGuestUpdate) onGuestUpdate();
      } catch (error) {
        notify({ title: 'Error', message: error.message, type: 'error' });
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    }
    if (!clientId) {
      notify({
        title: 'Sin perfil',
        message: 'No se pudo vincular un cliente para las fotos',
        type: 'warning'
      });
      return;
    }
    setPhotoBusy(true);
    try {
      const result = await uploadClientDocumentPhoto(clientId, file, slot);
      setPhotos((prev) => ({
        ...prev,
        [slot]: {
          uploaded: true,
          name: result.originalName || (slot === 'back' ? 'Dorso' : 'Frente')
        }
      }));
    } catch (error) {
      notify({ title: 'Error', message: error.message, type: 'error' });
    } finally {
      setPhotoBusy(false);
    }
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
        {checkInGuests?.length > 0 && (
          <span className={styles.checkInProgress} data-testid="huespedes-checkin-progress">
            Check-in online:{' '}
            {checkInGuests.filter((g) => g.displayStatus === 'completo' || g.completed).length}/
            {checkInGuests.length}
          </span>
        )}
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
            {reservation.mainClient?.birthDate && (
              <div className={styles.guestDetail}>
                <strong>Nacimiento:</strong>{' '}
                {formatBirthDateDisplay(reservation.mainClient.birthDate)}
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
          const checkIn = checkInByGuestId.get(Number(guest.id));
          const checkInLabel = checkInStatusLabel(checkIn?.displayStatus);
          return (
            <div
              key={guest.id}
              className={styles.guestCard}
              data-testid={isHolderGuest ? 'holder-guest-card' : 'guest-card'}
              data-checkin-status={checkIn?.displayStatus || undefined}
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
              {checkInLabel && (
                <div
                  className={`${styles.checkInStatus} ${styles[`checkIn_${checkIn.displayStatus}`] || ''}`}
                  data-testid="guest-checkin-status"
                >
                  {checkInLabel}
                </div>
              )}
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
                {(guest.dietVegetariano || guest.dietVegano || guest.dietCeliaco) && (
                  <div className={styles.guestDetail} data-testid="guest-diet-summary">
                    <strong>Dieta:</strong>{' '}
                    {[
                      guest.dietVegetariano ? 'Vegetariano' : null,
                      guest.dietVegano ? 'Vegano' : null,
                      guest.dietCeliaco ? 'Celíaco' : null
                    ]
                      .filter(Boolean)
                      .join(' · ')}
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
        <div className={styles.modalOverlay} {...guestOverlayDismiss}>
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
              <div className={styles.guestClientSearch} data-testid="guest-client-search">
                <label className={styles.guestClientSearchLabel} htmlFor="guest-client-search-input">
                  Buscar cliente existente (opcional)
                </label>
                <input
                  id="guest-client-search-input"
                  type="search"
                  className={styles.guestClientSearchInput}
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Nombre, apellido o documento…"
                  autoComplete="off"
                  disabled={loading || photoBusy}
                />
                {editingClientId && (
                  <p className={styles.guestClientSearchHint}>
                    Cliente vinculado #{editingClientId}. Podés editar los campos abajo.
                    <button
                      type="button"
                      className={styles.guestClientClearLink}
                      onClick={() => {
                        setEditingClientId(null);
                        setFormData({ ...EMPTY_GUEST_PERSONAL_FIELDS });
                        setPhotos({
                          front: { uploaded: false, name: null },
                          back: { uploaded: false, name: null }
                        });
                      }}
                    >
                      Limpiar vínculo
                    </button>
                  </p>
                )}
                {searchBusy && <p className={styles.guestClientSearchHint}>Buscando…</p>}
                {clientSuggestions.length > 0 && (
                  <ul className={styles.guestClientSuggestions} role="listbox">
                    {clientSuggestions.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className={styles.guestClientSuggestion}
                          onClick={() => handleSelectSuggestedClient(c)}
                        >
                          <span className={styles.guestClientSuggestionName}>
                            {c.firstName} {c.lastName}
                          </span>
                          <span className={styles.guestClientSuggestionDoc}>
                            {c.documentType || 'DNI'} {c.documentNumber || '—'}
                            {c.documentIssuingCountry ? ` · ${c.documentIssuingCountry}` : ''}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <GuestPersonalFormFields
                fields={formData}
                onChange={handleInputChange}
                onLocationChange={handleLocationChange}
                disabled={loading || photoBusy}
                birthDateRequired={false}
                showPhotos
                photos={photos}
                onPhotoSelect={handlePhotoSelect}
                photoBusy={photoBusy}
                photosRequired={false}
                photoTestIdPrefix="reservation-guest-doc"
              />

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => setShowModal(false)}
                  disabled={loading || photoBusy}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={loading || photoBusy}
                >
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
