const {
  methodRequiresBilling,
  isCardMethod,
  INVOICE_TYPES,
  DEFAULT_IVA_CONDITION,
  normalizePagoMotivo,
  DEFAULT_PAGO_MOTIVO
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

  test('normalizePagoMotivo solo Pago|Seña|Devolución', () => {
    expect(normalizePagoMotivo(undefined)).toBe(DEFAULT_PAGO_MOTIVO);
    expect(normalizePagoMotivo('')).toBe(DEFAULT_PAGO_MOTIVO);
    expect(normalizePagoMotivo('Pago')).toBe('Pago');
    expect(normalizePagoMotivo('Seña')).toBe('Seña');
    expect(normalizePagoMotivo('Sena')).toBe('Seña');
    expect(normalizePagoMotivo('Devolución')).toBe('Devolución');
    expect(normalizePagoMotivo('devolucion')).toBe('Devolución');
    expect(normalizePagoMotivo('otro')).toBeNull();
  });
});
