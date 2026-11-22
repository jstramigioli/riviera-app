import React from 'react';
import {
  bedPreferenceOptionExceedsGuests,
  clampBedPreferenceToLimits,
  normalizeBedPreference
} from '../utils/bedConfig';
import {
  VEHICLE_TYPES,
  VEHICLE_TYPE_LABELS,
  normalizeVehicleRequirements
} from '../constants/vehicleRequirements';
import styles from './BedPreferenceFields.module.css';

/**
 * Preferencia de camas + cuna + vehículo/tráiler para requisitos especiales de un tramo.
 * Toggles botón (no checkbox); Mat./Ind. solo si preferencia de camas está on.
 * Vehículo: cantidad 0|1, tipo si ≥1, tráiler 0|1.
 */
function BedPreferenceFields({
  value = {},
  onChange,
  requiereCuna = false,
  onRequiereCunaChange,
  vehicleCount,
  vehicleType,
  trailerCount,
  onVehicleRequirementsChange,
  /** Legacy: si no hay handlers de vehículo, mantiene toggle estacionamiento. */
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
  const vehicle = normalizeVehicleRequirements({
    vehicleCount:
      vehicleCount != null
        ? vehicleCount
        : requiereEstacionamiento
          ? 1
          : 0,
    vehicleType: vehicleType || (requiereEstacionamiento ? 'AUTO' : null),
    trailerCount: trailerCount != null ? trailerCount : 0,
    requiereEstacionamiento
  });
  const useVehicleFields = typeof onVehicleRequirementsChange === 'function';

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

  const emitVehicle = (patch) => {
    if (disabled || !useVehicleFields) return;
    onVehicleRequirementsChange(
      normalizeVehicleRequirements({ ...vehicle, ...patch })
    );
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

        {!useVehicleFields && typeof onRequiereEstacionamientoChange === 'function' && (
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

      {useVehicleFields && (
        <div className={styles.vehicleRow} data-testid="vehicle-requirements">
          <div className={styles.countField}>
            <label htmlFor="vehicle-count">Vehículos</label>
            <select
              id="vehicle-count"
              value={vehicle.vehicleCount}
              disabled={disabled}
              aria-label="Cantidad de vehículos"
              data-testid="vehicle-count-select"
              onChange={(e) =>
                emitVehicle({ vehicleCount: parseInt(e.target.value, 10) || 0 })
              }
            >
              <option value={0}>0</option>
              <option value={1}>1</option>
            </select>
          </div>
          {vehicle.vehicleCount >= 1 && (
            <div className={styles.countField}>
              <label htmlFor="vehicle-type">Tipo</label>
              <select
                id="vehicle-type"
                value={vehicle.vehicleType || 'AUTO'}
                disabled={disabled}
                aria-label="Tipo de vehículo"
                data-testid="vehicle-type-select"
                onChange={(e) => emitVehicle({ vehicleType: e.target.value })}
              >
                {VEHICLE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {VEHICLE_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className={styles.countField}>
            <label htmlFor="trailer-count">Tráiler</label>
            <select
              id="trailer-count"
              value={vehicle.trailerCount}
              disabled={disabled}
              aria-label="Cantidad de tráiler"
              data-testid="trailer-count-select"
              onChange={(e) =>
                emitVehicle({ trailerCount: parseInt(e.target.value, 10) || 0 })
              }
            >
              <option value={0}>0</option>
              <option value={1}>1</option>
            </select>
          </div>
        </div>
      )}

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
