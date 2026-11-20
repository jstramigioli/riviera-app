import {
  benefitUnitLabel,
  buildBenefitApplyPayload,
  collectManualBenefitSuggestions,
  collectOptionalPromoChoices,
  formatOptionalBenefitValue,
  isRemovableOptionalPromo,
  mergeManualBenefitSuggestions
} from './promoManualBenefit';

describe('promoManualBenefit', () => {
  it('benefitUnitLabel por tipo', () => {
    expect(benefitUnitLabel('PERCENT')).toBe('%');
    expect(benefitUnitLabel('FREE_NIGHTS')).toBe('noches');
    expect(benefitUnitLabel('FIXED_PER_NIGHT')).toBe('ARS/noche');
    expect(benefitUnitLabel('FIXED')).toBe('ARS');
  });

  it('formatOptionalBenefitValue por tipo', () => {
    expect(formatOptionalBenefitValue({ benefitType: 'PERCENT', benefitValue: 10 })).toBe(
      '−10%'
    );
    expect(
      formatOptionalBenefitValue({ benefitType: 'FREE_NIGHTS', benefitValue: 1 })
    ).toBe('−1 noche');
    expect(
      formatOptionalBenefitValue({ benefitType: 'FREE_NIGHTS', benefitValue: 2 })
    ).toBe('−2 noches');
    expect(formatOptionalBenefitValue({ benefitType: 'FIXED', benefitValue: 5000 })).toBe(
      '−$5.000'
    );
    expect(
      formatOptionalBenefitValue({
        benefitType: 'PERCENT',
        benefitValueManual: true,
        benefitValue: null
      })
    ).toBeNull();
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
        benefitValue: null,
        modality: 'MANUAL',
        layer: null,
        defaultOn: false,
        benefitValueManual: true
      }
    ]);
  });

  it('collectOptionalPromoChoices excluye ya aplicadas y conserva valor', () => {
    const choices = collectOptionalPromoChoices(
      {
        suggestions: [
          {
            id: 9,
            label: '4x3',
            modality: 'SUGERIDA',
            defaultOn: true,
            benefitType: 'FREE_NIGHTS',
            benefitValue: 1
          },
          {
            id: 11,
            label: 'Extra',
            modality: 'MANUAL',
            defaultOn: false,
            benefitType: 'PERCENT',
            benefitValue: 10
          },
          { id: 1, label: 'Auto', modality: 'AUTO' }
        ]
      },
      [{ promotionRuleId: 9, label: '4x3' }]
    );
    expect(choices.map((c) => c.id)).toEqual([11]);
    expect(formatOptionalBenefitValue(choices[0])).toBe('−10%');
  });

  it('mergeManualBenefitSuggestions dedupe por id', () => {
    const merged = mergeManualBenefitSuggestions([
      [{ id: 1, label: 'A' }],
      [{ id: 1, label: 'A2' }, { id: 3, label: 'B' }]
    ]);
    expect(merged.map((s) => s.id)).toEqual([1, 3]);
    expect(merged[0].label).toBe('A');
  });

  it('buildBenefitApplyPayload une opcionales + valor al aplicar', () => {
    expect(
      buildBenefitApplyPayload({
        manualValues: {
          10: '15',
          11: '',
          12: '-1',
          13: 'abc',
          14: '0'
        },
        selectedOptionalIds: [11, 9],
        deselectedRuleIds: [9, 20]
      })
    ).toEqual({
      benefitValueByRuleId: { 10: 15, 14: 0 },
      selectedRuleIds: [11, 9, 10, 14],
      deselectedRuleIds: [20]
    });
  });

  it('isRemovableOptionalPromo', () => {
    expect(isRemovableOptionalPromo({ modality: 'SUGERIDA' })).toBe(true);
    expect(isRemovableOptionalPromo({ modality: 'MANUAL' })).toBe(true);
    expect(isRemovableOptionalPromo({ modality: 'AUTO' })).toBe(false);
  });
});
