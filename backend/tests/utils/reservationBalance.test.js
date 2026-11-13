const {
  calculateReservationBalance,
  calculateAccountBalance,
  aggregateReservationsBalance,
} = require('../../src/utils/reservationBalance');
const { aggregateAccountsBalance } = require('../../src/utils/accountBalance');

describe('reservationBalance', () => {
  it('calcula saldo de una reserva desde cargos y pagos', () => {
    const result = calculateReservationBalance(
      [{ monto: 414000 }, { monto: '0' }],
      [{ montoARS: 424000 }]
    );

    expect(result.totalCargos).toBe(414000);
    expect(result.totalPagos).toBe(424000);
    expect(result.saldo).toBe(-10000);
    expect(result.estadoPago).toBe('A_FAVOR');
  });

  it('accountBalance usa la misma fórmula', () => {
    const a = calculateAccountBalance([{ monto: 100 }], [{ montoARS: 40 }]);
    const b = calculateReservationBalance([{ monto: 100 }], [{ montoARS: 40 }]);
    expect(a).toEqual(b);
    expect(a.saldo).toBe(60);
    expect(a.estadoPago).toBe('PENDIENTE');
  });

  it('agrega saldos de varias reservas del cliente y excluye canceladas', () => {
    const aggregated = aggregateReservationsBalance([
      {
        id: 9,
        status: 'PENDIENTE',
        cargos: [{ monto: 414000 }],
        pagos: [{ montoARS: 424000 }],
      },
      {
        id: 4,
        status: 'CANCELADA',
        cargos: [{ monto: 2431000 }],
        pagos: [{ montoARS: 31000 }],
      },
      {
        id: 10,
        status: 'CONFIRMADA',
        cargos: [{ monto: 1000 }],
        pagos: [{ montoARS: 200 }],
      },
    ]);

    expect(aggregated.reservationCount).toBe(2);
    expect(aggregated.totalCharges).toBe(415000);
    expect(aggregated.totalPayments).toBe(424200);
    expect(aggregated.balance).toBe(-9200);
    expect(aggregated.reservations.map((r) => r.reservationId)).toEqual([9, 10]);
  });

  it('aggregateAccountsBalance suma externas y excluye reservas canceladas', () => {
    const aggregated = aggregateAccountsBalance([
      {
        id: 1,
        kind: 'RESERVATION',
        reservationId: 9,
        reservation: { status: 'PENDIENTE' },
        cargos: [{ monto: 1000 }],
        pagos: [{ montoARS: 200 }],
      },
      {
        id: 2,
        kind: 'RESERVATION',
        reservationId: 4,
        reservation: { status: 'CANCELADA' },
        cargos: [{ monto: 999 }],
        pagos: [],
      },
      {
        id: 3,
        kind: 'EXTERNAL',
        reservationId: null,
        label: 'Bar mesa 3',
        cargos: [{ monto: 500 }],
        pagos: [{ montoARS: 100 }],
      },
    ]);

    expect(aggregated.accountCount).toBe(2);
    expect(aggregated.reservationCount).toBe(1);
    expect(aggregated.totalCharges).toBe(1500);
    expect(aggregated.totalPayments).toBe(300);
    expect(aggregated.balance).toBe(1200);
  });
});
