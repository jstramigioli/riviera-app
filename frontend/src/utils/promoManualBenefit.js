/**
 * Helpers para promos con benefitValueManual (valor al aplicar).
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

/** Suggestions del preview que piden valor al aplicar. */
export function collectManualBenefitSuggestions(preview) {
  const list = Array.isArray(preview?.suggestions) ? preview.suggestions : [];
  const byId = new Map();
  for (const s of list) {
    if (!s || !s.benefitValueManual) continue;
    const id = s.id ?? s.promotionRuleId;
    if (id == null) continue;
    if (!byId.has(id)) {
      byId.set(id, {
        id: Number(id),
        code: s.code || null,
        label: s.label || s.code || `Promo #${id}`,
        benefitType: s.benefitType || 'PERCENT',
        modality: s.modality || 'MANUAL',
        layer: s.layer || null,
        defaultOn: Boolean(s.defaultOn)
      });
    }
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
 * De inputs { [ruleId]: string } → maps para API.
 * Solo incluye valores numéricos finitos ≥ 0.
 */
export function buildBenefitApplyPayload(manualValues = {}) {
  const benefitValueByRuleId = {};
  const selectedRuleIds = [];
  for (const [key, raw] of Object.entries(manualValues || {})) {
    if (raw === '' || raw == null) continue;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) continue;
    const id = parseInt(key, 10);
    if (!Number.isFinite(id)) continue;
    benefitValueByRuleId[id] = n;
    selectedRuleIds.push(id);
  }
  return { benefitValueByRuleId, selectedRuleIds };
}
