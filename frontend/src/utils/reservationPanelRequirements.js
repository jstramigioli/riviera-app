/**
 * Requisitos visibles en el panel azul de la página de reserva:
 * habitación fijada (requiredRoomId / fixed) + tags seleccionados +
 * flags operativos (cuna / estacionamiento).
 * Solo de segmentos activos (o todos si no hay activos).
 */

const roomDisplayName = (seg) => {
  if (!seg) return null;
  const raw =
    seg.room?.name ||
    seg.uiRoomName ||
    seg.virtualRoom?.name ||
    (seg.requiredRoomId != null ? `Hab. ${seg.requiredRoomId}` : null) ||
    (seg.roomId != null ? String(seg.roomId) : null);
  if (!raw) return null;
  return String(raw).replace(/^Hab(?:itación)?\s+/i, '');
};

const activeSegments = (reservation) => {
  const raw = reservation?.segments || [];
  const active = raw.filter((s) => s.isActive !== false);
  return active.length > 0 ? active : raw;
};

/**
 * @param {object} reservation
 * @param {Array<{id:number|string, name:string, color?:string}>} [tagsCatalog]
 * @returns {{
 *   fixedRooms: Array<{key:string, name:string}>,
 *   selectedTags: Array<{id:number|string, name:string, color?:string}>,
 *   flags: Array<{key:string, label:string}>,
 *   hasAny: boolean
 * }}
 */
export function collectReservationPanelRequirements(reservation, tagsCatalog = []) {
  const segments = activeSegments(reservation);
  const fixedRooms = [];
  const seenRooms = new Set();
  const tagIdOrder = [];
  const seenTags = new Set();

  for (const seg of segments) {
    const isFixed = Boolean(seg?.requiredRoomId || seg?.fixed);
    if (isFixed) {
      const name = roomDisplayName(seg);
      const key = seg.requiredRoomId != null
        ? `req:${seg.requiredRoomId}`
        : `room:${seg.roomId ?? seg.uiRoomId ?? name}`;
      if (name && !seenRooms.has(key)) {
        seenRooms.add(key);
        fixedRooms.push({ key, name });
      }
    }

    for (const rawId of seg?.requiredTags || []) {
      const id = typeof rawId === 'string' && /^\d+$/.test(rawId) ? Number(rawId) : rawId;
      const tagKey = String(id);
      if (seenTags.has(tagKey)) continue;
      seenTags.add(tagKey);
      tagIdOrder.push(id);
    }
  }

  const selectedTags = tagIdOrder.map((id) => {
    const tag = tagsCatalog.find(
      (t) => t.id === id || String(t.id) === String(id)
    );
    if (tag) {
      return { id: tag.id, name: tag.name, color: tag.color };
    }
    return { id, name: String(id) };
  });

  const flags = [];
  const segmentNeedsCuna = segments.some((seg) => Boolean(seg?.requiereCuna));
  if (segmentNeedsCuna || reservation?.requiereCuna) {
    flags.push({ key: 'cuna', label: 'Requiere cuna' });
  }
  const vehicleCount = Math.max(
    Number(reservation?.vehicleCount) || 0,
    ...segments.map((seg) => Number(seg?.vehicleCount) || 0)
  );
  const trailerCount = Math.max(
    Number(reservation?.trailerCount) || 0,
    ...segments.map((seg) => Number(seg?.trailerCount) || 0)
  );
  const vehicleType =
    reservation?.vehicleType ||
    segments.find((seg) => seg?.vehicleType)?.vehicleType ||
    null;
  if (vehicleCount >= 1) {
    const typeLabel =
      vehicleType === 'CAMIONETA'
        ? 'camioneta'
        : vehicleType === 'MOTO'
          ? 'moto'
          : 'auto';
    flags.push({ key: 'vehiculo', label: `Vehículo (${typeLabel})` });
  } else {
    const segmentNeedsEstacionamiento = segments.some((seg) =>
      Boolean(seg?.requiereEstacionamiento)
    );
    if (segmentNeedsEstacionamiento || reservation?.requiereEstacionamiento) {
      flags.push({ key: 'estacionamiento', label: 'Requiere estacionamiento' });
    }
  }
  if (trailerCount >= 1) {
    flags.push({ key: 'trailer', label: 'Tráiler' });
  }

  return {
    fixedRooms,
    selectedTags,
    flags,
    hasAny:
      fixedRooms.length > 0 || selectedTags.length > 0 || flags.length > 0
  };
}
