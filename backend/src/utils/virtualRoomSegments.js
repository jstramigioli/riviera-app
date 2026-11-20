const prisma = require('./prisma');

/**
 * Extrae el ID numérico de habitación virtual desde un segmento.
 * Acepta roomId "virtual_12", virtualRoomId, o isVirtual + virtualRoomId.
 */
function parseVirtualRoomId(segment) {
  if (!segment) return null;

  if (segment.virtualRoomId != null && segment.virtualRoomId !== '') {
    const n = parseInt(segment.virtualRoomId, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }

  const roomId = segment.roomId;
  if (typeof roomId === 'string' && roomId.startsWith('virtual_')) {
    const n = parseInt(roomId.slice('virtual_'.length), 10);
    if (Number.isFinite(n) && n > 0) return n;
  }

  if (segment.isVirtual === true && segment.roomId != null) {
    const n = parseInt(segment.roomId, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }

  return null;
}

function isVirtualRoomRef(segment) {
  return parseVirtualRoomId(segment) != null
    || (typeof segment?.roomId === 'string' && segment.roomId.startsWith('virtual_'));
}

/**
 * Expande cada selección virtual_X en N segmentos físicos (uno por componente),
 * todos con virtualRoomId. El primero conserva tarifa/nightRates; el resto bloquea.
 */
async function expandVirtualRoomSegments(segments) {
  if (!Array.isArray(segments) || segments.length === 0) return [];

  const expanded = [];

  for (const segment of segments) {
    const virtualId = parseVirtualRoomId(segment);

    if (!virtualId) {
      const roomIdNum = parseInt(segment.roomId, 10);
      if (!Number.isFinite(roomIdNum) || roomIdNum <= 0) {
        throw new Error(`roomId inválido en segmento: ${segment.roomId}`);
      }
      expanded.push({
        ...segment,
        roomId: roomIdNum,
        virtualRoomId: segment.virtualRoomId ? parseInt(segment.virtualRoomId, 10) : null
      });
      continue;
    }

    const virtualRoom = await prisma.virtualRoom.findUnique({
      where: { id: virtualId },
      include: {
        roomType: true,
        components: {
          orderBy: { orderIndex: 'asc' },
          include: { room: true }
        }
      }
    });

    if (!virtualRoom) {
      throw new Error(`Habitación virtual ${virtualId} no encontrada`);
    }
    if (!virtualRoom.isActive) {
      throw new Error(`Habitación virtual "${virtualRoom.name}" no está activa`);
    }
    if (!virtualRoom.components || virtualRoom.components.length === 0) {
      throw new Error(`Habitación virtual "${virtualRoom.name}" no tiene componentes`);
    }

    const roomTypeId = segment.roomTypeId
      ? parseInt(segment.roomTypeId, 10)
      : virtualRoom.roomTypeId;
    const guestCount = parseInt(segment.guestCount || segment.requiredGuests || 1, 10) || 1;
    const baseRate = parseFloat(segment.baseRate) || 0;
    const nightRates = Array.isArray(segment.nightRates) ? segment.nightRates : [];

    virtualRoom.components.forEach((comp, idx) => {
      const isPrimary = idx === 0;
      expanded.push({
        ...segment,
        roomId: comp.roomId,
        roomTypeId,
        virtualRoomId: virtualRoom.id,
        guestCount: isPrimary ? guestCount : 1,
        baseRate: isPrimary ? baseRate : 0,
        nightRates: isPrimary ? nightRates : [],
        reason: isPrimary
          ? (segment.reason || `Habitación virtual: ${virtualRoom.name}`)
          : `Componente de ${virtualRoom.name}`,
        notes: isPrimary
          ? (segment.notes || null)
          : `Bloqueo por reserva virtual ${virtualRoom.name}`,
        requiredTags: segment.requiredTags || [],
        requiredRoomId: segment.requiredRoomId || null,
        services: segment.services,
        startDate: segment.startDate,
        endDate: segment.endDate,
        _virtualPrimary: isPrimary,
        _virtualName: virtualRoom.name
      });
    });
  }

  return expanded;
}

/**
 * Colapsa componentes virtuales paralelos a un segmento lógico por rango de fechas
 * (para validar continuidad temporal).
 */
function collapseVirtualGroupsForTimeline(segments) {
  const logical = [];
  const seenVirtualRanges = new Set();

  for (const segment of segments || []) {
    const virtualId = segment.virtualRoomId != null
      ? parseInt(segment.virtualRoomId, 10)
      : parseVirtualRoomId(segment);

    if (virtualId) {
      const start = new Date(segment.startDate).getTime();
      const end = new Date(segment.endDate).getTime();
      const key = `${virtualId}|${start}|${end}`;
      if (seenVirtualRanges.has(key)) continue;
      seenVirtualRanges.add(key);
      logical.push(segment);
      continue;
    }

    logical.push(segment);
  }

  return logical;
}

/** ¿Segmento solo de bloqueo (componente secundario de virtual)? */
function isVirtualBlockingSegment(segment) {
  if (!segment) return false;
  const virtualId = segment.virtualRoomId != null
    ? parseInt(segment.virtualRoomId, 10)
    : null;
  if (!virtualId) return false;
  if (segment._virtualPrimary === false) return true;
  const rate = Number(segment.baseRate);
  return Number.isFinite(rate) && rate === 0;
}

module.exports = {
  parseVirtualRoomId,
  isVirtualRoomRef,
  expandVirtualRoomSegments,
  collapseVirtualGroupsForTimeline,
  isVirtualBlockingSegment
};
