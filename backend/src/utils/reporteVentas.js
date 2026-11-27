/**
 * Reporte de ventas gastronómicas por ámbito y producto, a partir de las
 * líneas de comandas activas (precio histórico de cada línea).
 * - facturado: líneas que generaron Cargo.
 * - sinCargo: líneas bonificadas (Almuerzo sin cargo), a precio de referencia.
 * Los consumos cargados antes de existir las comandas no tienen ámbito y no entran.
 */
const AMBITO_ORDEN = ['CENA', 'MINUTAS', 'CAFETERIA', 'FRIGOBAR'];

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** Nombre del producto de la línea (catálogo actual o, si se borró, la descripción guardada). */
function nombreProducto(item) {
  if (item.menuItem?.name) {
    return item.variety?.name ? `${item.menuItem.name} (${item.variety.name})` : item.menuItem.name;
  }
  return String(item.descripcion || 'Sin nombre').replace(/ x\d+$/, '');
}

/**
 * items: [{ cantidad, subtotal, cargoId, bonificado, descripcion, menuItemId, varietyId,
 *           menuItem?: { name }, variety?: { name }, comanda: { id, ambito } }]
 */
function aggregateVentas(items) {
  const porAmbito = new Map(
    AMBITO_ORDEN.map((a) => [a, { ambito: a, comandas: new Set(), unidades: 0, facturado: 0, sinCargo: 0 }])
  );
  const porProducto = new Map();

  for (const item of items) {
    const facturado = item.cargoId != null && !item.bonificado ? Number(item.subtotal) : 0;
    const sinCargo = item.bonificado ? Number(item.subtotal) : 0;
    if (!facturado && !sinCargo) continue; // línea sin cargo vigente ni bonificación

    const ambito = item.comanda.ambito;
    if (!porAmbito.has(ambito)) {
      porAmbito.set(ambito, { ambito, comandas: new Set(), unidades: 0, facturado: 0, sinCargo: 0 });
    }
    const a = porAmbito.get(ambito);
    a.comandas.add(item.comanda.id);
    a.unidades += item.cantidad;
    a.facturado += facturado;
    a.sinCargo += sinCargo;

    const nombre = nombreProducto(item);
    const key = `${ambito}|${item.menuItemId ?? `x:${nombre}`}|${item.varietyId ?? ''}`;
    if (!porProducto.has(key)) {
      porProducto.set(key, { ambito, menuItemId: item.menuItemId, producto: nombre, unidades: 0, facturado: 0, sinCargo: 0 });
    }
    const p = porProducto.get(key);
    p.unidades += item.cantidad;
    p.facturado += facturado;
    p.sinCargo += sinCargo;
  }

  const ambitos = [...porAmbito.values()].map((a) => ({
    ambito: a.ambito,
    comandas: a.comandas.size,
    unidades: a.unidades,
    facturado: round2(a.facturado),
    sinCargo: round2(a.sinCargo)
  }));
  const productos = [...porProducto.values()]
    .map((p) => ({ ...p, facturado: round2(p.facturado), sinCargo: round2(p.sinCargo) }))
    .sort((x, y) => y.facturado - x.facturado || y.unidades - x.unidades || x.producto.localeCompare(y.producto, 'es'));

  const totales = ambitos.reduce(
    (t, a) => ({
      comandas: t.comandas + a.comandas,
      unidades: t.unidades + a.unidades,
      facturado: round2(t.facturado + a.facturado),
      sinCargo: round2(t.sinCargo + a.sinCargo)
    }),
    { comandas: 0, unidades: 0, facturado: 0, sinCargo: 0 }
  );

  return { porAmbito: ambitos, porProducto: productos, totales };
}

module.exports = { AMBITO_ORDEN, nombreProducto, aggregateVentas };
