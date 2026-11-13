/**
 * Utilidades de habitaciones virtuales en el flujo de consulta/reserva.
 */

export function parseVirtualRoomId(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  const str = String(value);
  if (str.startsWith('virtual_')) {
    const n = parseInt(str.slice('virtual_'.length), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const n = parseInt(str, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function isVirtualRoomSelection(roomOrSegment) {
  if (!roomOrSegment) return false;
  if (roomOrSegment.isVirtual) return true;
  if (roomOrSegment.virtualRoomId != null) return true;
  return typeof roomOrSegment.id === 'string' && roomOrSegment.id.startsWith('virtual_');
}

/** Payload de roomId/virtualRoomId para create/update. */
export function roomSelectionPayload(room) {
  if (!room) return { roomId: null, virtualRoomId: null, isVirtual: false };
  const virtualId = room.virtualRoomId != null
    ? parseVirtualRoomId(room.virtualRoomId)
    : (room.isVirtual ? parseVirtualRoomId(room.id) : null);

  if (virtualId) {
    return {
      roomId: `virtual_${virtualId}`,
      virtualRoomId: virtualId,
      isVirtual: true,
      roomTypeId: room.roomTypeId || room.roomType?.id || null
    };
  }

  return {
    roomId: room.id,
    virtualRoomId: null,
    isVirtual: false,
    roomTypeId: room.roomTypeId || room.roomType?.id || null
  };
}

/**
 * Colapsa componentes físicos de una misma virtual (mismo rango) a un tramo de UI.
 * Importante: expandVirtualRoomSegments guarda guestCount real solo en el primario
 * y guestCount=1 en secundarios de bloqueo; sin colapsar, el panel muestra
 * «A partir de…, 1 huéspedes» aunque sea un solo tramo lógico.
 */
export function collapseSegmentsForEditUi(segments = []) {
  const active = segments.filter((s) => s.isActive !== false);
  const result = [];
  const seenVirtual = new Set();

  for (const seg of active) {
    const virtualId = seg.virtualRoomId != null ? parseInt(seg.virtualRoomId, 10) : null;
    if (virtualId) {
      const start = String(seg.startDate || seg.checkIn || '').slice(0, 10);
      const end = String(seg.endDate || seg.checkOut || '').slice(0, 10);
      const key = `${virtualId}|${start}|${end}`;
      if (seenVirtual.has(key)) continue;
      seenVirtual.add(key);

      const sameGroup = active.filter(
        (s) =>
          parseInt(s.virtualRoomId, 10) === virtualId &&
          String(s.startDate || s.checkIn || '').slice(0, 10) === start &&
          String(s.endDate || s.checkOut || '').slice(0, 10) === end
      );
      // Primario = el que cobra (baseRate>0); si empatan, el de mayor guestCount.
      const primary =
        sameGroup.find((s) => Number(s.baseRate) > 0) ||
        sameGroup.reduce((best, s) =>
          (Number(s.guestCount) || 0) > (Number(best?.guestCount) || 0) ? s : best
        , sameGroup[0]) ||
        seg;
      const virtualRoom = primary.virtualRoom || seg.virtualRoom || null;
      const guestCount = Math.max(
        ...sameGroup.map((s) => Number(s.guestCount) || 0),
        Number(primary.guestCount) || 0,
        1
      );

      result.push({
        ...primary,
        guestCount,
        requiredGuests: guestCount,
        virtualRoomId: virtualId,
        virtualRoom,
        isVirtual: true,
        uiRoomId: `virtual_${virtualId}`,
        uiRoomName: virtualRoom?.name || `Virtual #${virtualId}`
      });
      continue;
    }

    result.push({
      ...seg,
      isVirtual: false,
      uiRoomId: seg.roomId,
      uiRoomName: seg.room?.name || `Hab ${seg.roomId}`
    });
  }

  return result;
}

/** Segmentos lógicos para paneles/detalle (alias semántico del colapso). */
export function getDisplaySegments(segments = []) {
  return collapseSegmentsForEditUi(segments);
}

/** Compara dos habitaciones (físicas o virtuales) por identidad estable. */
export function roomsMatch(a, b) {
  if (!a || !b) return false;
  const aVirtual = parseVirtualRoomId(a.virtualRoomId ?? (a.isVirtual ? a.id : null));
  const bVirtual = parseVirtualRoomId(b.virtualRoomId ?? (b.isVirtual ? b.id : null));
  if (aVirtual && bVirtual) return aVirtual === bVirtual;
  if (aVirtual || bVirtual) return false;
  if (a.id == null || b.id == null) return false;
  return String(a.id) === String(b.id);
}

/** Busca en un listado la habitación equivalente a la selección actual. */
export function findMatchingRoom(rooms, selected) {
  if (!selected || !Array.isArray(rooms) || rooms.length === 0) return null;
  return rooms.find((room) => roomsMatch(room, selected)) || null;
}

/**
 * Tras re-buscar disponibilidad (p. ej. cambio de servicio), conserva la
 * habitación ya elegida: rebind a la del listado (tarifas nuevas) o la
 * antepone si el backend no la devolvió.
 */
export function preserveSelectedRoomInList(rooms, selected) {
  const list = Array.isArray(rooms) ? [...rooms] : [];
  if (!selected) return { rooms: list, selected: null };
  const match = findMatchingRoom(list, selected);
  if (match) return { rooms: list, selected: match };
  return {
    rooms: [selected, ...list.filter((room) => !roomsMatch(room, selected))],
    selected
  };
}

/** Arma el objeto "room" seleccionado a partir de un segmento colapsado. */
export function selectedRoomFromCollapsedSegment(seg) {
  if (!seg) return null;
  if (seg.isVirtual || seg.virtualRoomId) {
    const virtualId = parseVirtualRoomId(seg.virtualRoomId);
    const vr = seg.virtualRoom;
    return {
      id: `virtual_${virtualId}`,
      name: vr?.name || seg.uiRoomName || `Virtual #${virtualId}`,
      description: vr?.description || '',
      maxPeople: vr?.maxPeople || seg.guestCount || 1,
      isVirtual: true,
      virtualRoomId: virtualId,
      roomType: vr?.roomType || seg.roomType || null,
      roomTypeId: vr?.roomTypeId || seg.roomTypeId || vr?.roomType?.id || null,
      tags: vr?.tags || seg.room?.tags || [],
      price: Number(seg.baseRate) || 0,
      ratesData: {
        totalAmount: null,
        rates: []
      },
      components: vr?.components || []
    };
  }

  const roomId = seg.roomId ?? seg.uiRoomId ?? seg.room?.id ?? null;
  if (roomId == null) return null;

  return {
    id: roomId,
    name: seg.room?.name || seg.uiRoomName || `Hab ${roomId}`,
    description: seg.room?.description || '',
    maxPeople: seg.room?.maxPeople || seg.guestCount || 1,
    isVirtual: false,
    virtualRoomId: null,
    roomType: seg.roomType || seg.room?.roomType || null,
    roomTypeId: seg.roomTypeId || seg.room?.roomTypeId || seg.room?.roomType?.id || null,
    tags: seg.room?.tags || [],
    price: Number(seg.baseRate) || 0,
    ratesData: {
      totalAmount: null,
      rates: []
    }
  };
}
