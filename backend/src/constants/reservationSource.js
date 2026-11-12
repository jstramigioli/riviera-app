/** Medios / canales de origen de consultas y reservas. */
const RESERVATION_SOURCES = Object.freeze([
  'WHATSAPP',
  'MAIL',
  'WEBSITE',
  'BOOKING'
]);

const RESERVATION_SOURCE_LABELS = Object.freeze({
  WHATSAPP: 'WhatsApp',
  MAIL: 'Mail',
  WEBSITE: 'Sitio web',
  BOOKING: 'Booking'
});

const RESERVATION_SOURCE_OPTIONS = RESERVATION_SOURCES.map((value) => ({
  value,
  label: RESERVATION_SOURCE_LABELS[value]
}));

function normalizeReservationSource(value) {
  if (value == null || value === '') return null;
  const upper = String(value).trim().toUpperCase();
  return RESERVATION_SOURCES.includes(upper) ? upper : null;
}

module.exports = {
  RESERVATION_SOURCES,
  RESERVATION_SOURCE_LABELS,
  RESERVATION_SOURCE_OPTIONS,
  normalizeReservationSource
};
