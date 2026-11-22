/** Tipos de vehículo en requisitos de reserva / tramo. */
const VEHICLE_TYPES = ['AUTO', 'CAMIONETA', 'MOTO'];

const VEHICLE_TYPE_LABELS = {
  AUTO: 'Auto',
  CAMIONETA: 'Camioneta',
  MOTO: 'Moto'
};

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return 1;
}

function normalizeVehicleType(value, { allowNull = true } = {}) {
  if (value == null || value === '') return allowNull ? null : 'AUTO';
  const raw = String(value).trim().toUpperCase();
  if (VEHICLE_TYPES.includes(raw)) return raw;
  const byLabel = Object.entries(VEHICLE_TYPE_LABELS).find(
    ([, label]) => label.toLowerCase() === String(value).trim().toLowerCase()
  );
  if (byLabel) return byLabel[0];
  return allowNull ? null : 'AUTO';
}

function normalizeVehicleRequirements(source = {}) {
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

function aggregateVehicleRequirements(segments = [], fallback = {}) {
  const list = Array.isArray(segments) ? segments : [];
  let vehicleCount = 0;
  let trailerCount = 0;
  let vehicleType = null;
  for (const seg of list) {
    const n = normalizeVehicleRequirements(seg);
    vehicleCount = Math.max(vehicleCount, n.vehicleCount);
    trailerCount = Math.max(trailerCount, n.trailerCount);
    if (!vehicleType && n.vehicleType) vehicleType = n.vehicleType;
  }
  if (vehicleCount === 0 && trailerCount === 0 && fallback) {
    return normalizeVehicleRequirements(fallback);
  }
  return normalizeVehicleRequirements({
    vehicleCount,
    trailerCount,
    vehicleType,
    requiereEstacionamiento: vehicleCount >= 1 || trailerCount >= 1
  });
}

module.exports = {
  VEHICLE_TYPES,
  VEHICLE_TYPE_LABELS,
  normalizeVehicleType,
  normalizeVehicleRequirements,
  aggregateVehicleRequirements
};
