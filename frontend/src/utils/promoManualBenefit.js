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
 * Valor legible para el menú «+ promoción»: −10%, −1 noche, −$1.200.
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
  if (type === 'FIXED_PER_NIGHT') return `−$${money}/noche`;
  return `−$${money}`;
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
    if (normalized.modality !== 'MANUAL' && normalized.modality !== 'SUGERIDA') continue;
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
 */
export function buildBenefitApplyPayload({
  manualValues = {},
  selectedOptionalIds = [],
  deselectedRuleIds = []
} = {}) {
  const benefitValueByRuleId = {};
  const fromValues = [];
  for (const [key, raw] of Object.entries(manualValues || {})) {
    if (raw === '' || raw == null) continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) continue;
    const id = parseInt(key, 10);
    if (!Number.isFinite(id)) continue;
    benefitValueByRuleId[id] = n;
    fromValues.push(id);
  }
  const selectedRuleIds = Array.from(
    new Set(
      []
        .concat(selectedOptionalIds || [])
        .concat(fromValues)
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

/** Promo aplicada removible (modalidad opcional). */
export function isRemovableOptionalPromo(promo) {
  if (!promo) return false;
  const modality = String(promo.modality || '').toUpperCase();
  return modality === 'MANUAL' || modality === 'SUGERIDA';
}
