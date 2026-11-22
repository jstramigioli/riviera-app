import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { FiCheck, FiChevronLeft, FiUser } from 'react-icons/fi';
import LocationSelector from '../components/LocationSelector';
import DocumentPhotoSlot from '../components/DocumentPhotoSlot';
import {
  BIRTH_DATE_LABEL_REQUIRED,
  CLIENT_DOCUMENT_TYPES,
  VEHICLE_PLATE_HINT,
  VEHICLE_PLATE_LABEL,
  birthDateInputToPayload,
  birthDateToInputValue
} from '../constants/clientFormFields';
import styles from './PublicCheckIn.module.css';

// Preferir same-origin /api (proxy Vite) para evitar CORS / 127 vs localhost en local.
const CHECKIN_API_BASE = import.meta.env.VITE_API_URL || '/api';

const EMPTY = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  documentType: 'DNI',
  documentNumber: '',
  birthDate: '',
  country: 'AR',
  province: '',
  city: '',
  address: '',
  wantsPromotions: false,
  vehiclePlate: ''
};

function formatDate(value) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString('es-AR');
  } catch {
    return null;
  }
}

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
  const [progress, setProgress] = useState({ completed: 0, total: 0, label: '0/0' });
  const [selectedGuestId, setSelectedGuestId] = useState(null);
  const [fields, setFields] = useState(EMPTY);
  // Fotos siempre nuevas: no prefill de archivos previos del cliente.
  const [photos, setPhotos] = useState({
    front: { uploaded: false, name: null },
    back: { uploaded: false, name: null }
  });
  const [justCompletedGuest, setJustCompletedGuest] = useState(false);

  const applyGuestForm = useCallback((guest) => {
    if (!guest) return;
    setSelectedGuestId(guest.guestId);
    setFields({
      ...EMPTY,
      ...(guest.fields || {}),
      country: guest.fields?.country || 'AR',
      documentType: guest.fields?.documentType || 'DNI',
      birthDate: birthDateToInputValue(guest.fields?.birthDate),
      wantsPromotions: Boolean(guest.fields?.wantsPromotions)
    });
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
      if (list.length === 1) {
        applyGuestForm(list[0]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCheckIn, applyGuestForm]);

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

  if (loading && !guests.length) {
    return (
      <div className={styles.page}>
        <div className={styles.shell}>
          <p className={styles.muted}>Cargando check-in…</p>
        </div>
      </div>
    );
  }

  if (error && !guests.length) {
    return (
      <div className={styles.page}>
        <div className={styles.shell}>
          <h1 className={styles.brand}>Hotel Riviera</h1>
          <p className={styles.error}>{error}</p>
        </div>
      </div>
    );
  }

  const checkInLabel = formatDate(reservation?.checkIn);
  const checkOutLabel = formatDate(reservation?.checkOut);
  const allDone = progress.total > 0 && progress.completed === progress.total;
  const showList = !selectedGuestId;

  if (allDone && showList) {
    return (
      <div className={styles.page}>
        <div className={styles.shell}>
          <h1 className={styles.brand}>Hotel Riviera</h1>
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
          <p className={styles.lead}>
            Completá o corregí los datos antes de la llegada
            {reservation?.id ? ` (reserva #${reservation.id})` : ''}.
          </p>
          {(checkInLabel || checkOutLabel) && (
            <p className={styles.meta}>
              {checkInLabel && <span>Ingreso: {checkInLabel}</span>}
              {checkInLabel && checkOutLabel ? ' · ' : null}
              {checkOutLabel && <span>Egreso: {checkOutLabel}</span>}
            </p>
          )}
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
            </div>
          </section>
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

            <form className={styles.form} onSubmit={handleSubmit}>
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Información personal</h2>
                <div className={styles.grid}>
                  <label className={styles.field}>
                    <span>Nombre *</span>
                    <input name="firstName" value={fields.firstName} onChange={handleChange} required autoComplete="given-name" />
                  </label>
                  <label className={styles.field}>
                    <span>Apellido *</span>
                    <input name="lastName" value={fields.lastName} onChange={handleChange} required autoComplete="family-name" />
                  </label>
                  <label className={styles.field}>
                    <span>Email</span>
                    <input type="email" name="email" value={fields.email} onChange={handleChange} autoComplete="email" />
                  </label>
                  <label className={styles.field}>
                    <span>Teléfono</span>
                    <input type="tel" name="phone" value={fields.phone} onChange={handleChange} autoComplete="tel" />
                  </label>
                  <label className={styles.field}>
                    <span>{BIRTH_DATE_LABEL_REQUIRED}</span>
                    <input
                      type="date"
                      name="birthDate"
                      value={fields.birthDate}
                      onChange={handleChange}
                      required
                      autoComplete="bday"
                    />
                  </label>
                </div>
              </section>

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Documentación</h2>
                <div className={styles.grid}>
                  <label className={styles.field}>
                    <span>Tipo de documento</span>
                    <select name="documentType" value={fields.documentType || 'DNI'} onChange={handleChange}>
                      {CLIENT_DOCUMENT_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>Número de documento</span>
                    <input name="documentNumber" value={fields.documentNumber} onChange={handleChange} />
                  </label>
                </div>
                <p className={styles.hint}>
                  Las fotos del documento son siempre nuevas para este check-in (frente y dorso).
                </p>
                <div className={styles.photoSlots}>
                  <DocumentPhotoSlot
                    label="Frente del documento"
                    slot="front"
                    meta={photos.front.uploaded ? { originalName: photos.front.name, exists: true } : null}
                    busy={photoBusy}
                    required
                    onSelect={handlePhotoSelect}
                    showDelete={false}
                    testIdPrefix="checkin-doc"
                  />
                  <DocumentPhotoSlot
                    label="Dorso del documento"
                    slot="back"
                    meta={photos.back.uploaded ? { originalName: photos.back.name, exists: true } : null}
                    busy={photoBusy}
                    required
                    onSelect={handlePhotoSelect}
                    showDelete={false}
                    testIdPrefix="checkin-doc"
                  />
                </div>
              </section>

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Ubicación</h2>
                <div className={styles.locationBlock}>
                  <LocationSelector
                    country={fields.country}
                    province={fields.province}
                    city={fields.city}
                    onCountryChange={(value) => handleLocationChange('country', value)}
                    onProvinceChange={(value) => handleLocationChange('province', value)}
                    onCityChange={(value) => handleLocationChange('city', value)}
                  />
                </div>
              </section>

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Domicilio</h2>
                <label className={`${styles.field} ${styles.fieldWide}`}>
                  <span>Dirección</span>
                  <textarea
                    name="address"
                    value={fields.address}
                    onChange={handleChange}
                    placeholder="Ingresa la dirección completa"
                    rows={3}
                    autoComplete="street-address"
                  />
                </label>
              </section>

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Preferencias</h2>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    name="wantsPromotions"
                    checked={Boolean(fields.wantsPromotions)}
                    onChange={handleChange}
                  />
                  Deseo recibir información de promociones
                </label>
              </section>

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Vehículo</h2>
                <label className={styles.field}>
                  <span>{VEHICLE_PLATE_LABEL}</span>
                  <input
                    name="vehiclePlate"
                    value={fields.vehiclePlate}
                    onChange={handleChange}
                    placeholder="Ej. AB123CD"
                    autoCapitalize="characters"
                  />
                  <span className={styles.hint}>{VEHICLE_PLATE_HINT}</span>
                </label>
              </section>

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
