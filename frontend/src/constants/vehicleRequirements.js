/** Tipos de vehículo en requisitos de reserva / tramo (espejo backend). */
export const VEHICLE_TYPES = ['AUTO', 'CAMIONETA', 'MOTO'];

export const VEHICLE_TYPE_LABELS = {
  AUTO: 'Auto',
  CAMIONETA: 'Camioneta',
  MOTO: 'Moto'
};

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return 1;
}

export function normalizeVehicleType(value, { allowNull = true } = {}) {
  if (value == null || value === '') return allowNull ? null : 'AUTO';
  const raw = String(value).trim().toUpperCase();
  if (VEHICLE_TYPES.includes(raw)) return raw;
  const byLabel = Object.entries(VEHICLE_TYPE_LABELS).find(
    ([, label]) => label.toLowerCase() === String(value).trim().toLowerCase()
  );
  if (byLabel) return byLabel[0];
  return allowNull ? null : 'AUTO';
}

export function normalizeVehicleRequirements(source = {}) {
  const vehicleCount = clamp01(source.vehicleCount);
  const trailerCount = clamp01(source.trailerCount);
  const vehicleType =
    vehicleCount >= 1
      ? normalizeVehicleType(source.vehicleType, { allowNull: false })
      : null;
  const requiereEstacionamiento =
    vehicleCount >= 1 ||
    trailerCount >= 1 ||
    Boolean(source.requiereEstacionamiento);
  return {
    vehicleCount,
    vehicleType,
    trailerCount,
    requiereEstacionamiento
  };
}

export function vehicleRequirementsFrom(source = {}, fallback = {}) {
  const hasOwn =
    source &&
    (source.vehicleCount != null ||
      source.vehicleType != null ||
      source.trailerCount != null);
  if (hasOwn) return normalizeVehicleRequirements(source);
  if (
    fallback &&
    (fallback.vehicleCount != null ||
      fallback.vehicleType != null ||
      fallback.trailerCount != null)
  ) {
    return normalizeVehicleRequirements(fallback);
  }
  if (source?.requiereEstacionamiento || fallback?.requiereEstacionamiento) {
    return normalizeVehicleRequirements({
      vehicleCount: 1,
      vehicleType: 'AUTO',
      trailerCount: 0
    });
  }
  return normalizeVehicleRequirements({});
}
