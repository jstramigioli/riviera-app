const {
  methodRequiresBilling,
  isCardMethod,
  INVOICE_TYPES,
  DEFAULT_IVA_CONDITION,
  normalizeCobroMotivo,
  DEFAULT_COBRO_MOTIVO
} = require('../../src/utils/billingConstants');

describe('billingConstants', () => {
  test('métodos con facturación fija', () => {
    expect(methodRequiresBilling('Transferencia')).toBe(true);
    expect(methodRequiresBilling('Tarjeta Credito')).toBe(true);
    expect(methodRequiresBilling('Tarjeta Debito')).toBe(true);
    expect(methodRequiresBilling('Efectivo')).toBe(false);
  });

  test('tarjeta vs no tarjeta', () => {
    expect(isCardMethod('Tarjeta Credito')).toBe(true);
    expect(isCardMethod('Transferencia')).toBe(false);
  });

  test('tipos de factura y IVA default', () => {
    expect(INVOICE_TYPES).toEqual(['A', 'B']);
    expect(DEFAULT_IVA_CONDITION).toBe('Responsable Inscripto');
  });

  test('normalizeCobroMotivo solo Cobro|Seña|Devolución', () => {
    expect(normalizeCobroMotivo(undefined)).toBe(DEFAULT_COBRO_MOTIVO);
    expect(normalizeCobroMotivo('')).toBe(DEFAULT_COBRO_MOTIVO);
    expect(normalizeCobroMotivo('Cobro')).toBe('Cobro');
    expect(normalizeCobroMotivo('Seña')).toBe('Seña');
    expect(normalizeCobroMotivo('Sena')).toBe('Seña');
    expect(normalizeCobroMotivo('Devolución')).toBe('Devolución');
    expect(normalizeCobroMotivo('devolucion')).toBe('Devolución');
    expect(normalizeCobroMotivo('otro')).toBeNull();
  });
});
