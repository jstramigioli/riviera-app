/** Medios / canales de origen de consultas y reservas. */
export const RESERVATION_SOURCES = Object.freeze([
  'WHATSAPP',
  'MAIL',
  'WEBSITE',
  'BOOKING'
]);

export const RESERVATION_SOURCE_LABELS = Object.freeze({
  WHATSAPP: 'WhatsApp',
  MAIL: 'Mail',
  WEBSITE: 'Sitio web',
  BOOKING: 'Booking'
});

export const RESERVATION_SOURCE_OPTIONS = RESERVATION_SOURCES.map((value) => ({
  value,
  label: RESERVATION_SOURCE_LABELS[value]
}));

/** Colores por defecto del Libro (editables en el filtro). */
export const DEFAULT_SOURCE_COLORS = Object.freeze({
  WHATSAPP: '#25D366',
  MAIL: '#EA4335',
  WEBSITE: '#4285F4',
  BOOKING: '#003580'
});

const STORAGE_KEY = 'libro.sourceColors.v1';

export function loadSourceColors() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SOURCE_COLORS };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SOURCE_COLORS,
      ...Object.fromEntries(
        RESERVATION_SOURCES.map((key) => [
          key,
          typeof parsed?.[key] === 'string' && /^#[0-9A-Fa-f]{6}$/.test(parsed[key])
            ? parsed[key]
            : DEFAULT_SOURCE_COLORS[key]
        ])
      )
    };
  } catch {
    return { ...DEFAULT_SOURCE_COLORS };
  }
}

export function saveSourceColors(colors) {
  const next = {
    ...DEFAULT_SOURCE_COLORS,
    ...Object.fromEntries(
      RESERVATION_SOURCES.map((key) => [
        key,
        typeof colors?.[key] === 'string' && /^#[0-9A-Fa-f]{6}$/.test(colors[key])
          ? colors[key]
          : DEFAULT_SOURCE_COLORS[key]
      ])
    )
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function sourceLabel(value) {
  if (!value) return 'No especificado';
  return RESERVATION_SOURCE_LABELS[value] || value;
}
