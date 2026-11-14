import React from 'react';
import { normalizeBedPreference } from '../utils/bedConfig';
import styles from './BedPreferenceFields.module.css';

/**
 * Preferencia de camas para consulta/reserva.
 * Checkbox «Preferencia de camas»; Mat./Ind. solo si está tildado.
 */
function BedPreferenceFields({
  value = {},
  onChange,
  maxGuests = 8,
  disabled = false
}) {
  const pref = normalizeBedPreference(value);
  const enabled = !pref.bedPreferenceNone;

  const emit = (patch) => {
    const next = normalizeBedPreference({ ...pref, ...patch });
    onChange(next);
  };

  const maxBeds = Math.max(1, parseInt(maxGuests, 10) || 8);

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
              value={pref.preferredDoubleBeds}
              disabled={disabled}
              aria-label="Camas matrimoniales"
              onChange={(e) => emit({
                bedPreferenceNone: false,
                preferredDoubleBeds: parseInt(e.target.value, 10) || 0
              })}
            >
              {Array.from({ length: maxBeds + 1 }, (_, i) => (
                <option key={`d-${i}`} value={i}>{i}</option>
              ))}
            </select>
          </div>
          <div className={styles.countField}>
            <label htmlFor="bed-pref-single">Ind.</label>
            <select
              id="bed-pref-single"
              value={pref.preferredSingleBeds}
              disabled={disabled}
              aria-label="Camas individuales"
              onChange={(e) => emit({
                bedPreferenceNone: false,
                preferredSingleBeds: parseInt(e.target.value, 10) || 0
              })}
            >
              {Array.from({ length: maxBeds + 1 }, (_, i) => (
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
