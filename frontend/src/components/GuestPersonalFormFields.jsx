import React from 'react';
import LocationSelector from './LocationSelector';
import DocumentPhotoSlot from './DocumentPhotoSlot';
import {
  BIRTH_DATE_LABEL_OPTIONAL,
  BIRTH_DATE_LABEL_REQUIRED,
  CLIENT_DOCUMENT_TYPES,
  DOCUMENT_ISSUING_COUNTRIES
} from '../constants/clientFormFields';
import styles from '../pages/PublicCheckIn.module.css';

/** Campos personales alineados al check-in online (sin patente). */
export const EMPTY_GUEST_PERSONAL_FIELDS = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  documentType: 'DNI',
  documentNumber: '',
  documentIssuingCountry: 'AR',
  birthDate: '',
  country: 'AR',
  province: '',
  city: '',
  address: '',
  wantsPromotions: false,
  dietVegetariano: false,
  dietVegano: false,
  dietCeliaco: false
};

/**
 * Misma estructura/secciones que el form público de check-in.
 * Reutilizado en PublicCheckIn y en agregar/editar huésped (reserva).
 */
export default function GuestPersonalFormFields({
  fields,
  onChange,
  onLocationChange,
  disabled = false,
  birthDateRequired = false,
  showPhotos = false,
  photos = {
    front: { uploaded: false, name: null },
    back: { uploaded: false, name: null }
  },
  onPhotoSelect,
  photoBusy = false,
  photosRequired = false,
  photosHint = null,
  photoTestIdPrefix = 'guest-doc'
}) {
  const handleChange = (event) => {
    if (typeof onChange === 'function') onChange(event);
  };

  const birthLabel = birthDateRequired
    ? BIRTH_DATE_LABEL_REQUIRED
    : BIRTH_DATE_LABEL_OPTIONAL;

  return (
    <div className={styles.form} data-testid="guest-personal-form-fields">
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Información personal</h2>
        <div className={styles.grid}>
          <label className={styles.field}>
            <span>Nombre *</span>
            <input
              name="firstName"
              value={fields.firstName || ''}
              onChange={handleChange}
              required
              disabled={disabled}
              autoComplete="given-name"
            />
          </label>
          <label className={styles.field}>
            <span>Apellido *</span>
            <input
              name="lastName"
              value={fields.lastName || ''}
              onChange={handleChange}
              required
              disabled={disabled}
              autoComplete="family-name"
            />
          </label>
          <label className={styles.field}>
            <span>Email</span>
            <input
              type="email"
              name="email"
              value={fields.email || ''}
              onChange={handleChange}
              disabled={disabled}
              autoComplete="email"
            />
          </label>
          <label className={styles.field}>
            <span>Teléfono</span>
            <input
              type="tel"
              name="phone"
              value={fields.phone || ''}
              onChange={handleChange}
              disabled={disabled}
              autoComplete="tel"
            />
          </label>
          <label className={styles.field}>
            <span>{birthLabel}</span>
            <input
              type="date"
              name="birthDate"
              value={fields.birthDate || ''}
              onChange={handleChange}
              required={birthDateRequired}
              disabled={disabled}
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
            <select
              name="documentType"
              value={fields.documentType || 'DNI'}
              onChange={handleChange}
              disabled={disabled}
            >
              {CLIENT_DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Número de documento</span>
            <input
              name="documentNumber"
              value={fields.documentNumber || ''}
              onChange={handleChange}
              disabled={disabled}
            />
          </label>
          <label className={styles.field}>
            <span>País emisor</span>
            <select
              name="documentIssuingCountry"
              value={fields.documentIssuingCountry || 'AR'}
              onChange={handleChange}
              disabled={disabled}
              data-testid={`${photoTestIdPrefix}-issuing-country`}
            >
              {DOCUMENT_ISSUING_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {showPhotos && (
          <>
            <p className={styles.hint}>
              {photosHint ||
                `Fotos del documento: frente y dorso${
                  photosRequired ? ' (obligatorias).' : ' (opcional).'
                }`}
            </p>
            <div className={styles.photoSlots}>
              <DocumentPhotoSlot
                label="Frente del documento"
                slot="front"
                meta={
                  photos.front?.uploaded
                    ? { originalName: photos.front.name, exists: true }
                    : null
                }
                busy={photoBusy || disabled}
                required={photosRequired}
                onSelect={onPhotoSelect}
                showDelete={false}
                testIdPrefix={photoTestIdPrefix}
              />
              <DocumentPhotoSlot
                label="Dorso del documento"
                slot="back"
                meta={
                  photos.back?.uploaded
                    ? { originalName: photos.back.name, exists: true }
                    : null
                }
                busy={photoBusy || disabled}
                required={photosRequired}
                onSelect={onPhotoSelect}
                showDelete={false}
                testIdPrefix={photoTestIdPrefix}
              />
            </div>
          </>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Ubicación</h2>
        <div className={styles.locationBlock}>
          <LocationSelector
            country={fields.country || 'AR'}
            province={fields.province || ''}
            city={fields.city || ''}
            onCountryChange={(value) => onLocationChange?.('country', value)}
            onProvinceChange={(value) => onLocationChange?.('province', value)}
            onCityChange={(value) => onLocationChange?.('city', value)}
          />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Domicilio</h2>
        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span>Dirección</span>
          <textarea
            name="address"
            value={fields.address || ''}
            onChange={handleChange}
            placeholder="Ingresa la dirección completa"
            rows={3}
            disabled={disabled}
            autoComplete="street-address"
          />
        </label>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Régimen alimentario</h2>
        <p className={styles.hint}>Preferencias del huésped para cocina / recepción.</p>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            name="dietVegetariano"
            checked={Boolean(fields.dietVegetariano)}
            onChange={handleChange}
            disabled={disabled}
            data-testid="guest-diet-vegetariano"
          />
          Vegetariano
        </label>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            name="dietVegano"
            checked={Boolean(fields.dietVegano)}
            onChange={handleChange}
            disabled={disabled}
            data-testid="guest-diet-vegano"
          />
          Vegano
        </label>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            name="dietCeliaco"
            checked={Boolean(fields.dietCeliaco)}
            onChange={handleChange}
            disabled={disabled}
            data-testid="guest-diet-celiaco"
          />
          Celíaco
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
            disabled={disabled}
          />
          Deseo recibir información de promociones
        </label>
      </section>
    </div>
  );
}
