/**
 * Disponibilidad de habitaciones virtuales en búsqueda (Consulta).
 * - Con habitación específica no se listan virtuales.
 * - Tags de la virtual = unión de tags de sus componentes (para filtros/scoring).
 */

function shouldIncludeVirtualRooms(requiredRoomId) {
  if (requiredRoomId === undefined || requiredRoomId === null || requiredRoomId === '') {
    return true;
  }
  return false;
}

/**
 * Unión de tags de las habitaciones componentes (por id).
 * @param {Array<{ room?: { tags?: Array<{ id: number|string, name?: string }> } }>} components
 */
function inheritTagsFromComponents(components = []) {
  const byId = new Map();
  for (const component of components) {
    const tags = Array.isArray(component?.room?.tags) ? component.room.tags : [];
    for (const tag of tags) {
      if (tag == null || tag.id == null) continue;
      const key = String(tag.id);
      if (!byId.has(key)) {
        byId.set(key, tag);
      }
    }
  }
  return Array.from(byId.values());
}

/**
 * Formato de habitación virtual para el listado de disponibilidad.
 */
function formatVirtualRoomForAvailability(virtualRoom) {
  const components = virtualRoom.components || [];
  return {
    id: `virtual_${virtualRoom.id}`,
    name: virtualRoom.name,
    description: virtualRoom.description,
    maxPeople: virtualRoom.maxPeople,
    status: 'available',
    isVirtual: true,
    roomType: virtualRoom.roomType,
    tags: inheritTagsFromComponents(components),
    components,
    virtualRoomId: virtualRoom.id
  };
}

module.exports = {
  shouldIncludeVirtualRooms,
  inheritTagsFromComponents,
  formatVirtualRoomForAvailability
};
