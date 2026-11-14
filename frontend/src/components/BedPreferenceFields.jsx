import React from 'react';
import { normalizeBedPreference } from '../utils/bedConfig';
import styles from './BedPreferenceFields.module.css';

/**
 * Preferencia de camas para consulta/reserva: Sin preferencia | # matrimoniales + # individuales.
 * Independiente de la config física de la habitación.
 */
function BedPreferenceFields({
  value = {},
  onChange,
  maxGuests = 8,
  disabled = false
}) {
  const pref = normalizeBedPreference(value);
  const mode = pref.bedPreferenceNone ? 'none' : 'counts';

  const emit = (patch) => {
    const next = normalizeBedPreference({ ...pref, ...patch });
    onChange(next);
  };

  const maxBeds = Math.max(1, parseInt(maxGuests, 10) || 8);

  return (
    <div className={styles.root}>
      <span className={styles.label}>Camas</span>

      <div className={styles.controls}>
        <label className={styles.modeOption}>
          <input
            type="radio"
            name="bed-preference-mode"
            checked={mode === 'none'}
            disabled={disabled}
            onChange={() => emit({ bedPreferenceNone: true, preferredDoubleBeds: 0, preferredSingleBeds: 0 })}
          />
          Sin preferencia
        </label>
        <label className={styles.modeOption}>
          <input
            type="radio"
            name="bed-preference-mode"
            checked={mode === 'counts'}
            disabled={disabled}
            onChange={() => emit({
              bedPreferenceNone: false,
              preferredDoubleBeds: pref.preferredDoubleBeds || 0,
              preferredSingleBeds: pref.preferredSingleBeds || 0
            })}
          />
          Cantidades
        </label>

        {mode === 'counts' && (
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
    </div>
  );
}

export default BedPreferenceFields;
