const { aggregateVentas, nombreProducto } = require('../../src/utils/reporteVentas');

const line = (o) => ({
  cantidad: 1,
  subtotal: '1000',
  cargoId: 1,
  bonificado: false,
  descripcion: 'X',
  menuItemId: 1,
  varietyId: null,
  menuItem: { name: 'Agua' },
  variety: null,
  comanda: { id: 1, ambito: 'MINUTAS' },
  ...o
});

describe('aggregateVentas', () => {
  it('agrupa por ámbito y por producto separando facturado y sin cargo', () => {
    const r = aggregateVentas([
      line({ cantidad: 2, subtotal: '3000', comanda: { id: 1, ambito: 'MINUTAS' } }),
      line({ cantidad: 1, subtotal: '12000', cargoId: null, bonificado: true, menuItemId: 2, menuItem: { name: 'Milanesa' }, comanda: { id: 1, ambito: 'MINUTAS' } }),
      line({ cantidad: 1, subtotal: '1500', comanda: { id: 2, ambito: 'FRIGOBAR' } }),
      line({ cantidad: 3, subtotal: '66000', menuItemId: 9, varietyId: 92, menuItem: { name: 'Cena buffet' }, variety: { name: 'Externo' }, comanda: { id: 3, ambito: 'CENA' } })
    ]);
    const minutas = r.porAmbito.find((a) => a.ambito === 'MINUTAS');
    expect(minutas).toEqual({ ambito: 'MINUTAS', comandas: 1, unidades: 3, facturado: 3000, sinCargo: 12000 });
    expect(r.porAmbito.map((a) => a.ambito)).toEqual(['CENA', 'MINUTAS', 'CAFETERIA', 'FRIGOBAR']);
    expect(r.porAmbito.find((a) => a.ambito === 'CAFETERIA').unidades).toBe(0);
    expect(r.totales).toEqual({ comandas: 3, unidades: 7, facturado: 70500, sinCargo: 12000 });

    // Mismo producto en distintos ámbitos: filas separadas
    const aguas = r.porProducto.filter((p) => p.producto === 'Agua');
    expect(aguas.map((p) => p.ambito).sort()).toEqual(['FRIGOBAR', 'MINUTAS']);
    expect(r.porProducto[0]).toMatchObject({ producto: 'Cena buffet (Externo)', unidades: 3, facturado: 66000 });
  });

  it('ignora líneas cuyo cargo ya no existe (no facturadas ni bonificadas)', () => {
    const r = aggregateVentas([line({ cargoId: null, bonificado: false })]);
    expect(r.totales.unidades).toBe(0);
    expect(r.porProducto).toEqual([]);
  });

  it('usa la descripción guardada si el producto se eliminó del catálogo', () => {
    expect(nombreProducto({ menuItem: null, descripcion: 'Tostado x3' })).toBe('Tostado');
  });
});
