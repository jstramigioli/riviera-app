/**
 * Helpers para promos: valor al aplicar (benefitValueManual) y modalidad opcional.
 * Modalidad MANUAL/SUGERIDA = «opcional»; benefitValueManual es independiente.
 */

export function benefitUnitLabel(benefitType) {
  switch (String(benefitType || '').toUpperCase()) {
    case 'PERCENT':
      return '%';
    case 'FREE_NIGHTS':
      return 'noches';
    case 'FIXED_PER_NIGHT':
      return 'ARS/noche';
    case 'FIXED':
    default:
      return 'ARS';
  }
}

/**
 * Valor legible para el menú «+ promoción»: −10%, −1 noche, −5.000 ARS.
 * Sin valor fijo (manual / vacío) → null.
 */
export function formatOptionalBenefitValue(choice) {
  if (!choice) return null;
  if (choice.benefitValueManual && (choice.benefitValue == null || choice.benefitValue === '')) {
    return null;
  }
  const raw = choice.benefitValue;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  const type = String(choice.benefitType || 'PERCENT').toUpperCase();
  if (type === 'PERCENT') return `−${n}%`;
  if (type === 'FREE_NIGHTS') {
    const nights = Math.max(0, Math.floor(n));
    return nights === 1 ? '−1 noche' : `−${nights} noches`;
  }
  const money = new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: n % 1 === 0 ? 0 : 2
  }).format(n);
  if (type === 'FIXED_PER_NIGHT') return `−${money} ARS/noche`;
  return `−${money} ARS`;
}

function normalizeSuggestion(s) {
  if (!s) return null;
  const id = s.id ?? s.promotionRuleId;
  if (id == null) return null;
  const modality = String(s.modality || 'MANUAL').toUpperCase();
  const benefitValue =
    s.benefitValue != null && s.benefitValue !== '' && Number.isFinite(Number(s.benefitValue))
      ? Number(s.benefitValue)
      : null;
  return {
    id: Number(id),
    code: s.code || null,
    label: s.label || s.code || `Promo #${id}`,
    benefitType: s.benefitType || 'PERCENT',
    benefitValue,
    modality,
    layer: s.layer || null,
    defaultOn: s.defaultOn != null ? Boolean(s.defaultOn) : modality === 'SUGERIDA',
    benefitValueManual: Boolean(s.benefitValueManual)
  };
}

/** Suggestions del preview que piden valor al aplicar. */
export function collectManualBenefitSuggestions(preview) {
  const list = Array.isArray(preview?.suggestions) ? preview.suggestions : [];
  const byId = new Map();
  for (const s of list) {
    if (!s || !s.benefitValueManual) continue;
    const normalized = normalizeSuggestion(s);
    if (!normalized) continue;
    if (!byId.has(normalized.id)) byId.set(normalized.id, normalized);
  }
  return Array.from(byId.values());
}

/**
 * Opcionales disponibles para el desplegable «+ promoción»
 * (en suggestions y aún no aplicadas).
 */
export function collectOptionalPromoChoices(preview, appliedPromos = []) {
  const appliedIds = new Set(
    (appliedPromos || [])
      .map((p) => p?.promotionRuleId ?? p?.id)
      .filter((id) => id != null)
      .map(Number)
  );
  const list = Array.isArray(preview?.suggestions) ? preview.suggestions : [];
  const byId = new Map();
  for (const s of list) {
    const normalized = normalizeSuggestion(s);
    if (!normalized) continue;
    // Solo opcionales (MANUAL / SUGERIDA). AUTO siempre aplica; no se elige desde el menú.
    if (normalized.modality !== 'MANUAL' && normalized.modality !== 'SUGERIDA') {
      continue;
    }
    if (appliedIds.has(normalized.id)) continue;
    if (!byId.has(normalized.id)) byId.set(normalized.id, normalized);
  }
  return Array.from(byId.values());
}

/** Merge suggestions de varios previews (p.ej. segmentos). */
export function mergeManualBenefitSuggestions(lists = []) {
  const byId = new Map();
  for (const list of lists) {
    for (const s of list || []) {
      if (!s || s.id == null) continue;
      if (!byId.has(s.id)) byId.set(s.id, s);
    }
  }
  return Array.from(byId.values());
}

/**
 * De inputs { [ruleId]: string } + selección opcional → maps para API.
 * El valor al aplicar NO implica selección: opcionales default-off (MANUAL)
 * solo entran vía selectedOptionalIds (+ descuento / + promoción).
 */
export function buildBenefitApplyPayload({
  manualValues = {},
  selectedOptionalIds = [],
  deselectedRuleIds = []
} = {}) {
  const benefitValueByRuleId = {};
  for (const [key, raw] of Object.entries(manualValues || {})) {
    if (raw === '' || raw == null) continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) continue;
    const id = parseInt(key, 10);
    if (!Number.isFinite(id)) continue;
    benefitValueByRuleId[id] = n;
  }
  const selectedRuleIds = Array.from(
    new Set(
      (selectedOptionalIds || [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id))
    )
  );
  const deselected = Array.from(
    new Set(
      (deselectedRuleIds || [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id) && !selectedRuleIds.includes(id))
    )
  );
  return { benefitValueByRuleId, selectedRuleIds, deselectedRuleIds: deselected };
}

/**
 * «Valor al aplicar» solo para reglas que ya están en juego:
 * SUGERIDA/default-on (no deseleccionadas) o MANUAL ya elegidas con +.
 */
export function filterManualBenefitSuggestionsForUi(
  suggestions = [],
  { selectedOptionalIds = [], deselectedRuleIds = [] } = {}
) {
  const selected = new Set(
    (selectedOptionalIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id))
  );
  const deselected = new Set(
    (deselectedRuleIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id))
  );
  return (suggestions || []).filter((s) => {
    if (!s || s.id == null) return false;
    const id = Number(s.id);
    if (!Number.isFinite(id)) return false;
    if (deselected.has(id)) return false;
    const modality = String(s.modality || '').toUpperCase();
    const defaultOn =
      s.defaultOn != null ? Boolean(s.defaultOn) : modality === 'SUGERIDA';
    if (defaultOn || modality === 'SUGERIDA') return true;
    return selected.has(id);
  });
}

/** Promo aplicada removible: solo opcionales (MANUAL / SUGERIDA). AUTO siempre queda. */
export function isRemovableOptionalPromo(promo) {
  if (!promo) return false;
  const modality = String(promo.modality || '').toUpperCase();
  return modality === 'MANUAL' || modality === 'SUGERIDA';
}
