import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { FiCheck, FiChevronLeft, FiUser } from 'react-icons/fi';
import ReservationStayTimeline from '../components/ReservationStayTimeline';
import GuestPersonalFormFields, {
  EMPTY_GUEST_PERSONAL_FIELDS
} from '../components/GuestPersonalFormFields';
import {
  VEHICLE_PLATE_HINT,
  VEHICLE_PLATE_LABEL,
  birthDateInputToPayload,
  birthDateToInputValue
} from '../constants/clientFormFields';
import styles from './PublicCheckIn.module.css';

// Preferir same-origin /api (proxy Vite) para evitar CORS / 127 vs localhost en local.
const CHECKIN_API_BASE = import.meta.env.VITE_API_URL || '/api';

function statusLabel(displayStatus) {
  switch (displayStatus) {
    case 'completo':
      return 'Completo';
    case 'incompleto':
      return 'Incompleto';
    case 'expirado':
      return 'Expirado';
    default:
      return 'Pendiente';
  }
}

export default function PublicCheckIn() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState('');
  const [reservation, setReservation] = useState(null);
  const [guests, setGuests] = useState([]);
  const [vehicle, setVehicle] = useState(null);
  const [progress, setProgress] = useState({ completed: 0, total: 0, label: '0/0' });
  const [selectedGuestId, setSelectedGuestId] = useState(null);
  const [editingVehicle, setEditingVehicle] = useState(false);
  const [vehiclePlateDraft, setVehiclePlateDraft] = useState('');
  const [fields, setFields] = useState({ ...EMPTY_GUEST_PERSONAL_FIELDS });
  // Fotos siempre nuevas: no prefill de archivos previos del cliente.
  const [photos, setPhotos] = useState({
    front: { uploaded: false, name: null },
    back: { uploaded: false, name: null }
  });
  const [justCompletedGuest, setJustCompletedGuest] = useState(false);

  const applyGuestForm = useCallback((guest) => {
    if (!guest) return;
    setEditingVehicle(false);
    setSelectedGuestId(guest.guestId);
    // Form externo: sin precarga de ficha; solo snapshot de esta estadía si ya cargó datos.
    const snap = guest.fields || {};
    const hasStaySnapshot = Boolean(
      snap.firstName || snap.lastName || snap.documentNumber || guest.completed
    );
    setFields(
      hasStaySnapshot
        ? {
            ...EMPTY_GUEST_PERSONAL_FIELDS,
            ...snap,
            country: snap.country || 'AR',
            documentType: snap.documentType || 'DNI',
            documentIssuingCountry: snap.documentIssuingCountry || 'AR',
            birthDate: birthDateToInputValue(snap.birthDate),
            wantsPromotions: Boolean(snap.wantsPromotions),
            dietVegetariano: Boolean(snap.dietVegetariano),
            dietVegano: Boolean(snap.dietVegano),
            dietCeliaco: Boolean(snap.dietCeliaco),
            dietOtra: snap.dietOtra || ''
          }
        : { ...EMPTY_GUEST_PERSONAL_FIELDS }
    );
    setPhotos({
      front: {
        uploaded: Boolean(guest.documentPhotos?.frontUploaded),
        name: guest.documentPhotos?.frontUploaded ? 'Frente cargado' : null
      },
      back: {
        uploaded: Boolean(guest.documentPhotos?.backUploaded),
        name: guest.documentPhotos?.backUploaded ? 'Dorso cargado' : null
      }
    });
    setJustCompletedGuest(false);
    setError('');
  }, []);

  const loadCheckIn = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${CHECKIN_API_BASE}/public/check-in/${encodeURIComponent(token)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo cargar el check-in');
      }
      setReservation(data.reservation || null);
      setVehicle(
        data.vehicle
          ? {
              plate: data.vehicle.plate || '',
              completed: Boolean(data.vehicle.completed),
              displayStatus: data.vehicle.displayStatus || 'pendiente',
              vehicleType: data.vehicle.vehicleType || null,
              required: true
            }
          : null
      );
      const list = Array.isArray(data.guests) ? data.guests : [];
      setGuests(list);
      setProgress(data.progress || { completed: 0, total: list.length, label: `0/${list.length}` });
      return list;
    } catch (err) {
      setError(err.message || 'Error al cargar');
      return null;
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await loadCheckIn();
      if (cancelled || !list) return;
      // Con varios huéspedes (o vehículo), empezar en la lista de cards.
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCheckIn]);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setFields((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  }

  function handleLocationChange(field, value) {
    setFields((prev) => ({ ...prev, [field]: value }));
  }

  async function handlePhotoSelect(file, slot) {
    if (!file || photoBusy || !token || !selectedGuestId) return;
    setPhotoBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('guestId', String(selectedGuestId));
      const res = await fetch(
        `${CHECKIN_API_BASE}/public/check-in/${encodeURIComponent(token)}/document-photos/${slot}`,
        { method: 'POST', body: form }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo subir la foto');
      }
      setPhotos((prev) => ({
        ...prev,
        [slot]: {
          uploaded: true,
          name: data.originalName || (slot === 'back' ? 'Dorso cargado' : 'Frente cargado')
        }
      }));
    } catch (err) {
      setError(err.message || 'Error al subir la foto');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!selectedGuestId) return;
    setSaving(true);
    setError('');
    try {
      if (!fields.birthDate) {
        throw new Error('La fecha de nacimiento es obligatoria');
      }
      if (!photos.front.uploaded || !photos.back.uploaded) {
        throw new Error('Debés subir la foto del frente y del dorso del documento');
      }
      const res = await fetch(`${CHECKIN_API_BASE}/public/check-in/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...fields,
          guestId: selectedGuestId,
          birthDate: birthDateInputToPayload(fields.birthDate)
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo guardar');
      }
      if (data.progress) setProgress(data.progress);
      setJustCompletedGuest(true);
      const list = await loadCheckIn();
      if (list) {
        setSelectedGuestId(null);
      }
    } catch (err) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveVehicle(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch(
        `${CHECKIN_API_BASE}/public/check-in/${encodeURIComponent(token)}/vehicle`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vehiclePlate: vehiclePlateDraft })
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo guardar el vehículo');
      }
      setVehicle(
        data.vehicle || {
          plate: vehiclePlateDraft,
          completed: Boolean(String(vehiclePlateDraft || '').trim()),
          displayStatus: String(vehiclePlateDraft || '').trim() ? 'completo' : 'pendiente'
        }
      );
      setReservation((prev) =>
        prev
          ? { ...prev, vehiclePlate: data.vehicle?.plate ?? vehiclePlateDraft }
          : prev
      );
      setEditingVehicle(false);
    } catch (err) {
      setError(err.message || 'Error al guardar el vehículo');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !guests.length && !reservation) {
    return (
      <div className={styles.page}>
        <div className={styles.shell}>
          <p className={styles.muted}>Cargando check-in…</p>
        </div>
      </div>
    );
  }

  if (error && !guests.length && !reservation) {
    return (
      <div className={styles.page}>
        <div className={styles.shell}>
          <h1 className={styles.brand}>Hotel Riviera</h1>
          <p className={styles.error}>{error}</p>
        </div>
      </div>
    );
  }

  const allDone = progress.total > 0 && progress.completed === progress.total;
  const showList = !selectedGuestId && !editingVehicle;

  const timelineBlock = reservation ? (
    <div className={styles.timelineWrap} data-testid="checkin-stay-timeline">
      <ReservationStayTimeline
        reservation={reservation}
        hideHeader
        hideTotal
        hideRoomNumber
        checkInTitle="Ingreso"
        checkOutTitle="Egreso"
        compact
        orientation="auto"
      />
    </div>
  ) : null;

  if (allDone && showList) {
    return (
      <div className={styles.page}>
        <div className={styles.shell}>
          <h1 className={styles.brand}>Hotel Riviera</h1>
          {timelineBlock}
          <div className={styles.successBox}>
            <FiCheck aria-hidden className={styles.successIcon} />
            <div>
              <h2 className={styles.heading}>Check-in completo</h2>
              <p className={styles.muted}>
                Gracias. Todos los huéspedes ({progress.label}) ya presentaron sus datos
                {reservation?.id ? ` para la reserva #${reservation.id}` : ''}.
              </p>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => {
                  const first = guests[0];
                  if (first) applyGuestForm(first);
                }}
              >
                Ver o editar un huésped
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <h1 className={styles.brand}>Hotel Riviera</h1>
          {timelineBlock}
          <p className={styles.progress} data-testid="checkin-progress">
            Progreso: {progress.label}
          </p>
        </header>

        {error && <p className={styles.error}>{error}</p>}
        {justCompletedGuest && showList && (
          <p className={styles.okBanner}>Datos guardados. Podés continuar con otro huésped.</p>
        )}

        {showList ? (
          <section className={styles.guestList} data-testid="checkin-guest-list">
            <h2 className={styles.sectionTitle}>Huéspedes</h2>
            <div className={styles.guestCards}>
              {guests.map((guest) => (
                <button
                  key={guest.guestId}
                  type="button"
                  className={styles.guestCard}
                  data-testid="checkin-guest-card"
                  data-status={guest.displayStatus}
                  onClick={() => applyGuestForm(guest)}
                >
                  <span className={styles.guestCardIcon} aria-hidden>
                    <FiUser />
                  </span>
                  <span className={styles.guestCardBody}>
                    <span className={styles.guestCardName}>{guest.name || 'Huésped'}</span>
                    <span
                      className={`${styles.guestStatus} ${styles[`status_${guest.displayStatus}`] || ''}`}
                    >
                      {statusLabel(guest.displayStatus)}
                    </span>
                  </span>
                  <span className={styles.guestCardAction}>
                    {guest.completed ? 'Ver / editar' : 'Completar'}
                  </span>
                </button>
              ))}

              {vehicle && (
                <button
                  type="button"
                  className={styles.guestCard}
                  data-testid="checkin-vehicle-card"
                  data-status={vehicle.displayStatus || (vehicle.completed ? 'completo' : 'pendiente')}
                  onClick={() => {
                    setSelectedGuestId(null);
                    setVehiclePlateDraft(vehicle.plate || '');
                    setEditingVehicle(true);
                    setError('');
                  }}
                >
                  <span className={styles.guestCardIcon} aria-hidden>
                    <span className={styles.vehicleGlyph}>P</span>
                  </span>
                  <span className={styles.guestCardBody}>
                    <span className={styles.guestCardName}>Vehículo</span>
                    <span
                      className={`${styles.guestStatus} ${
                        styles[`status_${vehicle.displayStatus || (vehicle.completed ? 'completo' : 'pendiente')}`] || ''
                      }`}
                    >
                      {vehicle.plate
                        ? vehicle.plate
                        : statusLabel(vehicle.displayStatus || 'pendiente')}
                    </span>
                  </span>
                  <span className={styles.guestCardAction}>
                    {vehicle.completed ? 'Ver / editar' : 'Completar'}
                  </span>
                </button>
              )}
            </div>
          </section>
        ) : editingVehicle && vehicle ? (
          <>
            <button
              type="button"
              className={styles.backButton}
              onClick={() => {
                setEditingVehicle(false);
                setError('');
              }}
            >
              <FiChevronLeft aria-hidden /> Volver
            </button>
            <form className={styles.form} onSubmit={handleSaveVehicle}>
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Vehículo</h2>
                <label className={styles.field}>
                  <span>{VEHICLE_PLATE_LABEL}</span>
                  <input
                    name="vehiclePlate"
                    value={vehiclePlateDraft}
                    onChange={(e) => setVehiclePlateDraft(e.target.value)}
                    placeholder="Ej. AB123CD"
                    autoCapitalize="characters"
                    data-testid="checkin-vehicle-plate"
                  />
                  <span className={styles.hint}>{VEHICLE_PLATE_HINT}</span>
                </label>
              </section>
              <div className={styles.actions}>
                <button type="submit" className={styles.submit} disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar patente'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <button
              type="button"
              className={styles.backButton}
              onClick={() => {
                setSelectedGuestId(null);
                setError('');
              }}
            >
              <FiChevronLeft aria-hidden /> Volver a huéspedes
            </button>

            <form onSubmit={handleSubmit}>
              <GuestPersonalFormFields
                fields={fields}
                onChange={handleChange}
                onLocationChange={handleLocationChange}
                disabled={saving || photoBusy}
                birthDateRequired
                showPhotos
                photos={photos}
                onPhotoSelect={handlePhotoSelect}
                photoBusy={photoBusy}
                photosRequired
                photosHint="Las fotos del documento son siempre nuevas para este check-in (frente y dorso)."
                photoTestIdPrefix="checkin-doc"
              />

              <div className={styles.actions}>
                <button type="submit" className={styles.submit} disabled={saving || photoBusy}>
                  {saving ? 'Guardando…' : 'Confirmar check-in'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
