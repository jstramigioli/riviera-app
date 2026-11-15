/**
 * Modelo del Dashboard recepción: reusa computeDayInfoStats y añade
 * atrasados, ocupación por tipo, capacidad sin fuera de servicio, notificaciones.
 */

import {
  computeDayInfoStats,
  mainClientDisplayName,
  mealFlagsFromServiceRef,
  movementListLabel,
  movementRoomLabel,
  primaryServiceRef
} from './dayInfoStats';
import { shiftIso } from './calendarDates';

const OOS_STATUS = new Set([
  'maintenance',
  'out_of_service',
  'out-of-service',
  'fuera_de_servicio',
  'fuera-de-servicio',
  'oos',
  'blocked',
  'bloqueada'
]);

function civilOf(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  try {
    return value.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function activeSegments(reservation) {
  const segments = reservation?.segments;
  if (!Array.isArray(segments) || segments.length === 0) return [];
  return segments.filter((s) => s.isActive !== false);
}

function stayBounds(reservation) {
  const segments = activeSegments(reservation);
  if (segments.length) {
    let start = null;
    let end = null;
    for (const seg of segments) {
      const s = civilOf(seg.startDate ?? seg.checkIn);
      const e = civilOf(seg.endDate ?? seg.checkOut);
      if (s && (!start || s < start)) start = s;
      if (e && (!end || e > end)) end = e;
    }
    return { start, end };
  }
  return {
    start: civilOf(reservation?.checkIn),
    end: civilOf(reservation?.checkOut)
  };
}

function segmentsCoveringDay(segments, dayIso) {
  return segments.filter((seg) => {
    const start = civilOf(seg.startDate ?? seg.checkIn);
    const end = civilOf(seg.endDate ?? seg.checkOut);
    return start && end && start <= dayIso && dayIso < end;
  });
}

function previousCivilDay(dayIso) {
  return shiftIso(dayIso, -1);
}

function buildRoomsById(rooms) {
  const map = new Map();
  for (const room of rooms || []) {
    if (room?.id != null) map.set(room.id, room);
  }
  return map;
}

function buildServiceTypesById(serviceTypes) {
  const map = new Map();
  for (const st of serviceTypes || []) {
    if (st?.id != null) map.set(String(st.id), st);
  }
  return map;
}

export function isRoomOutOfService(room) {
  const status = String(room?.status || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  return OOS_STATUS.has(status);
}

/** Habitaciones físicas en servicio (capacidad del hotel). */
export function physicalInServiceRooms(rooms = []) {
  return (rooms || []).filter((room) => !isRoomOutOfService(room));
}

function occupiedPhysicalRoomIds(dayIso, reservations) {
  const ids = new Set();
  for (const reservation of reservations || []) {
    if (
      reservation?.status === 'CANCELADA' ||
      reservation?.status === 'NO_PRESENTADA' ||
      reservation?.status === 'cancelled' ||
      reservation?.status === 'no_show'
    ) {
      continue;
    }
    const segments = activeSegments(reservation);
    const covering = segmentsCoveringDay(segments, dayIso);
    if (segments.length) {
      for (const seg of covering) {
        if (seg.roomId != null) ids.add(seg.roomId);
      }
    } else {
      const { start, end } = stayBounds(reservation);
      if (start && end && start <= dayIso && dayIso < end && reservation.roomId != null) {
        ids.add(reservation.roomId);
      }
    }
  }
  return ids;
}

export function occupancyByRoomType(dayIso, rooms = [], reservations = []) {
  const inService = physicalInServiceRooms(rooms);
  const occupied = occupiedPhysicalRoomIds(dayIso, reservations);
  const byType = new Map();

  for (const room of inService) {
    const typeName =
      room?.roomType?.name ||
      room?.roomTypeName ||
      room?.typeName ||
      'Sin tipo';
    if (!byType.has(typeName)) {
      byType.set(typeName, { typeName, total: 0, occupied: 0 });
    }
    const row = byType.get(typeName);
    row.total += 1;
    if (occupied.has(room.id)) row.occupied += 1;
  }

  return Array.from(byType.values())
    .map((row) => ({
      ...row,
      free: Math.max(0, row.total - row.occupied),
      percentage: row.total > 0 ? (row.occupied / row.total) * 100 : 0
    }))
    .sort((a, b) => a.typeName.localeCompare(b.typeName, 'es'));
}

/**
 * Checkout previsto < hoy y aún INGRESADA (no finalizó manualmente).
 */
export function lateCheckoutItems(todayIso, rooms = [], reservations = []) {
  const roomsById = buildRoomsById(rooms);
  const items = [];
  for (const reservation of reservations || []) {
    if (reservation?.status !== 'INGRESADA') continue;
    const segments = activeSegments(reservation);
    const { end } = stayBounds(reservation);
    if (!end || end >= todayIso) continue;
    const guestName = mainClientDisplayName(reservation);
    const room = movementRoomLabel(reservation, segments, end, 'out', roomsById);
    items.push({
      reservationId: reservation.id,
      roomLabel: room,
      guestName,
      plannedCheckout: end,
      daysLate: Math.max(1, Math.round((Date.parse(`${todayIso}T00:00:00Z`) - Date.parse(`${end}T00:00:00Z`)) / 86400000)),
      label: movementListLabel(room, guestName)
    });
  }
  items.sort((a, b) => String(a.plannedCheckout).localeCompare(String(b.plannedCheckout)));
  return items;
}

/** Llegadas de hoy aún no ingresadas (PENDIENTE / CONFIRMADA). */
export function pendingArrivalItems(todayIso, dayStats) {
  const pendingStatuses = new Set(['PENDIENTE', 'CONFIRMADA', 'pending', 'confirmed']);
  const items = [];
  for (const item of dayStats?.checkInItems || []) {
    const status = item.status || item.reservationStatus;
    // checkInItems may not carry status — enrich below if needed
    if (status && !pendingStatuses.has(status)) continue;
    items.push(item);
  }
  return items;
}

function enrichMovementItemsWithStatus(items, reservations) {
  const byId = new Map((reservations || []).map((r) => [r.id, r]));
  return (items || []).map((item) => {
    const res = byId.get(item.reservationId);
    return {
      ...item,
      status: res?.status || null,
      pending: res ? !['INGRESADA', 'FINALIZADA', 'CANCELADA', 'NO_PRESENTADA'].includes(res.status) : false
    };
  });
}

function mealDetailItems(dayIso, rooms, reservations, serviceTypes, meal) {
  const roomsById = buildRoomsById(rooms);
  const serviceTypesById = buildServiceTypesById(serviceTypes);
  const prevDay = previousCivilDay(dayIso);
  const items = [];

  for (const reservation of reservations || []) {
    if (
      reservation?.status === 'CANCELADA' ||
      reservation?.status === 'NO_PRESENTADA' ||
      reservation?.status === 'cancelled' ||
      reservation?.status === 'no_show'
    ) {
      continue;
    }
    const segments = activeSegments(reservation);
    const { start, end } = stayBounds(reservation);
    if (!start || !end) continue;

    let segsForMeal = [];
    if (meal === 'breakfast') {
      if (!(start < dayIso && dayIso <= end)) continue;
      const prevCovering = prevDay ? segmentsCoveringDay(segments, prevDay) : [];
      segsForMeal = prevCovering.length
        ? prevCovering
        : segments.filter((s) => civilOf(s.endDate ?? s.checkOut) === dayIso);
      if (!segsForMeal.length) segsForMeal = segments;
    } else {
      if (!(start <= dayIso && dayIso < end)) continue;
      segsForMeal = segmentsCoveringDay(segments, dayIso);
      if (!segsForMeal.length) segsForMeal = segments;
    }

    const flags = mealFlagsFromServiceRef(
      primaryServiceRef(segsForMeal, reservation),
      serviceTypesById
    );
    if (meal === 'breakfast' && !flags.breakfast) continue;
    if (meal === 'dinner' && !flags.dinner) continue;

    const guestName = mainClientDisplayName(reservation);
    const room = movementRoomLabel(
      reservation,
      segments,
      dayIso,
      meal === 'breakfast' ? 'out' : 'in',
      roomsById
    );
    const guests =
      Number(reservation.requiredGuests) ||
      segsForMeal.reduce((sum, s) => sum + (Number(s.guestCount) || 0), 0) ||
      1;

    items.push({
      reservationId: reservation.id,
      roomLabel: room,
      guestName,
      guests,
      label: `${movementListLabel(room, guestName)} (${guests})`
    });
  }

  return items;
}

/**
 * @param {{ todayIso: string, mealsDateIso?: string, rooms: any[], reservations: any[], serviceTypes?: any[] }} args
 */
export function buildReceptionDashboardModel({
  todayIso,
  mealsDateIso,
  rooms = [],
  reservations = [],
  serviceTypes = []
}) {
  const capacityRooms = physicalInServiceRooms(rooms);
  const oosRooms = (rooms || []).filter(isRoomOutOfService);
  const mealsIso = mealsDateIso || todayIso;
  const tomorrowIso = shiftIso(todayIso, 1);

  const today = computeDayInfoStats(todayIso, capacityRooms, reservations, serviceTypes);
  const tomorrow = computeDayInfoStats(tomorrowIso, capacityRooms, reservations, serviceTypes);
  const meals = computeDayInfoStats(mealsIso, capacityRooms, reservations, serviceTypes);

  const checkInItems = enrichMovementItemsWithStatus(today.checkInItems, reservations);
  const checkOutItems = enrichMovementItemsWithStatus(today.checkOutItems, reservations);
  const lateItems = lateCheckoutItems(todayIso, capacityRooms, reservations);
  const pendingArrivals = checkInItems.filter((i) => i.pending);
  const byType = occupancyByRoomType(todayIso, capacityRooms, reservations);

  const notifications = [
    ...lateItems.map((item) => ({
      id: `late-${item.reservationId}`,
      kind: 'late_checkout',
      severity: 'warning',
      title: 'Checkout atrasado',
      body: `${item.label} · previsto ${item.plannedCheckout}`,
      reservationId: item.reservationId
    })),
    ...pendingArrivals.map((item) => ({
      id: `arrival-${item.reservationId}`,
      kind: 'pending_arrival',
      severity: 'info',
      title: 'Ingreso pendiente',
      body: item.label,
      reservationId: item.reservationId
    }))
  ];

  return {
    todayIso,
    tomorrowIso,
    mealsIso,
    capacityRoomsCount: capacityRooms.length,
    outOfServiceCount: oosRooms.length,
    today: {
      ...today,
      checkInItems,
      checkOutItems,
      pendingArrivals,
      lateCheckouts: lateItems
    },
    tomorrow,
    meals: {
      ...meals,
      breakfastItems: mealDetailItems(mealsIso, capacityRooms, reservations, serviceTypes, 'breakfast'),
      dinnerItems: mealDetailItems(mealsIso, capacityRooms, reservations, serviceTypes, 'dinner')
    },
    occupancyByType: byType,
    notifications
  };
}
