// Mapeo de tipos de habitación a capacidades
export const ROOM_TYPE_CAPACITIES = {
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

// Función para obtener la capacidad de un tipo de habitación
export function getRoomTypeCapacity(roomTypeName) {
  return ROOM_TYPE_CAPACITIES[roomTypeName] || 1;
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
export function getRoomTypeLabel(roomTypeName) {
  const labels = {
    'single': 'Individual',
    'doble': 'Doble',
    'triple': 'Triple',
    'cuadruple': 'Cuádruple',
    'quintuple': 'Quíntuple',
    'sextuple': 'Séxtuple',
    'departamento El Romerito': 'Depto. El Romerito',
    'departamento El Tilo': 'Depto. El Tilo',
    'departamento Via 1': 'Depto. Via 1',
    'departamento La Esquinita': 'Depto. La Esquinita'
  };
  return labels[roomTypeName] || roomTypeName;
} 