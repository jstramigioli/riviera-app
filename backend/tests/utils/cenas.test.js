const {
  createTipoCena,
  resolveCenaVariety,
  deleteTipoCena,
  CenaInputError
} = require('../../src/utils/cenas');
const {
  isNightOfStay,
  registrarCenaManual,
  parseComensales,
  cenaLinesFromComensales
} = require('../../src/utils/comidasGestion');

function tipoItem(overrides = {}) {
  return {
    id: 5,
    name: 'Cena buffet',
    category: 'CENAS',
    isActive: true,
    ordenIndex: 20,
    varieties: [
      { id: 51, name: 'Alojado', price: '18000' },
      { id: 52, name: 'Externo', price: '22000' }
    ],
    _count: { comandaItems: 0 },
    ...overrides
  };
}

describe('tipos de cena', () => {
  it('crea el producto con sus dos precios (Alojado / Externo)', async () => {
    const db = {
      menuItem: {
        findMany: jest.fn().mockResolvedValue([{ name: 'Cena buffet' }]),
        findFirst: jest.fn().mockResolvedValue({ ordenIndex: 40 }),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve(
            tipoItem({
              name: data.name,
              ordenIndex: data.ordenIndex,
              varieties: data.varieties.create.map((v, i) => ({ id: i + 1, ...v }))
            })
          )
        )
      }
    };
    const tipo = await createTipoCena(db, { nombre: '  Cena  Pascuas ', precioAlojado: 25000, precioExterno: 30000 });
    expect(tipo).toMatchObject({ nombre: 'Cena Pascuas', ordenIndex: 50 });
    expect(tipo.precioAlojado).toBe(25000);
    expect(tipo.precioExterno).toBe(30000);
    expect(db.menuItem.create.mock.calls[0][0].data.category).toBe('CENAS');
  });

  it('rechaza nombre vacío, duplicado (sin importar acentos) y precio negativo', async () => {
    const db = {
      menuItem: {
        findMany: jest.fn().mockResolvedValue([{ name: 'Cena Año Nuevo' }]),
        findFirst: jest.fn(),
        create: jest.fn()
      }
    };
    await expect(createTipoCena(db, { nombre: ' ' })).rejects.toThrow('nombre');
    await expect(createTipoCena(db, { nombre: 'cena ano nuevo' })).rejects.toMatchObject({ status: 409 });
    await expect(createTipoCena(db, { nombre: 'Otra', precioAlojado: -1 })).rejects.toThrow(CenaInputError);
    expect(db.menuItem.create).not.toHaveBeenCalled();
  });

  it('elige la variedad según el comensal', async () => {
    const db = { menuItem: { findFirst: jest.fn().mockResolvedValue(tipoItem()) } };
    expect((await resolveCenaVariety(db, 5, 'ALOJADO')).variety.id).toBe(51);
    expect((await resolveCenaVariety(db, 5, 'EXTERNO')).variety.id).toBe(52);
  });

  it('no elimina un tipo que ya se usó en comandas', async () => {
    const db = {
      menuItem: {
        findFirst: jest.fn().mockResolvedValue(tipoItem({ _count: { comandaItems: 3 } })),
        delete: jest.fn()
      }
    };
    await expect(deleteTipoCena(db, 5)).rejects.toMatchObject({ status: 409 });
    expect(db.menuItem.delete).not.toHaveBeenCalled();
  });
});

describe('cenas manuales — validaciones', () => {
  const segments = [{ startDate: '2026-12-01', endDate: '2026-12-04', isActive: true }];

  it('noche de estadía: desde el check-in hasta la noche anterior al check-out', () => {
    expect(isNightOfStay(segments, '2026-12-01')).toBe(true);
    expect(isNightOfStay(segments, '2026-12-03')).toBe(true);
    expect(isNightOfStay(segments, '2026-12-04')).toBe(false);
    expect(isNightOfStay([{ ...segments[0], isActive: false }], '2026-12-02')).toBe(false);
  });

  function dbConReserva(prestaciones) {
    return {
      reservation: {
        findUnique: jest.fn().mockResolvedValue({ id: 9, status: 'INGRESADA', mainClientId: 1, segments })
      },
      prestacionComida: { findMany: jest.fn().mockResolvedValue(prestaciones) },
      $transaction: jest.fn()
    };
  }

  it('no deja cargar una cena paga si la reserva ya la tiene incluida', async () => {
    const db = dbConReserva([{ origen: 'REGIMEN', vigente: true, estado: 'PREVISTA' }]);
    await expect(
      registrarCenaManual(db, { fecha: '2026-12-02', menuItemId: 5, pax: 2, reservationId: 9 })
    ).rejects.toMatchObject({ status: 409 });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('no duplica una cena manual prevista de la misma noche', async () => {
    const db = dbConReserva([{ origen: 'MANUAL', estado: 'PREVISTA' }]);
    await expect(
      registrarCenaManual(db, { fecha: '2026-12-02', menuItemId: 5, pax: 2, reservationId: 9 })
    ).rejects.toThrow('Ya hay una cena registrada');
  });

  it('valida fecha, comensales y nombre del externo', async () => {
    const db = dbConReserva([]);
    await expect(registrarCenaManual(db, { fecha: 'x', menuItemId: 5, pax: 2 })).rejects.toThrow('Fecha');
    await expect(registrarCenaManual(db, { fecha: '2026-12-02', menuItemId: 5, pax: 0 })).rejects.toThrow('comensales');
    await expect(registrarCenaManual(db, { fecha: '2026-12-02', menuItemId: 5, pax: 2 })).rejects.toThrow('nombre');
    await expect(
      registrarCenaManual(db, { fecha: '2026-12-04', menuItemId: 5, pax: 2, reservationId: 9 })
    ).rejects.toThrow('noche de la estadía');
  });

  it('externo nuevo: exige nombre, apellido y un contacto válido', async () => {
    const db = dbConReserva([]);
    const base = { fecha: '2026-12-02', menuItemId: 5, pax: 2 };
    await expect(registrarCenaManual(db, { ...base, cliente: { firstName: 'Ana' } })).rejects.toThrow('apellido');
    await expect(
      registrarCenaManual(db, { ...base, cliente: { firstName: 'Ana', lastName: 'Ruiz' } })
    ).rejects.toThrow('teléfono o un email');
    await expect(
      registrarCenaManual(db, { ...base, cliente: { firstName: 'Ana', lastName: 'Ruiz', email: 'ana' } })
    ).rejects.toThrow('email no es válido');
  });

  it('externo existente: rechaza un cliente inexistente', async () => {
    const db = { ...dbConReserva([]), client: { findUnique: jest.fn().mockResolvedValue(null) } };
    await expect(
      registrarCenaManual(db, { fecha: '2026-12-02', menuItemId: 5, pax: 2, clientId: 77 })
    ).rejects.toMatchObject({ status: 404 });
  });

  it('líneas de cena por edad: adulto precio base, 5 a 10 la mitad, menor de 5 sin cargo', () => {
    const detalle = parseComensales([
      { edad: 'ADULTO', dietCeliaco: true },
      { edad: 'ADULTO' },
      { edad: 'NINO' },
      { edad: 'MENOR' }
    ]);
    const lines = cenaLinesFromComensales(
      { item: { id: 5, name: 'Cena' }, varietyId: 7, varietyName: 'Externo', precioBase: 25001 },
      detalle
    );
    expect(lines.map((l) => [l.descripcion, l.cantidad, Number(l.precioUnitario), Number(l.subtotal), Boolean(l.bonificado)])).toEqual([
      ['Cena (Externo) x2', 2, 25001, 50002, false],
      ['Cena (Externo · 5 a 10 años)', 1, 12500.5, 12500.5, false],
      ['Cena (Externo · menor de 5)', 1, 0, 0, true]
    ]);
  });

  it('sin detalle usa pax adultos; valida edades', () => {
    expect(parseComensales(undefined, 2)).toEqual([
      { edad: 'ADULTO', dietVegetariano: false, dietVegano: false, dietCeliaco: false },
      { edad: 'ADULTO', dietVegetariano: false, dietVegano: false, dietCeliaco: false }
    ]);
    expect(() => parseComensales([{ edad: 'BEBE' }])).toThrow('Edad');
    expect(() => parseComensales([])).toThrow('comensales');
  });
});
