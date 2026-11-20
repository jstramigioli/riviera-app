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

function guestCountForReservation(reservation) {
  if (!reservation) return 1;
  const fromRequired = Number(reservation.requiredGuests) || 0;
  const fromGuestsList = Array.isArray(reservation.guests)
    ? reservation.guests.length
    : 0;
  const segs = activeSegments(reservation);
  const fromSegs = segs.reduce((sum, s) => {
    const n = Number(s.guestCount);
    return sum + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);
  return Math.max(fromRequired, fromGuestsList, fromSegs, 1);
}

const PRE_CHECKIN_STATUSES = new Set([
  'PENDIENTE',
  'CONFIRMADA',
  'pending',
  'confirmed'
]);

function daysBetweenIso(fromIso, toIso) {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86400000);
}

function serviceTypeDisplayName(reservation, segments, serviceTypesById) {
  const ref = primaryServiceRef(segments, reservation);
  if (ref == null || ref === '') return '—';
  const st = serviceTypesById.get(String(ref));
  if (st?.name) return String(st.name);
  return String(ref);
}

function reservationNotes(reservation) {
  const raw = reservation?.notes ?? reservation?.notas ?? '';
  const text = String(raw || '').trim();
  return text || '—';
}

/**
 * INGRESADA con checkout previsto en [hoy … hoy+horizonDays-1]
 * (horizon 1 = hoy + atrasados, sin futuras).
 */
export function pendingCheckoutItems(
  todayIso,
  rooms = [],
  reservations = [],
  options = {}
) {
  const horizonDays = Math.max(1, Number(options.horizonDays) || 1);
  const endHorizon = shiftIso(todayIso, horizonDays - 1);
  const roomsById = buildRoomsById(rooms);
  const serviceTypesById = buildServiceTypesById(options.serviceTypes);
  const items = [];
  for (const reservation of reservations || []) {
    if (reservation?.status !== 'INGRESADA') continue;
    const segments = activeSegments(reservation);
    const { start, end } = stayBounds(reservation);
    if (!end || end > endHorizon) continue;
    const guestName = mainClientDisplayName(reservation);
    const room = movementRoomLabel(
      reservation,
      segments,
      end || todayIso,
      'out',
      roomsById
    );
    const late = Boolean(end && end < todayIso);
    items.push({
      reservationId: reservation.id,
      roomLabel: room,
      guestName,
      guests: guestCountForReservation(reservation),
      status: reservation.status,
      plannedCheckIn: start,
      plannedCheckout: end,
      late,
      daysLate: late ? Math.max(1, daysBetweenIso(end, todayIso)) : 0,
      notes: reservationNotes(reservation),
      serviceTypeLabel: serviceTypeDisplayName(
        reservation,
        segments,
        serviceTypesById
      ),
      label: movementListLabel(room, guestName)
    });
  }
  items.sort((a, b) => {
    const ae = a.plannedCheckout || '9999-99-99';
    const be = b.plannedCheckout || '9999-99-99';
    return String(ae).localeCompare(String(be));
  });
  return items;
}

/** @deprecated usar pendingCheckoutItems; se mantiene por compat de tests. */
export function lateCheckoutItems(todayIso, rooms = [], reservations = []) {
  return pendingCheckoutItems(todayIso, rooms, reservations).filter((i) => i.late);
}

/**
 * Ingresos: check-in en [hoy … hoy+horizonDays-1] + anteriores
 * aún PENDIENTE/CONFIRMADA. Futuros del horizonte solo si aún no ingresaron.
 */
export function buildCheckInPanelItems(
  todayIso,
  rooms = [],
  reservations = [],
  options = {}
) {
  const horizonDays = Math.max(1, Number(options.horizonDays) || 1);
  const endHorizon = shiftIso(todayIso, horizonDays - 1);
  const roomsById = buildRoomsById(rooms);
  const serviceTypesById = buildServiceTypesById(options.serviceTypes);
  const items = [];
  const seen = new Set();

  for (const reservation of reservations || []) {
    if (
      reservation?.status === 'CANCELADA' ||
      reservation?.status === 'NO_PRESENTADA' ||
      reservation?.status === 'cancelled' ||
      reservation?.status === 'no_show' ||
      reservation?.status === 'FINALIZADA'
    ) {
      continue;
    }
    const segments = activeSegments(reservation);
    const { start } = stayBounds(reservation);
    if (!start) continue;

    const inHorizon = start >= todayIso && start <= endHorizon;
    const isOverduePending =
      start < todayIso && PRE_CHECKIN_STATUSES.has(reservation.status);
    if (!inHorizon && !isOverduePending) continue;
    // Futuros del horizonte: solo pendientes de ingreso.
    if (start > todayIso && !PRE_CHECKIN_STATUSES.has(reservation.status)) {
      continue;
    }
    if (seen.has(reservation.id)) continue;
    seen.add(reservation.id);

    const guestName = mainClientDisplayName(reservation);
    const room = movementRoomLabel(reservation, segments, start, 'in', roomsById);
    const pending = PRE_CHECKIN_STATUSES.has(reservation.status);
    items.push({
      reservationId: reservation.id,
      roomLabel: room,
      guestName,
      guests: guestCountForReservation(reservation),
      status: reservation.status,
      pending,
      plannedCheckIn: start,
      overdue: isOverduePending,
      daysOverdue: isOverduePending
        ? Math.max(1, daysBetweenIso(start, todayIso))
        : 0,
      notes: reservationNotes(reservation),
      serviceTypeLabel: serviceTypeDisplayName(
        reservation,
        segments,
        serviceTypesById
      ),
      label: movementListLabel(room, guestName)
    });
  }

  items.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    return String(a.plannedCheckIn).localeCompare(String(b.plannedCheckIn));
  });
  return items;
}

/** Llegadas aún no ingresadas (hoy o anteriores). */
export function pendingArrivalItems(todayIso, rooms = [], reservations = []) {
  return buildCheckInPanelItems(todayIso, rooms, reservations).filter((i) => i.pending);
}

function enrichMovementItemsWithStatus(items, reservations) {
  const byId = new Map((reservations || []).map((r) => [r.id, r]));
  return (items || []).map((item) => {
    const res = byId.get(item.reservationId);
    return {
      ...item,
      guestName: item.guestName || mainClientDisplayName(res),
      guests: guestCountForReservation(res),
      status: res?.status || null,
      pending: res
        ? !['INGRESADA', 'FINALIZADA', 'CANCELADA', 'NO_PRESENTADA'].includes(res.status)
        : false
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
 * @param {{ todayIso: string, mealsDateIso?: string, rooms: any[], reservations: any[], serviceTypes?: any[], horizonDays?: number }} args
 */
export function buildReceptionDashboardModel({
  todayIso,
  mealsDateIso,
  rooms = [],
  reservations = [],
  serviceTypes = [],
  horizonDays = 1
}) {
  const capacityRooms = physicalInServiceRooms(rooms);
  const oosRooms = (rooms || []).filter(isRoomOutOfService);
  const mealsIso = mealsDateIso || todayIso;
  const tomorrowIso = shiftIso(todayIso, 1);
  const panelOptions = { horizonDays, serviceTypes };

  const today = computeDayInfoStats(todayIso, capacityRooms, reservations, serviceTypes);
  const tomorrow = computeDayInfoStats(tomorrowIso, capacityRooms, reservations, serviceTypes);
  const meals = computeDayInfoStats(mealsIso, capacityRooms, reservations, serviceTypes);

  const checkInItems = buildCheckInPanelItems(
    todayIso,
    capacityRooms,
    reservations,
    panelOptions
  );
  const checkOutItems = pendingCheckoutItems(
    todayIso,
    capacityRooms,
    reservations,
    panelOptions
  );
  const lateItems = checkOutItems.filter((i) => i.late);
  const pendingArrivals = checkInItems.filter((i) => i.pending);
  const byType = occupancyByRoomType(todayIso, capacityRooms, reservations);

  // Notificaciones auto desactivadas (panel usa muestra estática).
  const notifications = [];

  return {
    todayIso,
    tomorrowIso,
    mealsIso,
    horizonDays: Math.max(1, Number(horizonDays) || 1),
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
