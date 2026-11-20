/**
 * Requisitos visibles en el panel azul de la página de reserva:
 * habitación fijada (requiredRoomId / fixed) + tags seleccionados.
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
 * @returns {{ fixedRooms: Array<{key:string, name:string}>, selectedTags: Array<{id:number|string, name:string, color?:string}>, hasAny: boolean }}
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

  return {
    fixedRooms,
    selectedTags,
    hasAny: fixedRooms.length > 0 || selectedTags.length > 0
  };
}
