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

/**
 * Texto legible sobre un color de fondo (#RRGGBB).
 * Usa luminancia relativa sRGB (WCAG): fondos oscuros → blanco.
 */
export function contrastTextColor(backgroundHex, {
  light = '#ffffff',
  dark = '#1a1a1a'
} = {}) {
  if (typeof backgroundHex !== 'string') return dark;
  const hex = backgroundHex.trim().replace(/^#/, '');
  const full =
    hex.length === 3
      ? hex.split('').map((c) => c + c).join('')
      : hex;
  if (!/^[0-9A-Fa-f]{6}$/.test(full)) return dark;

  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance =
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

  return luminance < 0.45 ? light : dark;
}
