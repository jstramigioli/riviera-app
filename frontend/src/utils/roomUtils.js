// Función para ordenar habitaciones: primero las numéricas en orden, luego departamentos
export function sortRooms(rooms) {
  const habitaciones = rooms.filter(room => /^\d+$/.test(room.name))
    .sort((a, b) => parseInt(a.name) - parseInt(b.name));
  const departamentos = rooms.filter(room => !/^\d+$/.test(room.name));
  return [...habitaciones, ...departamentos];
} 