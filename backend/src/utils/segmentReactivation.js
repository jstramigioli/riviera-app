/**
 * Reactivación de tramos al pasar una reserva de CANCELADA/NO_PRESENTADA a un estado que ocupa.
 *
 * Los tramos nunca se borran: editar la estadía desactiva los vigentes y crea nuevos
 * (`updateReservationWithSegments`), borrar un tramo lo desactiva, y cancelar desactiva los
 * vigentes con un único `updateMany`. Por eso, al reactivar, NO hay que encender todos los
 * inactivos (eso revive tramos viejos ya reemplazados y duplica noches/habitaciones), sino
 * solo el último grupo desactivado: el `updateMany` de la cancelación les dejó el mismo `updatedAt`.
 *
 * Si la reserva ya tiene tramos activos (p. ej. se editó la estadía estando cancelada),
 * esos son los vigentes y no se reactiva nada.
 *
 * @param {Array<{ id: number, isActive: boolean, updatedAt: Date|string }>} segments
 * @returns {number[]} ids de tramos a reactivar
 */
function selectSegmentIdsToReactivate(segments) {
  if (!Array.isArray(segments) || segments.length === 0) return [];
  if (segments.some((s) => s.isActive)) return [];

  let latest = -Infinity;
  for (const s of segments) {
    const t = new Date(s.updatedAt).getTime();
    if (Number.isFinite(t) && t > latest) latest = t;
  }
  if (!Number.isFinite(latest)) return [];

  return segments
    .filter((s) => new Date(s.updatedAt).getTime() === latest)
    .map((s) => s.id);
}

module.exports = { selectSegmentIdsToReactivate };
