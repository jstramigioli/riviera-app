const { withoutAnulados, anularCobro, createCobrosAnuladosExtension } = require('../../src/utils/cobrosAnulados');

describe('filtro de cobros anulados', () => {
  test('agrega anuladoAt: null salvo que el where ya lo mencione', () => {
    expect(withoutAnulados({ where: { accountId: 3 } })).toEqual({ where: { accountId: 3, anuladoAt: null } });
    expect(withoutAnulados({})).toEqual({ where: { anuladoAt: null } });
    const explicit = { where: { anuladoAt: { not: null } } };
    expect(withoutAnulados(explicit)).toBe(explicit);
    const todos = { where: { anuladoAt: undefined } };
    expect(withoutAnulados(todos)).toBe(todos);
  });

  test('la extensión filtra findMany/count pero no findUnique', async () => {
    const ext = createCobrosAnuladosExtension();
    expect(Object.keys(ext.query.cobro)).toEqual(
      expect.arrayContaining(['findMany', 'findFirst', 'count', 'aggregate', 'groupBy'])
    );
    expect(ext.query.cobro.findUnique).toBeUndefined();
    const query = jest.fn((a) => a);
    expect(await ext.query.cobro.count({ args: { where: { fecha: 1 } }, query })).toEqual({
      where: { fecha: 1, anuladoAt: null }
    });
  });
});

describe('anularCobro', () => {
  function makeTx(cobro, devoluciones = 0) {
    return {
      cobro: {
        findUnique: jest.fn().mockResolvedValue(cobro),
        count: jest.fn().mockResolvedValue(devoluciones),
        update: jest.fn(({ data }) => Promise.resolve({ ...cobro, ...data }))
      },
      discountApplication: { deleteMany: jest.fn() },
      cobroImputacion: { deleteMany: jest.fn() }
    };
  }
  const base = {
    id: 5,
    codigo: 'A010',
    accountId: 3,
    reservaId: 10,
    anuladoAt: null,
    imputaciones: [{ accountId: 3, reservaId: 10, montoARS: '1000.00', bonificacionARS: '50.00' }],
    discountApplications: [{ id: 9, accountId: 3, montoARS: '50.00', promotionRuleId: null, paymentMethodConfigId: 2 }]
  };

  test('quita imputaciones y descuentos, desvincula y guarda quién/por qué/dónde', async () => {
    const tx = makeTx(base);
    const now = new Date('2026-11-26T12:00:00Z');
    const { cobro, accountIds } = await anularCobro(tx, {
      cobroId: 5,
      user: { id: 1, displayName: 'Julián' },
      motivo: ' cargado dos veces ',
      now
    });

    expect(accountIds).toEqual([3]);
    expect(tx.discountApplication.deleteMany).toHaveBeenCalledWith({ where: { cobroId: 5 } });
    expect(tx.cobroImputacion.deleteMany).toHaveBeenCalledWith({ where: { cobroId: 5 } });
    const data = tx.cobro.update.mock.calls[0][0].data;
    expect(data).toMatchObject({
      anuladoAt: now,
      anuladoPorId: 1,
      anuladoPorNombre: 'Julián',
      motivoAnulacion: 'cargado dos veces',
      accountId: null,
      reservaId: null
    });
    expect(data.anulacionSnapshot.imputaciones[0]).toMatchObject({ accountId: 3, montoARS: '1000.00' });
    expect(cobro.codigo).toBe('A010');
  });

  test('no anula si tiene devoluciones activas ni si ya estaba anulado', async () => {
    await expect(anularCobro(makeTx(base, 1), { cobroId: 5 })).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      anularCobro(makeTx({ ...base, anuladoAt: new Date() }), { cobroId: 5 })
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(anularCobro(makeTx(null), { cobroId: 5 })).rejects.toMatchObject({ statusCode: 404 });
  });
});
