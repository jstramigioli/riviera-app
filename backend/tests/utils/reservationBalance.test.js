const {
  calculateReservationBalance,
  aggregateReservationsBalance,
} = require('../../src/utils/reservationBalance');

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
});
