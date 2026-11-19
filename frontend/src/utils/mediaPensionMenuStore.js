import { getConfiguracion, upsertConfiguracion } from '../services/api';

/** Clave en Configuracion (tabla existente; sin migración). Distinto del menú minutas/snacks. */
export const MEDIA_PENSION_MENU_CLAVE = 'menu_media_pension_diario';

const LOCAL_STORAGE_KEY = 'riviera.mediaPensionMenu.byDate';

function parseMap(raw) {
  if (!raw) return {};
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof v === 'string') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function readLocalMap() {
  if (typeof localStorage === 'undefined' || localStorage == null) return {};
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw == null || raw === '') return {};
    return parseMap(raw);
  } catch {
    return {};
  }
}

function writeLocalMap(map) {
  if (typeof localStorage === 'undefined' || localStorage == null) return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Carga el texto del menú diario de media pensión para una fecha civil YYYY-MM-DD.
 * Preferencia: Configuracion API; fallback localStorage.
 */
export async function loadMediaPensionMenu(dateIso) {
  const day = String(dateIso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '';

  const localMap = readLocalMap();
  let remoteMap = {};

  try {
    const row = await getConfiguracion(MEDIA_PENSION_MENU_CLAVE);
    remoteMap = parseMap(row?.valor);
  } catch {
    remoteMap = {};
  }

  const merged = { ...localMap, ...remoteMap };
  if (Object.keys(remoteMap).length) writeLocalMap(merged);
  return merged[day] || '';
}

/**
 * Guarda el texto del menú para la fecha. Escribe localStorage siempre;
 * intenta upsert en Configuracion (sin schema nuevo).
 * @returns {{ ok: boolean, source: 'config'|'local', error?: string }}
 */
export async function saveMediaPensionMenu(dateIso, text) {
  const day = String(dateIso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return { ok: false, source: 'local', error: 'Fecha inválida' };
  }

  const value = String(text ?? '');
  const localMap = readLocalMap();
  let remoteMap = {};
  try {
    const row = await getConfiguracion(MEDIA_PENSION_MENU_CLAVE);
    remoteMap = parseMap(row?.valor);
  } catch {
    remoteMap = {};
  }

  const next = { ...localMap, ...remoteMap, [day]: value };
  writeLocalMap(next);

  try {
    await upsertConfiguracion({
      clave: MEDIA_PENSION_MENU_CLAVE,
      valor: JSON.stringify(next),
      descripcion:
        'Menú diario de media pensión (texto por fecha). Distinto del menú de minutas/snacks.'
    });
    return { ok: true, source: 'config' };
  } catch (err) {
    return {
      ok: true,
      source: 'local',
      error: err?.message || 'Guardado solo en este navegador'
    };
  }
}
