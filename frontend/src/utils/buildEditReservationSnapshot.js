import { selectedRoomFromCollapsedSegment } from './virtualRoomReservation';
import { civilNights, resolveReservationTotal } from './reservationStayTimeline';
import { buildDraftReservationForTimeline } from './reservationConfirmationQuote';

const dateKey = (value) => String(value || '').slice(0, 10);

/** Lista YYYY-MM-DD de noches [checkIn, checkOut). */
export function enumerateStayNights(checkIn, checkOut) {
  const start = dateKey(checkIn);
  const end = dateKey(checkOut);
  const n = civilNights(start, end);
  if (!start || n <= 0) return [];
  const [y, m, d] = start.split('-').map(Number);
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    out.push(dt.toISOString().slice(0, 10));
  }
  return out;
}

function money(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function nightRateDateKey(nr) {
  return dateKey(nr?.dateString || nr?.date);
}

/**
 * ratesData fijado a partir de nightRates persistidos (o baseRate × noches).
 */
export function lockedRatesDataForSegment(seg, nightRates = []) {
  const checkIn = dateKey(seg?.startDate || seg?.checkIn);
  const checkOut = dateKey(seg?.endDate || seg?.checkOut);
  const nights = enumerateStayNights(checkIn, checkOut);
  const base = money(seg?.baseRate);
  const byDate = new Map();
  for (const nr of nightRates || []) {
    const key = nightRateDateKey(nr);
    if (!key) continue;
    byDate.set(key, nr);
  }

  const rates = nights.map((dateString) => {
    const nr = byDate.get(dateString);
    const amount = nr
      ? money(nr.serviceRate ?? nr.finalRate ?? nr.dynamicRate ?? nr.baseRate ?? base)
      : base;
    return {
      date: dateString,
      dateString,
      baseRate: nr ? money(nr.baseRate ?? amount) : base,
      serviceRate: amount,
      finalRate: amount,
      seasonBlockId: nr?.seasonBlockId || null,
      seasonBlockName: nr?.seasonBlockName || null,
      manualOverride: Boolean(nr?.manualOverride)
    };
  });

  const totalAmount = money(rates.reduce((sum, r) => sum + money(r.finalRate), 0));
  return {
    totalAmount,
    averageRatePerNight: nights.length > 0 ? money(totalAmount / nights.length) : base,
    rates,
    locked: true
  };
}

/**
 * Snapshot inmutable de la reserva al abrir edición (columna «Actual»).
 */
export function buildEditReservationSnapshot({
  full,
  collapsed,
  loadedSegments,
  nightRates = []
}) {
  const roomsByBlock = {};
  collapsed.forEach((seg, index) => {
    const room = selectedRoomFromCollapsedSegment(seg);
    if (!room) {
      roomsByBlock[index] = null;
      return;
    }
    const ratesData = lockedRatesDataForSegment(seg, nightRates);
    roomsByBlock[index] = {
      ...room,
      price: ratesData.averageRatePerNight || Number(seg.baseRate) || 0,
      ratesData
    };
  });

  const segments =
    Array.isArray(loadedSegments) && loadedSegments.length > 0
      ? loadedSegments.map((s) => ({ ...s }))
      : [];

  const totalAmount =
    resolveReservationTotal({
      ...full,
      totalAmount:
        Object.values(roomsByBlock).reduce(
          (sum, room) => sum + money(room?.ratesData?.totalAmount),
          0
        ) || full?.totalAmount
    }) || money(full?.totalAmount);

  const timelineReservation = buildDraftReservationForTimeline({
    mainClient: full?.mainClient || null,
    segments,
    selectedRoomsPerBlock: roomsByBlock,
    totalAmount
  });

  return {
    segments,
    selectedRoomsPerBlock: roomsByBlock,
    timelineReservation,
    totalAmount,
    notes: full?.notes || '',
    source: full?.source || '',
    status: full?.status || 'PENDIENTE'
  };
}
