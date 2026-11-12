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
 */
export function collapseSegmentsForEditUi(segments = []) {
  const active = segments.filter((s) => s.isActive !== false);
  const result = [];
  const seenVirtual = new Set();

  for (const seg of active) {
    const virtualId = seg.virtualRoomId != null ? parseInt(seg.virtualRoomId, 10) : null;
    if (virtualId) {
      const start = String(seg.startDate || '').slice(0, 10);
      const end = String(seg.endDate || '').slice(0, 10);
      const key = `${virtualId}|${start}|${end}`;
      if (seenVirtual.has(key)) continue;
      seenVirtual.add(key);

      const sameGroup = active.filter(
        (s) =>
          parseInt(s.virtualRoomId, 10) === virtualId &&
          String(s.startDate || '').slice(0, 10) === start &&
          String(s.endDate || '').slice(0, 10) === end
      );
      const primary =
        sameGroup.find((s) => Number(s.baseRate) > 0) || sameGroup[0] || seg;
      const virtualRoom = primary.virtualRoom || seg.virtualRoom || null;

      result.push({
        ...primary,
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
      price: Number(seg.baseRate) || 0,
      ratesData: {
        totalAmount: null,
        rates: []
      },
      components: vr?.components || []
    };
  }

  return {
    id: seg.roomId,
    name: seg.room?.name || seg.uiRoomName,
    description: seg.room?.description || '',
    maxPeople: seg.room?.maxPeople || seg.guestCount || 1,
    isVirtual: false,
    virtualRoomId: null,
    roomType: seg.roomType || seg.room?.roomType || null,
    roomTypeId: seg.roomTypeId || seg.room?.roomTypeId || null,
    price: Number(seg.baseRate) || 0,
    ratesData: {
      totalAmount: null,
      rates: []
    }
  };
}
