const {
  validateImputaciones,
  autoDistributeOldestFirst,
  distributeBonificacion
} = require('../../src/utils/pagoImputacion');

describe('pagoImputacion', () => {
  test('validateImputaciones acepta suma exacta 1:1', () => {
    const rows = validateImputaciones(
      [{ accountId: 1, reservaId: 10, montoARS: 1000 }],
      1000
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].montoARS).toBe(1000);
  });

  test('validateImputaciones multi y rechaza exceso', () => {
    expect(() =>
      validateImputaciones(
        [
          { accountId: 1, montoARS: 600 },
          { accountId: 2, montoARS: 500 }
        ],
        1000
      )
    ).toThrow(/supera el recibido/);
  });

  test('validateImputaciones rechaza pendiente', () => {
    expect(() =>
      validateImputaciones([{ accountId: 1, montoARS: 400 }], 1000)
    ).toThrow(/pendiente de imputar/);
  });

  test('validateImputaciones rechaza cuenta duplicada', () => {
    expect(() =>
      validateImputaciones(
        [
          { accountId: 1, montoARS: 500 },
          { accountId: 1, montoARS: 500 }
        ],
        1000
      )
    ).toThrow(/duplicada/);
  });

  test('validateImputaciones rechaza bono > total', () => {
    expect(() =>
      validateImputaciones(
        [
          { accountId: 1, montoARS: 500, bonificacionARS: 80 },
          { accountId: 2, montoARS: 500, bonificacionARS: 30 }
        ],
        1000,
        { bonificacionTotalARS: 100 }
      )
    ).toThrow(/bonificación imputada/);
  });

  test('autoDistributeOldestFirst respeta deudas y orden', () => {
    const rows = autoDistributeOldestFirst(1000, [
      { accountId: 2, reservaId: 2, saldoPendiente: 400, sortKey: new Date('2026-02-01') },
      { accountId: 1, reservaId: 1, saldoPendiente: 800, sortKey: new Date('2026-01-01') }
    ]);
    expect(rows[0].accountId).toBe(1);
    expect(rows[0].montoARS).toBe(800);
    expect(rows[1].accountId).toBe(2);
    expect(rows[1].montoARS).toBe(200);
  });

  test('autoDistributeOldestFirst vuelca resto a última si sobra', () => {
    const rows = autoDistributeOldestFirst(500, [
      { accountId: 1, saldoPendiente: 100, sortKey: 1 },
      { accountId: 2, saldoPendiente: 100, sortKey: 2 }
    ]);
    const sum = rows.reduce((s, r) => s + r.montoARS, 0);
    expect(sum).toBe(500);
  });

  test('distributeBonificacion prorratea y redondea en última', () => {
    const rows = distributeBonificacion(
      [
        { accountId: 1, montoARS: 333.33 },
        { accountId: 2, montoARS: 333.33 },
        { accountId: 3, montoARS: 333.34 }
      ],
      100
    );
    const sum = rows.reduce((s, r) => s + r.bonificacionARS, 0);
    expect(sum).toBeCloseTo(100, 2);
  });

  test('devolución fuerza montos negativos', () => {
    const rows = validateImputaciones(
      [
        { accountId: 1, montoARS: 200 },
        { accountId: 2, montoARS: 300 }
      ],
      -500
    );
    expect(rows.every((r) => r.montoARS < 0)).toBe(true);
    expect(rows.reduce((s, r) => s + r.montoARS, 0)).toBe(-500);
  });
});
