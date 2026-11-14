import {
  benefitUnitLabel,
  buildBenefitApplyPayload,
  collectManualBenefitSuggestions,
  mergeManualBenefitSuggestions
} from './promoManualBenefit';

describe('promoManualBenefit', () => {
  it('benefitUnitLabel por tipo', () => {
    expect(benefitUnitLabel('PERCENT')).toBe('%');
    expect(benefitUnitLabel('FREE_NIGHTS')).toBe('noches');
    expect(benefitUnitLabel('FIXED_PER_NIGHT')).toBe('ARS/noche');
    expect(benefitUnitLabel('FIXED')).toBe('ARS');
  });

  it('collectManualBenefitSuggestions solo benefitValueManual', () => {
    const list = collectManualBenefitSuggestions({
      suggestions: [
        { id: 1, label: 'Fija', benefitValueManual: false },
        { id: 2, label: 'Cortesía', benefitType: 'PERCENT', benefitValueManual: true },
        { id: 2, label: 'dup', benefitValueManual: true }
      ]
    });
    expect(list).toEqual([
      {
        id: 2,
        code: null,
        label: 'Cortesía',
        benefitType: 'PERCENT',
        modality: 'MANUAL',
        layer: null,
        defaultOn: false
      }
    ]);
  });

  it('mergeManualBenefitSuggestions dedupe por id', () => {
    const merged = mergeManualBenefitSuggestions([
      [{ id: 1, label: 'A' }],
      [{ id: 1, label: 'A2' }, { id: 3, label: 'B' }]
    ]);
    expect(merged.map((s) => s.id)).toEqual([1, 3]);
    expect(merged[0].label).toBe('A');
  });

  it('buildBenefitApplyPayload ignora vacíos e inválidos', () => {
    expect(
      buildBenefitApplyPayload({
        10: '15',
        11: '',
        12: '-1',
        13: 'abc',
        14: '0'
      })
    ).toEqual({
      benefitValueByRuleId: { 10: 15, 14: 0 },
      selectedRuleIds: [10, 14]
    });
  });
});
