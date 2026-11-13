const {
  computeDiscountFromReceived,
  computeCashToSettle,
  computeDiscountReversal
} = require('../../src/utils/paymentDiscount');
const { calculateReservationBalance } = require('../../src/utils/reservationBalance');

const efectivo10 = {
  descuentoActivo: true,
  descuentoTipo: 'PERCENT',
  descuentoValor: 10,
  aplicaEnParcial: true,
  aplicaEnSeña: true
};

describe('paymentDiscount', () => {
  it('parcial: crédito = recibido/(1-p)', () => {
    const r = computeDiscountFromReceived({
      dineroARS: 45000,
      config: efectivo10,
      motivo: 'Pago',
      saldoPendiente: 100000
    });
    expect(r.aplica).toBe(true);
    expect(r.dineroARS).toBe(45000);
    expect(r.creditoARS).toBe(50000);
    expect(r.descuentoARS).toBe(5000);
  });

  it('total: dinero a pedir = saldo * (1-p)', () => {
    const r = computeCashToSettle({ saldoPendiente: 100000, config: efectivo10 });
    expect(r.aplica).toBe(true);
    expect(r.dineroARS).toBe(90000);
    expect(r.descuentoARS).toBe(10000);
    expect(r.creditoARS).toBe(100000);
  });

  it('permite A_FAVOR (no recorta D)', () => {
    const r = computeDiscountFromReceived({
      dineroARS: 90000,
      config: efectivo10,
      saldoPendiente: 50000
    });
    expect(r.aplica).toBe(true);
    expect(r.creditoARS).toBe(100000);
    expect(r.descuentoARS).toBe(10000);
  });

  it('seña aplica cuando aplicaEnSeña', () => {
    const r = computeDiscountFromReceived({
      dineroARS: 9000,
      config: efectivo10,
      motivo: 'Seña'
    });
    expect(r.aplica).toBe(true);
    expect(r.creditoARS).toBe(10000);
  });

  it('reversión proporcional', () => {
    const r = computeDiscountReversal({
      originalDiscountARS: 10000,
      originalPagoARS: 90000,
      devolucionARS: 45000
    });
    expect(r.descuentoRevertidoARS).toBe(5000);
  });
});

describe('reservationBalance con descuentos', () => {
  it('saldo = cargos − pagos − descuentos', () => {
    const r = calculateReservationBalance(
      [{ monto: 100000 }],
      [{ montoARS: 90000 }],
      [{ montoARS: 10000 }]
    );
    expect(r.totalDescuentos).toBe(10000);
    expect(r.saldo).toBe(0);
    expect(r.estadoPago).toBe('PAGADO');
  });

  it('sin descuentos equivale al comportamiento previo', () => {
    const r = calculateReservationBalance([{ monto: 100 }], [{ montoARS: 40 }]);
    expect(r.totalDescuentos).toBe(0);
    expect(r.saldo).toBe(60);
  });
});
