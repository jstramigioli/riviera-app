import React from 'react';
import {
  clampBedPreferenceToLimits,
  normalizeBedPreference
} from '../utils/bedConfig';
import styles from './BedPreferenceFields.module.css';

/**
 * Preferencia de camas para consulta/reserva.
 * Checkbox «Preferencia de camas»; Mat./Ind. solo si está tildado.
 * Máximos Mat/Ind = max entre habitaciones con capacidad === huéspedes.
 */
function BedPreferenceFields({
  value = {},
  onChange,
  maxDoubleBeds = 0,
  maxSingleBeds = 0,
  disabled = false
}) {
  const pref = normalizeBedPreference(value);
  const enabled = !pref.bedPreferenceNone;
  const maxDouble = Math.max(0, parseInt(maxDoubleBeds, 10) || 0);
  const maxSingle = Math.max(0, parseInt(maxSingleBeds, 10) || 0);

  const emit = (patch) => {
    const next = clampBedPreferenceToLimits(
      { ...pref, ...patch },
      { maxDoubleBeds: maxDouble, maxSingleBeds: maxSingle }
    );
    onChange(next);
  };

  const doubleValue = Math.min(pref.preferredDoubleBeds, maxDouble);
  const singleValue = Math.min(pref.preferredSingleBeds, maxSingle);

  return (
    <div className={styles.root}>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={enabled}
          disabled={disabled}
          aria-label="Preferencia de camas"
          onChange={(e) => {
            if (e.target.checked) {
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
          }}
        />
        Preferencia de camas
      </label>

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
              {Array.from({ length: maxDouble + 1 }, (_, i) => (
                <option key={`d-${i}`} value={i}>{i}</option>
              ))}
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
              {Array.from({ length: maxSingle + 1 }, (_, i) => (
                <option key={`s-${i}`} value={i}>{i}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

export default BedPreferenceFields;
