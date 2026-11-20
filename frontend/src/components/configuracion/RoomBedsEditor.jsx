import React from 'react';
import {
  BED_TYPE_DOUBLE,
  BED_TYPE_SINGLE,
  totalBedCapacity,
  validateBedsAgainstCapacity
} from '../../utils/bedConfig';

/**
 * Editor de camas para create/edit de habitación.
 * beds: [{ bedType, isSeparable, orderIndex? }]
 */
function RoomBedsEditor({ beds = [], maxPeople = 1, onChange, disabled = false }) {
  const validation = validateBedsAgainstCapacity(beds, maxPeople);
  const capacity = totalBedCapacity(beds);

  const updateBed = (index, patch) => {
    const next = beds.map((bed, i) => {
      if (i !== index) return bed;
      const merged = { ...bed, ...patch };
      if (merged.bedType === BED_TYPE_SINGLE) {
        merged.isSeparable = false;
      }
      return merged;
    });
    onChange(next);
  };

  const removeBed = (index) => {
    onChange(beds.filter((_, i) => i !== index).map((bed, i) => ({ ...bed, orderIndex: i })));
  };

  const addBed = (bedType) => {
    onChange([
      ...beds,
      {
        bedType,
        isSeparable: false,
        orderIndex: beds.length
      }
    ]);
  };

  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
        <label style={{
          fontWeight: 600,
          color: 'var(--color-text-main)',
          fontSize: 'var(--font-size-small)',
          margin: 0
        }}>
          Camas
        </label>
        <span style={{
          fontSize: 'var(--font-size-small)',
          color: validation.ok ? 'var(--color-text-muted)' : 'var(--color-danger)'
        }}>
          {capacity}/{maxPeople} plazas
        </span>
      </div>

      {beds.length === 0 && (
        <div style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)' }}>
          Sin camas configuradas
        </div>
      )}

      {beds.map((bed, index) => (
        <div
          key={bed.id || `bed-${index}`}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto',
            gap: '8px',
            alignItems: 'center'
          }}
        >
          <select
            value={bed.bedType || BED_TYPE_SINGLE}
            disabled={disabled}
            onChange={(e) => updateBed(index, { bedType: e.target.value })}
            aria-label={`Tipo de cama ${index + 1}`}
            style={{
              padding: '6px 8px',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              fontSize: 'var(--font-size-small)'
            }}
          >
            <option value={BED_TYPE_DOUBLE}>Matrimonial</option>
            <option value={BED_TYPE_SINGLE}>Individual</option>
          </select>

          {bed.bedType === BED_TYPE_DOUBLE ? (
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: 'var(--font-size-small)',
              whiteSpace: 'nowrap'
            }}>
              <input
                type="checkbox"
                checked={Boolean(bed.isSeparable)}
                disabled={disabled}
                onChange={(e) => updateBed(index, { isSeparable: e.target.checked })}
              />
              Separable
            </label>
          ) : (
            <span style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)' }}>—</span>
          )}

          <button
            type="button"
            disabled={disabled}
            onClick={() => removeBed(index)}
            style={{
              padding: '4px 8px',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              background: 'var(--color-bg)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontSize: 'var(--font-size-small)'
            }}
          >
            Quitar
          </button>
        </div>
      ))}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => addBed(BED_TYPE_DOUBLE)}
          style={{
            padding: '6px 10px',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            background: 'var(--color-bg)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: 'var(--font-size-small)'
          }}
        >
          + Matrimonial
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => addBed(BED_TYPE_SINGLE)}
          style={{
            padding: '6px 10px',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            background: 'var(--color-bg)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: 'var(--font-size-small)'
          }}
        >
          + Individual
        </button>
      </div>

      {!validation.ok && (
        <div role="alert" style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-small)' }}>
          {validation.message}
        </div>
      )}
    </div>
  );
}

export default RoomBedsEditor;
