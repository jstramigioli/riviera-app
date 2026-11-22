import React from 'react';
import {
  bedPreferenceOptionExceedsGuests,
  clampBedPreferenceToLimits,
  normalizeBedPreference
} from '../utils/bedConfig';
import styles from './BedPreferenceFields.module.css';

/**
 * Preferencia de camas + cuna + estacionamiento para requisitos especiales de un tramo.
 * Toggles botón (no checkbox); Mat./Ind. solo si preferencia de camas está on.
 */
function BedPreferenceFields({
  value = {},
  onChange,
  requiereCuna = false,
  onRequiereCunaChange,
  requiereEstacionamiento = false,
  onRequiereEstacionamientoChange,
  maxDoubleBeds = 0,
  maxSingleBeds = 0,
  guests = 0,
  disabled = false
}) {
  const pref = normalizeBedPreference(value);
  const enabled = !pref.bedPreferenceNone;
  const maxDouble = Math.max(0, parseInt(maxDoubleBeds, 10) || 0);
  const maxSingle = Math.max(0, parseInt(maxSingleBeds, 10) || 0);
  const maxGuests = Math.max(0, parseInt(guests, 10) || 0);

  const emit = (patch) => {
    const next = clampBedPreferenceToLimits(
      { ...pref, ...patch },
      { maxDoubleBeds: maxDouble, maxSingleBeds: maxSingle, guests: maxGuests }
    );
    onChange(next);
  };

  const clamped = clampBedPreferenceToLimits(pref, {
    maxDoubleBeds: maxDouble,
    maxSingleBeds: maxSingle,
    guests: maxGuests
  });
  const doubleValue = clamped.preferredDoubleBeds;
  const singleValue = clamped.preferredSingleBeds;

  const toggleBeds = () => {
    if (disabled) return;
    if (!enabled) {
      emit({
        bedPreferenceNone: false,
        preferredDoubleBeds: pref.preferredDoubleBeds || 0,
        preferredSingleBeds: pref.preferredSingleBeds || 0
      });
    } else {
      emit({
        bedPreferenceNone: true,
        preferredDoubleBeds: 0,
        preferredSingleBeds: 0
      });
    }
  };

  const toggleCuna = () => {
    if (disabled || !onRequiereCunaChange) return;
    onRequiereCunaChange(!Boolean(requiereCuna));
  };

  const toggleEstacionamiento = () => {
    if (disabled || !onRequiereEstacionamientoChange) return;
    onRequiereEstacionamientoChange(!Boolean(requiereEstacionamiento));
  };

  return (
    <div className={styles.root}>
      <div className={styles.toggles}>
        <button
          type="button"
          className={styles.switchRow}
          onClick={toggleBeds}
          disabled={disabled}
          aria-pressed={enabled}
          aria-label="Preferencia de camas"
          data-testid="bed-preference-toggle"
        >
          <span className={`${styles.switch} ${enabled ? styles.switchOn : ''}`} aria-hidden="true">
            <span className={styles.switchThumb} />
          </span>
          <span className={styles.switchLabel}>Preferencia de camas</span>
        </button>

        {typeof onRequiereCunaChange === 'function' && (
          <button
            type="button"
            className={styles.switchRow}
            onClick={toggleCuna}
            disabled={disabled}
            aria-pressed={Boolean(requiereCuna)}
            aria-label="Cuna"
            data-testid="cuna-toggle"
          >
            <span
              className={`${styles.switch} ${requiereCuna ? styles.switchOn : ''}`}
              aria-hidden="true"
            >
              <span className={styles.switchThumb} />
            </span>
            <span className={styles.switchLabel}>Cuna</span>
          </button>
        )}

        {typeof onRequiereEstacionamientoChange === 'function' && (
          <button
            type="button"
            className={styles.switchRow}
            onClick={toggleEstacionamiento}
            disabled={disabled}
            aria-pressed={Boolean(requiereEstacionamiento)}
            aria-label="Estacionamiento"
            data-testid="estacionamiento-toggle"
          >
            <span
              className={`${styles.switch} ${requiereEstacionamiento ? styles.switchOn : ''}`}
              aria-hidden="true"
            >
              <span className={styles.switchThumb} />
            </span>
            <span className={styles.switchLabel}>Estacionamiento</span>
          </button>
        )}
      </div>

      {enabled && (
        <div className={styles.counts}>
          <div className={styles.countField}>
            <label htmlFor="bed-pref-double">Mat.</label>
            <select
              id="bed-pref-double"
              value={doubleValue}
              disabled={disabled}
              aria-label="Camas matrimoniales"
              onChange={(e) => emit({
                bedPreferenceNone: false,
                preferredDoubleBeds: parseInt(e.target.value, 10) || 0
              })}
            >
              {Array.from({ length: maxDouble + 1 }, (_, i) => {
                const exceeds = bedPreferenceOptionExceedsGuests({
                  kind: 'double',
                  count: i,
                  otherCount: singleValue,
                  guests: maxGuests
                });
                return (
                  <option
                    key={`d-${i}`}
                    value={i}
                    disabled={exceeds}
                    className={exceeds ? styles.optionDisabled : undefined}
                  >
                    {i}
                  </option>
                );
              })}
            </select>
          </div>
          <div className={styles.countField}>
            <label htmlFor="bed-pref-single">Ind.</label>
            <select
              id="bed-pref-single"
              value={singleValue}
              disabled={disabled}
              aria-label="Camas individuales"
              onChange={(e) => emit({
                bedPreferenceNone: false,
                preferredSingleBeds: parseInt(e.target.value, 10) || 0
              })}
            >
              {Array.from({ length: maxSingle + 1 }, (_, i) => {
                const exceeds = bedPreferenceOptionExceedsGuests({
                  kind: 'single',
                  count: i,
                  otherCount: doubleValue,
                  guests: maxGuests
                });
                return (
                  <option
                    key={`s-${i}`}
                    value={i}
                    disabled={exceeds}
                    className={exceeds ? styles.optionDisabled : undefined}
                  >
                    {i}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

export default BedPreferenceFields;
