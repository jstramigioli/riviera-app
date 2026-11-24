import { describe, it, expect } from 'vitest'
import {
  filterFacturacionRows,
  isFacturacionPendingVisible,
  matchesFacturacionSearch,
} from './facturacionTableFilters'

const ADJUNTO = 'FACTURA'

function adjuntosOf(cobro, tipo) {
  return (cobro?.adjuntos || []).filter((a) => a.tipo === tipo)
}

function makeCobro({ id, tipo, hasPdf = false, businessName = '', cuit = '' }) {
  return {
    id,
    codigo: `P-${id}`,
    requiereFacturacion: true,
    fecha: `2026-11-${String(10 + id).padStart(2, '0')}T10:00:00`,
    factura: {
      tipo,
      fecha: `2026-11-${String(10 + id).padStart(2, '0')}`,
      businessName,
      cuit,
    },
    adjuntos: hasPdf ? [{ id: id * 10, tipo: ADJUNTO, originalName: 'f.pdf' }] : [],
  }
}

describe('facturacionTableFilters', () => {
  it('default oculta cobros con comprobante salvo sesión', () => {
    const pending = makeCobro({ id: 1, tipo: 'A', businessName: 'Hotel SA' })
    const done = makeCobro({ id: 2, tipo: 'A', hasPdf: true, businessName: 'Viejo SA' })
    const session = makeCobro({
      id: 3,
      tipo: 'A',
      hasPdf: true,
      businessName: 'Sesion SA',
    })

    expect(isFacturacionPendingVisible(pending, new Set(), adjuntosOf, ADJUNTO)).toBe(true)
    expect(isFacturacionPendingVisible(done, new Set(), adjuntosOf, ADJUNTO)).toBe(false)
    expect(isFacturacionPendingVisible(session, new Set([3]), adjuntosOf, ADJUNTO)).toBe(true)

    const rows = filterFacturacionRows({
      payments: [pending, done, session],
      tipo: 'A',
      showPrevious: false,
      search: '',
      sessionDoneIds: new Set([3]),
      adjuntosOf,
      adjuntoTipo: ADJUNTO,
      searchHaystack: (c) => `${c.codigo} ${c.factura.businessName} ${c.factura.cuit}`,
      sortMs: (c) => new Date(c.factura.fecha).getTime(),
    })
    expect(rows.map((r) => r.id)).toEqual([3, 1])
  })

  it('Mostrar anteriores incluye comprobantes ya subidos', () => {
    const pending = makeCobro({ id: 1, tipo: 'B' })
    const done = makeCobro({ id: 2, tipo: 'B', hasPdf: true })
    const rows = filterFacturacionRows({
      payments: [pending, done],
      tipo: 'B',
      showPrevious: true,
      search: '',
      sessionDoneIds: new Set(),
      adjuntosOf,
      adjuntoTipo: ADJUNTO,
      searchHaystack: (c) => c.codigo,
      sortMs: (c) => new Date(c.factura.fecha).getTime(),
    })
    expect(rows.map((r) => r.id)).toEqual([2, 1])
  })

  it('búsqueda por razón social / CUIT / código', () => {
    expect(matchesFacturacionSearch('Hotel Riviera 30-123', 'riviera')).toBe(true)
    expect(matchesFacturacionSearch('Hotel Riviera 30-123', '999')).toBe(false)

    const a = makeCobro({ id: 1, tipo: 'A', businessName: 'Riviera SA', cuit: '30-111' })
    const b = makeCobro({ id: 2, tipo: 'A', businessName: 'Otro SA', cuit: '30-222' })
    const rows = filterFacturacionRows({
      payments: [a, b],
      tipo: 'A',
      showPrevious: true,
      search: '30-111',
      sessionDoneIds: new Set(),
      adjuntosOf,
      adjuntoTipo: ADJUNTO,
      searchHaystack: (c) => `${c.codigo} ${c.factura.businessName} ${c.factura.cuit}`,
      sortMs: (c) => new Date(c.factura.fecha).getTime(),
    })
    expect(rows.map((r) => r.id)).toEqual([1])
  })
})
