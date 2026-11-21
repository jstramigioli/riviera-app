const {
  isEfectivo,
  amountToArs,
  maxVueltoARS,
  suggestVueltoARS,
  resolveCashTender,
  readCashTenderFields
} = require('../../src/utils/cashTender');

describe('cashTender — casos A–H', () => {
  test('isEfectivo solo para efectivo', () => {
    expect(isEfectivo('Efectivo')).toBe(true);
    expect(isEfectivo('efectivo')).toBe(true);
    expect(isEfectivo('Transferencia')).toBe(false);
    expect(isEfectivo('Tarjeta Debito')).toBe(false);
  });

  test('A — ARS sin vuelto: acreditación = ingresado', () => {
    const r = resolveCashTender({
      metodo: 'Efectivo',
      monto: 100000,
      moneda: 'ARS',
      dineroRecibido: 100000,
      vueltoARS: 0
    });
    expect(r.ok).toBe(true);
    expect(r.dineroRecibido).toBe(100000);
    expect(r.vueltoARS).toBe(0);
    expect(r.montoAbs).toBe(100000);
    expect(r.montoARSAbs).toBe(100000);
    expect(r.cajaIngreso).toEqual({ moneda: 'ARS', monto: 100000 });
    expect(r.cajaVueltoARS).toBe(0);
    expect(r.excedenteACredito).toBe(false);
  });

  test('B — ARS con vuelto sugerido: acreditación = ingresado', () => {
    expect(
      suggestVueltoARS({
        dineroRecibido: 120000,
        moneda: 'ARS',
        montoIngresadoARS: 100000
      })
    ).toBe(20000);

    const r = resolveCashTender({
      metodo: 'Efectivo',
      monto: 100000,
      moneda: 'ARS',
      dineroRecibido: 120000,
      vueltoARS: 20000
    });
    expect(r.ok).toBe(true);
    expect(r.dineroRecibido).toBe(120000);
    expect(r.vueltoARS).toBe(20000);
    expect(r.montoAbs).toBe(100000);
    expect(r.montoARSAbs).toBe(100000);
    expect(r.cajaIngreso).toEqual({ moneda: 'ARS', monto: 120000 });
    expect(r.cajaVueltoARS).toBe(20000);
  });

  test('C — ARS excedente a crédito (vuelto 0)', () => {
    const r = resolveCashTender({
      metodo: 'Efectivo',
      monto: 100000,
      moneda: 'ARS',
      dineroRecibido: 120000,
      vueltoARS: 0
    });
    expect(r.ok).toBe(true);
    expect(r.excedenteACredito).toBe(true);
    expect(r.montoAbs).toBe(120000);
    expect(r.montoARSAbs).toBe(120000);
    expect(r.vueltoARS).toBe(0);
    expect(r.cajaIngreso.monto).toBe(120000);
    expect(r.cajaVueltoARS).toBe(0);
  });

  test('D — USD con vuelto ARS; caja +USD / −ARS; acreditación ingresado', () => {
    const montoUsd = 100000 / 1200; // ~83.333…; ARS se redondea al producto
    expect(amountToArs(100, 'USD', 1200)).toBe(120000);
    expect(amountToArs(montoUsd, 'USD', 1200)).toBe(100000);
    expect(
      suggestVueltoARS({
        dineroRecibido: 100,
        moneda: 'USD',
        tipoCambio: 1200,
        montoIngresadoARS: 100000
      })
    ).toBe(20000);

    const r = resolveCashTender({
      metodo: 'Efectivo',
      monto: montoUsd,
      moneda: 'USD',
      tipoCambio: 1200,
      dineroRecibido: 100,
      vueltoARS: 20000
    });
    expect(r.ok).toBe(true);
    expect(r.dineroRecibido).toBe(100);
    expect(r.vueltoARS).toBe(20000);
    expect(r.montoARSAbs).toBe(100000);
    expect(r.cajaIngreso).toEqual({ moneda: 'USD', monto: 100 });
    expect(r.cajaVueltoARS).toBe(20000);
    expect(r.excedenteACredito).toBe(false);
  });

  test('E — USD sin vuelto: excedente a crédito', () => {
    const r = resolveCashTender({
      metodo: 'Efectivo',
      monto: 100000 / 1200,
      moneda: 'USD',
      tipoCambio: 1200,
      dineroRecibido: 100,
      vueltoARS: 0
    });
    expect(r.ok).toBe(true);
    expect(r.excedenteACredito).toBe(true);
    expect(r.montoAbs).toBe(100);
    expect(r.montoARSAbs).toBe(120000);
    expect(r.vueltoARS).toBe(0);
    expect(r.cajaIngreso).toEqual({ moneda: 'USD', monto: 100 });
  });

  test('F — Transferencia: sin vuelto; defaults = monto', () => {
    const r = resolveCashTender({
      metodo: 'Transferencia',
      monto: 100000,
      moneda: 'ARS',
      dineroRecibido: 999999,
      vueltoARS: 5000
    });
    expect(r.ok).toBe(true);
    expect(r.dineroRecibido).toBe(100000);
    expect(r.vueltoARS).toBe(0);
    expect(r.montoAbs).toBe(100000);
    expect(r.cajaVueltoARS).toBe(0);
  });

  test('G — descuentos no alterados: monto acreditado = ingresado con vuelto', () => {
    // Con vuelto, el dinero de caja para descuentos sigue siendo montoARS ingresado.
    const r = resolveCashTender({
      metodo: 'Efectivo',
      monto: 90000,
      moneda: 'ARS',
      dineroRecibido: 100000,
      vueltoARS: 10000
    });
    expect(r.ok).toBe(true);
    expect(r.montoARSAbs).toBe(90000);
    expect(r.dineroRecibido).toBe(100000);
    expect(r.vueltoARS).toBe(10000);
  });

  test('H — edición / dirty: defaults lectura históricos; max vuelto estable', () => {
    expect(readCashTenderFields({ monto: 50, dineroRecibido: null, vueltoARS: null })).toEqual({
      dineroRecibido: 50,
      vueltoARS: 0
    });
    expect(readCashTenderFields({ monto: -80, dineroRecibido: 100, vueltoARS: 20 })).toEqual({
      dineroRecibido: 100,
      vueltoARS: 20
    });
    expect(
      maxVueltoARS({
        dineroRecibido: 100,
        moneda: 'USD',
        tipoCambio: 1200,
        montoIngresadoARS: 100000
      })
    ).toBe(20000);
  });

  test('rechaza vuelto por encima del máximo', () => {
    const r = resolveCashTender({
      metodo: 'Efectivo',
      monto: 100000,
      moneda: 'ARS',
      dineroRecibido: 110000,
      vueltoARS: 20000
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/máximo/i);
  });
});
