import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FiCheck } from 'react-icons/fi';
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

export default function PublicCheckIn() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [reservation, setReservation] = useState(null);
  const [fields, setFields] = useState(EMPTY);
  // Fotos siempre nuevas: no prefill de archivos previos del cliente.
  const [photos, setPhotos] = useState({
    front: { uploaded: false, name: null },
    back: { uploaded: false, name: null }
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${CHECKIN_API_BASE}/public/check-in/${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'No se pudo cargar el check-in');
        }
        if (cancelled) return;
        setReservation(data.reservation || null);
        setFields({
          ...EMPTY,
          ...(data.fields || {}),
          country: data.fields?.country || 'AR',
          documentType: data.fields?.documentType || 'DNI',
          birthDate: birthDateToInputValue(data.fields?.birthDate),
          wantsPromotions: Boolean(data.fields?.wantsPromotions)
        });
        // Si el huésped ya subió en esta sesión (reload), marcar flags — sin mostrar archivo viejo.
        setPhotos({
          front: {
            uploaded: Boolean(data.documentPhotos?.frontUploaded),
            name: data.documentPhotos?.frontUploaded ? 'Frente cargado' : null
          },
          back: {
            uploaded: Boolean(data.documentPhotos?.backUploaded),
            name: data.documentPhotos?.backUploaded ? 'Dorso cargado' : null
          }
        });
        setDone(Boolean(data.completed));
      } catch (err) {
        if (!cancelled) setError(err.message || 'Error al cargar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

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
    if (!file || photoBusy || !token) return;
    setPhotoBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
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
          birthDate: birthDateInputToPayload(fields.birthDate)
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo guardar');
      }
      setDone(true);
    } catch (err) {
      setError(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.shell}>
          <p className={styles.muted}>Cargando check-in…</p>
        </div>
      </div>
    );
  }

  if (error && !fields.firstName && !done) {
    return (
      <div className={styles.page}>
        <div className={styles.shell}>
          <h1 className={styles.brand}>Hotel Riviera</h1>
          <p className={styles.error}>{error}</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className={styles.page}>
        <div className={styles.shell}>
          <h1 className={styles.brand}>Hotel Riviera</h1>
          <div className={styles.successBox}>
            <FiCheck aria-hidden className={styles.successIcon} />
            <div>
              <h2 className={styles.heading}>Check-in recibido</h2>
              <p className={styles.muted}>
                Gracias. Ya registramos tus datos
                {reservation?.id ? ` para la reserva #${reservation.id}` : ''}.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const checkInLabel = formatDate(reservation?.checkIn);
  const checkOutLabel = formatDate(reservation?.checkOut);

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <h1 className={styles.brand}>Hotel Riviera</h1>
          <p className={styles.lead}>
            Completá o corregí tus datos antes de la llegada
            {reservation?.id ? ` (reserva #${reservation.id})` : ''}.
          </p>
          {(checkInLabel || checkOutLabel) && (
            <p className={styles.meta}>
              {checkInLabel && <span>Ingreso: {checkInLabel}</span>}
              {checkInLabel && checkOutLabel ? ' · ' : null}
              {checkOutLabel && <span>Egreso: {checkOutLabel}</span>}
            </p>
          )}
        </header>

        {error && <p className={styles.error}>{error}</p>}

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
      </div>
    </div>
  );
}
