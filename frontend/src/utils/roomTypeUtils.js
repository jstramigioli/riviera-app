// Función para obtener la capacidad de un tipo de habitación
// Ahora usa maxPeople del objeto roomType en lugar de valores hardcodeados
export function getRoomTypeCapacity(roomType) {
  // Si roomType es un objeto con maxPeople, usarlo directamente
  if (typeof roomType === 'object' && roomType.maxPeople) {
    return roomType.maxPeople;
  }
  // Si roomType es solo el nombre, intentar obtenerlo de la base de datos
  // Por compatibilidad temporal, mantener algunos valores por defecto
  const fallbackCapacities = {
    'single': 1,
    'doble': 2,
    'triple': 3,
    'cuadruple': 4,
    'quintuple': 5,
    'sextuple': 6,
    'departamento El Romerito': 4,
    'departamento El Tilo': 4,
    'departamento Via 1': 4,
    'departamento La Esquinita': 4
  };
  return fallbackCapacities[roomType] || 1;
}

// Función para obtener el color de un tipo de habitación
export function getRoomTypeColor(roomTypeName) {
  const colors = {
    'single': '#17a2b8',
    'doble': '#28a745',
    'triple': '#ffc107',
    'cuadruple': '#fd7e14',
    'quintuple': '#6f42c1',
    'sextuple': '#e83e8c',
    'departamento El Romerito': '#20c997',
    'departamento El Tilo': '#6f42c1',
    'departamento Via 1': '#fd7e14',
    'departamento La Esquinita': '#20c997'
  };
  return colors[roomTypeName] || '#6c757d';
}

// Función para obtener el nombre legible de un tipo de habitación
export function getRoomTypeLabel(roomType) {
  // Si roomType es un objeto con name, usar el name directamente
  if (typeof roomType === 'object' && roomType.name) {
    return formatRoomTypeName(roomType.name);
  }
  // Si roomType es solo el nombre, formatearlo
  return formatRoomTypeName(roomType);
}

// Función auxiliar para formatear nombres de tipos de habitación
function formatRoomTypeName(name) {
  if (!name) return '';
  
  // Capitalizar primera letra de cada palabra
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
} 