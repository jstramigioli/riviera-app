import React from 'react';
import { normalizeBedPreference } from '../utils/bedConfig';

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
    <div style={{ display: 'grid', gap: '10px' }}>
      <label style={{
        fontWeight: 600,
        color: 'var(--color-text-main)',
        fontSize: 'var(--font-size-small)'
      }}>
        Preferencia de camas
      </label>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-small)' }}>
          <input
            type="radio"
            name="bed-preference-mode"
            checked={mode === 'none'}
            disabled={disabled}
            onChange={() => emit({ bedPreferenceNone: true, preferredDoubleBeds: 0, preferredSingleBeds: 0 })}
          />
          Sin preferencia
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-small)' }}>
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
      </div>

      {mode === 'counts' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--font-size-small)' }}>
              Matrimoniales
            </label>
            <select
              value={pref.preferredDoubleBeds}
              disabled={disabled}
              onChange={(e) => emit({
                bedPreferenceNone: false,
                preferredDoubleBeds: parseInt(e.target.value, 10) || 0
              })}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                fontSize: 'var(--font-size-small)'
              }}
            >
              {Array.from({ length: maxBeds + 1 }, (_, i) => (
                <option key={`d-${i}`} value={i}>{i}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: 'var(--font-size-small)' }}>
              Individuales
            </label>
            <select
              value={pref.preferredSingleBeds}
              disabled={disabled}
              onChange={(e) => emit({
                bedPreferenceNone: false,
                preferredSingleBeds: parseInt(e.target.value, 10) || 0
              })}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid var(--color-border)',
                borderRadius: '6px',
                fontSize: 'var(--font-size-small)'
              }}
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
