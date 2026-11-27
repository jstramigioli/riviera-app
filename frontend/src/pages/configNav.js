/** Navegación de Configuración: secciones/subsecciones y permisos por rol. */

export const CARGOS_SUBTABS = [
  { id: 'alojamiento', label: 'Alojamiento', keywords: ['tarifas', 'bloques', 'precios'] },
  { id: 'servicios', label: 'Servicios', keywords: ['servicio'] },
  { id: 'consumos', label: 'Consumos', keywords: ['consumo', 'comanda'] },
  { id: 'otros', label: 'Otros', keywords: ['otro'] }
];

/**
 * Árbol de nav. `permission` se evalúa con `can(permission)`.
 * Subsecciones navegables llevan `subId` (p.ej. subtab de Cargos y Tarifas).
 */
export const CONFIG_NAV = [
  {
    id: 'hotel',
    label: 'Hotel',
    permission: 'settings',
    keywords: ['datos', 'establecimiento']
  },
  {
    id: 'habitaciones',
    label: 'Habitaciones',
    permission: 'settings',
    keywords: ['rooms', 'tipos', 'etiquetas', 'virtuales'],
    children: [
      { id: 'habitaciones-listado', label: 'Listado', keywords: ['lista', 'cuartos'] },
      { id: 'habitaciones-tipos', label: 'Tipos', keywords: ['tipo', 'capacidad'] },
      { id: 'habitaciones-etiquetas', label: 'Etiquetas', keywords: ['tags', 'tag'] },
      { id: 'habitaciones-virtuales', label: 'Virtuales', keywords: ['virtual', 'combinada'] }
    ]
  },
  {
    id: 'cargos-tarifas',
    label: 'Cargos y Tarifas',
    permission: 'settings',
    keywords: ['cargo', 'tarifa', 'precio'],
    children: CARGOS_SUBTABS.map((sub) => ({
      id: `cargos-${sub.id}`,
      label: sub.label,
      subId: sub.id,
      keywords: sub.keywords
    }))
  },
  {
    id: 'menu-consumos',
    label: 'Menú',
    permission: 'settings',
    keywords: ['consumos', 'comanda', 'bebidas', 'minutas', 'cafeteria', 'cafetería'],
    children: [
      { id: 'menu-bebidas', label: 'Bebidas', keywords: ['bebida', 'bar'] },
      { id: 'menu-minutas', label: 'Minutas', keywords: ['minuta', 'comida'] },
      { id: 'menu-cafeteria', label: 'Cafetería', keywords: ['cafe', 'café', 'cafeteria'] }
    ]
  },
  {
    id: 'cenas',
    label: 'Cenas',
    permission: 'settings',
    keywords: ['cena', 'buffet', 'navidad', 'año nuevo', 'externo', 'alojado', 'gastronomia']
  },
  {
    id: 'platos',
    label: 'Catálogo de platos',
    permission: 'settings',
    keywords: ['plato', 'platos', 'menu diario', 'menú diario', 'comedor', 'catalogo']
  },
  {
    id: 'calendario',
    label: 'Calendario',
    permission: 'settings',
    keywords: ['feriados', 'temporada']
  },
  {
    id: 'tipo-cambio',
    label: 'Tipo de Cambio',
    permission: 'settings',
    keywords: ['dolar', 'dólar', 'usd', 'cambio']
  },
  {
    id: 'usuarios',
    label: 'Usuarios',
    permission: 'users',
    keywords: ['roles', 'permisos', 'cuenta']
  },
  {
    id: 'sistema',
    label: 'Sistema',
    permission: 'settings',
    keywords: ['general']
  },
  {
    id: 'medios-pago',
    label: 'Medios de pago',
    permission: 'mediosPago',
    keywords: ['pago', 'efectivo', 'tarjeta', 'transferencia']
  },
  {
    id: 'promociones',
    label: 'Promociones y descuentos',
    permission: 'promociones',
    keywords: ['promo', 'descuento', 'oferta'],
    children: [
      { id: 'promo-promociones', label: 'Promociones', keywords: ['promo', 'oferta'] },
      { id: 'promo-descuentos', label: 'Descuentos', keywords: ['descuento', 'dto'] }
    ]
  },
  {
    id: 'auditoria',
    label: 'Auditoría',
    permission: 'auditoria',
    keywords: ['log', 'historial', 'cambios']
  }
];

export function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function textMatches(haystack, needle) {
  if (!needle) return true;
  return normalizeSearch(haystack).includes(needle);
}

function itemMatches(item, needle) {
  if (!needle) return true;
  if (textMatches(item.label, needle)) return true;
  const keywords = Array.isArray(item.keywords) ? item.keywords : [];
  return keywords.some((kw) => textMatches(kw, needle));
}

/** Secciones habilitadas para el rol (`can` del AuthContext). */
export function getEnabledConfigNav(can) {
  return CONFIG_NAV.filter((section) => can(section.permission));
}

/**
 * Filtra secciones/subsecciones por texto.
 * Sin query: secciones planas (sin children en el resultado).
 * Con query: incluye hijos que matchean; si solo matchea un hijo, deja la sección con esos hijos.
 */
export function filterConfigNav(sections, query) {
  const needle = normalizeSearch(query);
  if (!needle) {
    return sections.map((section) => ({ ...section, children: undefined }));
  }

  const next = [];
  for (const section of sections) {
    const sectionHit = itemMatches(section, needle);
    const children = Array.isArray(section.children) ? section.children : [];
    const childHits = children.filter((child) => itemMatches(child, needle));

    if (!sectionHit && childHits.length === 0) continue;

    let visibleChildren;
    if (!children.length) {
      visibleChildren = undefined;
    } else if (childHits.length > 0) {
      visibleChildren = childHits;
    } else {
      // La sección matcheó: mostrar subsecciones para navegar desde el buscador
      visibleChildren = children;
    }

    next.push({ ...section, children: visibleChildren });
  }
  return next;
}
