import { buildReservationStayTimeline, civilNights } from './reservationStayTimeline';
import { getDisplaySegments } from './virtualRoomReservation';

const dateKey = (value) => {
  if (!value) return '';
  return String(value).slice(0, 10);
};

/** Fecha civil YYYY-MM-DD → dd/MM/yyyy (sin timezone). */
export const formatClientDate = (value) => {
  const key = dateKey(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return 'No especificada';
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
};

const formatMoney = (amount) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
  }).format(Number(amount) || 0);

const roomLine = (card) => {
  if (!card) return '—';
  if (card.roomType && card.roomType !== '—') {
    return `${card.room} - ${card.roomType}`;
  }
  return card.room || '—';
};

/**
 * Resumen estructurado para el huésped (WhatsApp / mail).
 * Incluye: huésped, fechas, noches, huéspedes, habitación, servicio, total.
 * NO incluye: notas internas, medio/origen, ni metadatos internos.
 */
export function formatReservationClientSummary(reservation, options = {}) {
  if (!reservation) return '';

  const { getServiceTypeLabel } = options;
  const timeline = buildReservationStayTimeline(reservation, { getServiceTypeLabel });
  const { header } = timeline;
  const displaySegments = getDisplaySegments(reservation.segments || []);

  const checkIn =
    reservation.checkIn ||
    displaySegments[0]?.startDate ||
    displaySegments[0]?.checkIn ||
    null;
  const checkOut =
    reservation.checkOut ||
    displaySegments[displaySegments.length - 1]?.endDate ||
    displaySegments[displaySegments.length - 1]?.checkOut ||
    null;

  const nights =
    header.totalNights ||
    civilNights(checkIn, checkOut) ||
    0;
  const guests =
    Number(reservation.requiredGuests) > 0
      ? Number(reservation.requiredGuests)
      : Number(displaySegments[0]?.guestCount) > 0
        ? Number(displaySegments[0].guestCount)
        : 1;

  const segmentCards = timeline.items
    .filter((item) => item.type === 'edge' && item.card)
    .map((item) => item.card);

  const lines = [];
  lines.push('RESERVA');
  if (reservation.id != null) {
    lines.push(`Nº ${reservation.id}`);
  }
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  lines.push('HUÉSPED');
  lines.push(header.clientName || '—');
  lines.push('');

  lines.push('ESTANCIA');
  lines.push(`Check-in: ${formatClientDate(checkIn)}`);
  lines.push(`Check-out: ${formatClientDate(checkOut)}`);
  lines.push(`Noches: ${nights || '—'}`);
  lines.push(`Huéspedes: ${guests}`);
  lines.push('');

  if (segmentCards.length <= 1) {
    const card = segmentCards[0] || null;
    lines.push('HABITACIÓN');
    lines.push(roomLine(card));
    lines.push(`Servicio: ${card?.service || '—'}`);
  } else {
    lines.push('TRAMOS');
    lines.push('');
    displaySegments.forEach((seg, index) => {
      const card = segmentCards[index];
      const start = seg.startDate || seg.checkIn;
      const end = seg.endDate || seg.checkOut;
      lines.push(`${index + 1}. ${formatClientDate(start)} → ${formatClientDate(end)}`);
      lines.push(`   Habitación: ${roomLine(card)}`);
      lines.push(`   Servicio: ${card?.service || '—'}`);
      const segNights = card?.nights || civilNights(start, end);
      if (segNights) lines.push(`   Noches: ${segNights}`);
      lines.push('');
    });
  }

  if (header.totalAmount > 0) {
    if (segmentCards.length <= 1) lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push(`TOTAL: ${formatMoney(header.totalAmount)}`);
  }

  return lines.join('\n').trim() + '\n';
}

export async function copyReservationClientSummary(reservation, options = {}) {
  const text = formatReservationClientSummary(reservation, options);
  if (!text) {
    throw new Error('No hay datos de reserva para copiar');
  }
  if (!navigator?.clipboard?.writeText) {
    throw new Error('Portapapeles no disponible');
  }
  await navigator.clipboard.writeText(text);
  return text;
}
