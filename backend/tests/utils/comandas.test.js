const {
  AMBITOS_CONSUMO,
  parseAmbito,
  lineDescription,
  buildComandaLines,
  anularComanda,
  removeComandaLineForCargo
} = require('../../src/utils/comandas');

function makeTx(overrides = {}) {
  return {
    cargo: {
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 })
    },
    cobro: { findMany: jest.fn().mockResolvedValue([]) },
    discountApplication: { findMany: jest.fn().mockResolvedValue([]) },
    account: { update: jest.fn().mockResolvedValue({}) },
    comanda: {
      findUnique: jest.fn(),
      update: jest.fn().mockImplementation(({ where, data }) =>
        Promise.resolve({ id: where.id, ...data })
      )
    },
    comandaItem: {
      findUnique: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
      count: jest.fn()
    },
    ...overrides
  };
}

describe('comandas — ámbito', () => {
  it('acepta los cuatro ámbitos sin importar mayúsculas', () => {
    expect(AMBITOS_CONSUMO).toEqual(['CENA', 'MINUTAS', 'CAFETERIA', 'FRIGOBAR']);
    expect(parseAmbito('cena')).toBe('CENA');
    expect(parseAmbito(' Frigobar ')).toBe('FRIGOBAR');
  });

  it('rechaza vacíos y valores desconocidos', () => {
    expect(parseAmbito(null)).toBeNull();
    expect(parseAmbito('')).toBeNull();
    expect(parseAmbito('BEBIDAS')).toBeNull();
  });
});

describe('comandas — líneas', () => {
  it('describe producto, variedad y cantidad', () => {
    expect(lineDescription('Agua', null, 1)).toBe('Agua');
    expect(lineDescription('Agua', 'Grande', 3)).toBe('Agua (Grande) x3');
  });

  it('copia el precio vigente (de la variedad si la hay) y calcula subtotal', () => {
    const menuById = new Map([
      [1, { id: 1, name: 'Cena habitual - Externo', price: '20000', category: 'CENAS' }],
      [2, { id: 2, name: 'Agua', price: '1000', category: 'BEBIDAS' }]
    ]);
    const lines = buildComandaLines(
      [
        { menuItemId: 1, quantity: 2 },
        { menuItemId: 2, quantity: 3, variety: { id: 9, name: 'Grande', price: '1500' } }
      ],
      menuById
    );
    expect(lines[0]).toMatchObject({
      menuItemId: 1,
      varietyId: null,
      category: 'CENAS',
      descripcion: 'Cena habitual - Externo x2',
      cantidad: 2
    });
    expect(Number(lines[0].precioUnitario)).toBe(20000);
    expect(Number(lines[0].subtotal)).toBe(40000);
    expect(lines[1].varietyId).toBe(9);
    expect(Number(lines[1].precioUnitario)).toBe(1500);
    expect(Number(lines[1].subtotal)).toBe(4500);
  });
});

describe('comandas — anular', () => {
  it('borra los cargos, marca ANULADA y recalcula la cuenta', async () => {
    const tx = makeTx();
    tx.comanda.findUnique.mockResolvedValue({
      id: 5,
      accountId: 7,
      estado: 'ACTIVA',
      items: [{ id: 1, cargoId: 10 }, { id: 2, cargoId: 11 }]
    });
    const result = await anularComanda(tx, 5);
    expect(tx.cargo.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [10, 11] } } });
    expect(result.estado).toBe('ANULADA');
    expect(tx.account.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { status: 'CLOSED' }
    });
  });

  it('es idempotente sobre una comanda ya anulada', async () => {
    const tx = makeTx();
    tx.comanda.findUnique.mockResolvedValue({ id: 5, accountId: 7, estado: 'ANULADA', items: [] });
    await anularComanda(tx, 5);
    expect(tx.cargo.deleteMany).not.toHaveBeenCalled();
    expect(tx.comanda.update).not.toHaveBeenCalled();
  });

  it('devuelve null si la comanda no existe', async () => {
    const tx = makeTx();
    tx.comanda.findUnique.mockResolvedValue(null);
    await expect(anularComanda(tx, 99)).resolves.toBeNull();
  });
});

describe('comandas — quitar línea por cargo', () => {
  it('ignora cargos que no son de comanda', async () => {
    const tx = makeTx();
    tx.comandaItem.findUnique.mockResolvedValue(null);
    await expect(removeComandaLineForCargo(tx, 3)).resolves.toBeNull();
    expect(tx.comandaItem.delete).not.toHaveBeenCalled();
  });

  it('borra la línea y deja la comanda activa si quedan otras', async () => {
    const tx = makeTx();
    tx.comandaItem.findUnique.mockResolvedValue({ id: 1, comandaId: 5 });
    tx.comandaItem.count.mockResolvedValue(2);
    tx.comanda.findUnique.mockResolvedValue({ id: 5, estado: 'ACTIVA' });
    const result = await removeComandaLineForCargo(tx, 10);
    expect(tx.comandaItem.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(result.estado).toBe('ACTIVA');
  });

  it('anula la comanda cuando se quita la última línea', async () => {
    const tx = makeTx();
    tx.comandaItem.findUnique.mockResolvedValue({ id: 1, comandaId: 5 });
    tx.comandaItem.count.mockResolvedValue(0);
    const result = await removeComandaLineForCargo(tx, 10);
    expect(result.estado).toBe('ANULADA');
  });
});
