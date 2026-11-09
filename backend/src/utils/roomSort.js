/** Orden: habitaciones numéricas asc, luego el resto. */
function sortRooms(rooms) {
  const habitaciones = rooms
    .filter((room) => /^\d+$/.test(room.name))
    .sort((a, b) => parseInt(roomName(a), 10) - parseInt(roomName(b), 10));
  const departamentos = rooms.filter((room) => !/^\d+$/.test(room.name));
  return [...habitaciones, ...departamentos];
}

function roomName(room) {
  return room.name;
}

module.exports = { sortRooms };
