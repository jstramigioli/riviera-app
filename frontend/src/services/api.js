const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export { API_URL };

export async function fetchRooms() {
  const res = await fetch(`${API_URL}/rooms`);
  if (!res.ok) throw new Error('Error fetching rooms');
  return res.json();
}

export async function fetchRoomTypes() {
  const res = await fetch(`${API_URL}/room-types`);
  if (!res.ok) throw new Error('Error fetching room types')
  return res.json()
}

// Funciones para habitaciones virtuales
export async function fetchVirtualRooms() {
  const res = await fetch(`${API_URL}/virtual-rooms`);
  if (!res.ok) throw new Error('Error fetching virtual rooms');
  return res.json();
}

export async function createVirtualRoom(data) {
  const res = await fetch(`${API_URL}/virtual-rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Error creating virtual room');
  return res.json();
}

export async function updateVirtualRoom(id, data) {
  const res = await fetch(`${API_URL}/virtual-rooms/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Error updating virtual room');
  return res.json();
}

export async function deleteVirtualRoom(id) {
  const res = await fetch(`${API_URL}/virtual-rooms/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Error deleting virtual room');
  return res.ok;
}

export async function fetchReservations() {
  const res = await fetch(`${API_URL}/reservations`);
  if (!res.ok) throw new Error('Error fetching reservations');
  return res.json();
}

export async function fetchClients() {
  const res = await fetch(`${API_URL}/clients`);
  if (!res.ok) throw new Error('Error fetching clients');
  return res.json();
}

export async function fetchGuests() {
  const res = await fetch(`${API_URL}/guests`);
  if (!res.ok) throw new Error('Error fetching guests');
  return res.json();
}

export async function fetchPayments() {
  const res = await fetch(`${API_URL}/payments`);
  if (!res.ok) throw new Error('Error fetching payments');
  return res.json();
}

export async function fetchPaymentsByGuest(guestId) {
  const res = await fetch(`${API_URL}/payments/guest/${guestId}`);
  if (!res.ok) throw new Error('Error fetching guest payments');
  return res.json();
}

export async function updateReservation(id, data) {
  const res = await fetch(`${API_URL}/reservations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Error updating reservation');
  return res.json();
}

export async function updateReservationStatus(id, status) {
  const res = await fetch(`${API_URL}/reservations/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  if (!res.ok) throw new Error('Error updating reservation status');
  return res.json();
}

export async function createReservation(data) {
  // Siempre usar la ruta de multi-segment ya que todas las reservas usan segmentos
  const res = await fetch(`${API_URL}/reservations/multi-segment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  if (!res.ok) {
    let errorMessage = 'Error creating reservation';
    try {
      const errorData = await res.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      // Si no se puede parsear el error, usar el status
      errorMessage = `Error creating reservation: ${res.status} ${res.statusText}`;
    }
    throw new Error(errorMessage);
  }
  
  return res.json();
}

export async function deleteReservation(id) {
  const res = await fetch(`${API_URL}/reservations/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Error deleting reservation');
  return res.ok;
}

export async function updateClient(id, data) {
  const res = await fetch(`${API_URL}/clients/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Error updating client');
  return res.json();
}

export async function deleteClient(id) {
  const res = await fetch(`${API_URL}/clients/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Error deleting client');
  return res.ok;
}

export async function updateGuest(id, data) {
  const res = await fetch(`${API_URL}/guests/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Error updating guest');
  return res.json();
}

export async function getGuestBalance(guestId) {
  const res = await fetch(`${API_URL}/guests/${guestId}/balance`);
  if (!res.ok) throw new Error('Error fetching guest balance');
  return res.json();
}

export async function createPayment(data) {
  const res = await fetch(`${API_URL}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Error creating payment');
  return res.json();
}

export async function createConsumptionCharge(data) {
  const res = await fetch(`${API_URL}/payments/consumption-charge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Error creating consumption charge');
  return res.json();
}

export async function getClientBalance(clientId) {
  const res = await fetch(`${API_URL}/clients/${clientId}/balance`);
  if (!res.ok) throw new Error('Error fetching client balance');
  return res.json();
}

// Funciones para tarifas diarias
export const getRates = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.roomTypeId) params.append('roomTypeId', filters.roomTypeId);

  const response = await fetch(`${API_URL}/rates/rates?${params}`);
  if (!response.ok) throw new Error('Error al obtener tarifas');
  return response.json();
};

export const createRates = async (rateData) => {
  const response = await fetch(`${API_URL}/rates/rates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rateData)
  });
  if (!response.ok) throw new Error('Error al crear tarifas');
  return response.json();
};

export const updateRate = async (rateId, updates) => {
  const response = await fetch(`${API_URL}/rates/rates/${rateId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!response.ok) throw new Error('Error al actualizar tarifa');
  return response.json();
};

export const deleteRate = async (rateId) => {
  const response = await fetch(`${API_URL}/rates/rates/${rateId}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('Error al eliminar tarifa');
  return response.ok;
};

export const suggestDynamicPrice = async (suggestionData) => {
  const response = await fetch(`${API_URL}/rates/rates/suggest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(suggestionData)
  });
  if (!response.ok) throw new Error('Error al sugerir precio');
  return response.json();
};

export async function createClient(data) {
  const res = await fetch(`${API_URL}/clients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Error creating client');
  return res.json();
}

export async function updateRoomOnServer(id, data) {
  const res = await fetch(`${API_URL}/rooms/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Error updating room');
  return res.json();
}

export async function createRoom(data) {
  const res = await fetch(`${API_URL}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Error creando habitación');
  return res.json();
}

export async function deleteRoom(id) {
  const res = await fetch(`${API_URL}/rooms/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Error eliminando habitación');
  return res.ok;
}

// Funciones para tipos de habitaciones
export async function createRoomType(data) {
  const res = await fetch(`${API_URL}/room-types`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Error creando tipo de habitación');
  return res.json();
}

export async function updateRoomType(id, data) {
  const res = await fetch(`${API_URL}/room-types/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Error actualizando tipo de habitación');
  return res.json();
}

export async function deleteRoomType(id) {
  const res = await fetch(`${API_URL}/room-types/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Error deleting room type');
  return res.json();
}

export async function updateRoomTypesOrder(roomTypeIds) {
  const res = await fetch(`${API_URL}/room-types/order`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomTypeIds })
  });
  if (!res.ok) throw new Error('Error updating room types order');
  return res.json();
}

export async function fetchTags() {
  const res = await fetch(`${API_URL}/tags`);
  if (!res.ok) throw new Error('Error fetching tags');
  return res.json();
}

export async function createTag(data) {
  const res = await fetch(`${API_URL}/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Error creating tag');
  return res.json();
}

export async function updateTag(id, data) {
  const res = await fetch(`${API_URL}/tags/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Error updating tag');
  return res.json();
}

export async function deleteTag(id) {
  const res = await fetch(`${API_URL}/tags/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Error deleting tag');
  return res.json();
}

// Buscar habitaciones disponibles según requerimientos
export async function findAvailableRooms(params) {
  const queryParams = new URLSearchParams();
  
  if (params.checkIn) queryParams.append('checkIn', params.checkIn);
  if (params.checkOut) queryParams.append('checkOut', params.checkOut);
  if (params.requiredGuests) queryParams.append('requiredGuests', params.requiredGuests);
  if (params.requiredRoomId) queryParams.append('requiredRoomId', params.requiredRoomId);
  if (params.excludeReservationId) queryParams.append('excludeReservationId', params.excludeReservationId);
  
  // Agregar etiquetas requeridas como array
  if (params.requiredTags && Array.isArray(params.requiredTags)) {
    params.requiredTags.forEach(tagId => {
      queryParams.append('requiredTags', tagId);
    });
  }

  const res = await fetch(`${API_URL}/reservations/available-rooms?${queryParams}`);
  if (!res.ok) throw new Error('Error finding available rooms');
  return res.json();
}



// Exportación por defecto con todas las funciones
// Funciones para el Calendario de Gestión
export async function fetchOpenDays(startDate, endDate) {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const res = await fetch(`${API_URL}/open-days?${params}`);
  if (!res.ok) throw new Error('Error fetching open days');
  return res.json();
}

export async function createOpenDay(data) {
  const res = await fetch(`${API_URL}/open-days`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Error creating open day');
  return res.json();
}

export async function updateOpenDay(date, data) {
  const res = await fetch(`${API_URL}/open-days/date/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errorText = await res.text();
    const error = new Error('Error updating open day');
    error.status = res.status;
    error.body = errorText;
    throw error;
  }
  return res.json();
}

export async function deleteOpenDay(date) {
  // Primero necesitamos obtener el ID del día por fecha
  const openDay = await fetch(`${API_URL}/open-days/date/${date}`);
  if (!openDay.ok) {
    if (openDay.status === 404) {
      // Si no existe, considerarlo como éxito
      return true;
    }
    throw new Error('Error finding open day to delete');
  }
  
  const dayData = await openDay.json();
  
  const res = await fetch(`${API_URL}/open-days/${dayData.id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Error deleting open day');
  return res.ok;
}

export async function getPricesForAllRoomTypes(date) {
  const res = await fetch(`${API_URL}/rates/prices/${date}/all-room-types`);
  if (!res.ok) throw new Error('Error fetching prices for all room types');
  return res.json();
}

export async function getPricesForDateRange(startDate, endDate) {
  const params = new URLSearchParams();
  params.append('startDate', startDate);
  params.append('endDate', endDate);

  const res = await fetch(`${API_URL}/rates/prices/range?${params}`);
  if (!res.ok) throw new Error('Error fetching prices for date range');
  return res.json();
}

// Funciones para el hotel
export async function getHotel() {
  const res = await fetch(`${API_URL}/hotel`);
  if (!res.ok) throw new Error('Error fetching hotel data');
  return res.json();
}

export async function updateHotel(data) {
  const res = await fetch(`${API_URL}/hotel`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Error updating hotel');
  return res.json();
}





export async function getCalculatedRates(hotelId, roomTypeId, startDate, endDate, serviceType = 'base') {
  const params = new URLSearchParams({
    startDate,
    endDate,
    serviceType
  });
  
  const res = await fetch(`${API_URL}/dynamic-pricing/calculated-rates/${hotelId}/${roomTypeId}?${params}`);
  if (!res.ok) throw new Error('Error getting calculated rates');
  return res.json();
}

export async function getReservationPricingDetails(reservationId) {
  const res = await fetch(`${API_URL}/reservations/${reservationId}/pricing`);
  if (!res.ok) throw new Error('Error fetching reservation pricing details');
  return res.json();
}

export async function getDetailedOccupancyScore(params) {
  console.log('=== DEBUG API getDetailedOccupancyScore ===');
  console.log('Parámetros enviados:', params);
  
  const res = await fetch(`${API_URL}/dynamic-pricing/detailed-occupancy-score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  
  if (!res.ok) {
    console.error('Error en la respuesta:', res.status, res.statusText);
    throw new Error('Error fetching detailed occupancy score');
  }
  
  const data = await res.json();
  console.log('Respuesta del servidor:', data);
  console.log('=== FIN DEBUG API ===\n');
  return data;
}

// Funciones para consultas
export async function fetchQueries() {
  const res = await fetch(`${API_URL}/queries`);
  if (!res.ok) throw new Error('Error fetching queries');
  return res.json();
}

// Funciones para SeasonBlocks
export async function fetchSeasonBlocks(hotelId = 'default-hotel') {
  const res = await fetch(`${API_URL}/season-blocks?hotelId=${hotelId}`);
  if (!res.ok) throw new Error('Error fetching season blocks');
  const data = await res.json();
  return data.data || [];
}

export async function getActiveSeasonBlock(hotelId, date) {
  const res = await fetch(`${API_URL}/season-blocks/active?hotelId=${hotelId}&date=${date}`);
  if (!res.ok) {
    if (res.status === 404) {
      return null; // No hay bloque activo para esa fecha
    }
    throw new Error('Error fetching active season block');
  }
  const data = await res.json();
  return data.seasonBlock || null;
}

// Función para obtener el próximo bloque de temporada activo
export async function getNextActiveSeasonBlock(hotelId, fromDate) {
  try {
    const seasonBlocks = await fetchSeasonBlocks(hotelId);
    const fromDateObj = new Date(fromDate);
    
    // Filtrar bloques activos (no borradores) que empiecen después de la fecha actual
    const futureBlocks = seasonBlocks
      .filter(block => 
        !block.isDraft && 
        new Date(block.startDate) >= fromDateObj
      )
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    
    return futureBlocks.length > 0 ? futureBlocks[0] : null;
  } catch (error) {
    console.error('Error getting next active season block:', error);
    return null;
  }
}

export async function fetchQuery(id) {
  const res = await fetch(`${API_URL}/queries/${id}`);
  if (!res.ok) throw new Error('Error fetching query');
  return res.json();
}

export async function createQuery(data) {
  const res = await fetch(`${API_URL}/queries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Error creating query');
  return res.json();
}

export async function updateQuery(id, data) {
  const res = await fetch(`${API_URL}/queries/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Error updating query');
  return res.json();
}

export async function deleteQuery(id) {
  const res = await fetch(`${API_URL}/queries/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Error deleting query');
  return res.ok;
}

export async function convertQueryToReservation(id) {
  const res = await fetch(`${API_URL}/queries/${id}/convert-to-reservation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error('Error converting query to reservation');
  return res.json();
}

export default {
  fetchRooms,
  fetchRoomTypes,
  fetchReservations,
  fetchClients,
  fetchGuests,
  fetchPayments,
  fetchPaymentsByGuest,
  updateReservation,
  createReservation,
  updateClient,
  deleteClient,
  updateGuest,
  getGuestBalance,
  createPayment,
  createConsumptionCharge,
  getClientBalance,
  getRates,
  createRates,
  updateRate,
  deleteRate,
  suggestDynamicPrice,
  createClient,
  updateRoomOnServer,
  createRoom,
  deleteRoom,
  createRoomType,
  updateRoomType,
  deleteRoomType,
  updateRoomTypesOrder,
  fetchTags,
  createTag,
  updateTag,
  deleteTag,
  findAvailableRooms,
  fetchOpenDays,
  createOpenDay,
  updateOpenDay,
  deleteOpenDay,
  getPricesForAllRoomTypes,
  getPricesForDateRange,
  getHotel,
  updateHotel,
  getCalculatedRates,
  fetchQueries,
  fetchQuery,
  createQuery,
  updateQuery,
  deleteQuery,
  convertQueryToReservation
};