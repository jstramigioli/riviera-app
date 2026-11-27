/** Secciones del menú diario para mostrarlo completo (tarjetas de la semana y dashboard). */
export const MESA_ENSALADAS = 'mesa de ensaladas';

const SECTION_LABELS = {
  ENTRADA: 'Entrada',
  ENSALADA: 'Ensaladas',
  SOPA: 'Sopa',
  PRIMER_PLATO: 'Primer plato',
  SEGUNDO_PLATO: 'Segundo plato',
  PLATO_INFANTIL: 'Plato infantil',
  POSTRE: 'Postres',
  BUFFET: 'Buffet'
};

const CONVENTIONAL_ORDER = [
  'ENTRADA',
  'ENSALADA',
  'SOPA',
  'PRIMER_PLATO',
  'SEGUNDO_PLATO',
  'PLATO_INFANTIL',
  'POSTRE'
];

/**
 * Secciones con título + todos los ítems. ENSALADA: solo el título «mesa de ensaladas».
 * @returns {Array<{ key: string, title: string|null, items: string[], titleOnly?: boolean }>}
 */
export function buildMenuPreviewSections(menu) {
  if (!menu) return [];
  const bySection = new Map();
  for (const item of menu.items || []) {
    const key = item.section || 'BUFFET';
    if (!bySection.has(key)) bySection.set(key, []);
    bySection.get(key).push(item);
  }
  for (const list of bySection.values()) {
    list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  if (menu.kind === 'BUFFET') {
    const names = (bySection.get('BUFFET') || []).map((it) => it.nameSnapshot).filter(Boolean);
    return names.length ? [{ key: 'BUFFET', title: null, items: names }] : [];
  }

  const sections = [];
  for (const section of CONVENTIONAL_ORDER) {
    if (section === 'ENSALADA') {
      sections.push({ key: section, title: MESA_ENSALADAS, items: [], titleOnly: true });
      continue;
    }
    const names = (bySection.get(section) || []).map((it) => it.nameSnapshot).filter(Boolean);
    if (!names.length) continue;
    sections.push({ key: section, title: SECTION_LABELS[section] || section, items: names, titleOnly: false });
  }
  return sections;
}
