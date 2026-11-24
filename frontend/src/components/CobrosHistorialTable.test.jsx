import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

vi.mock('../services/api', () => ({
  updateCobro: vi.fn(),
  uploadCobroAdjuntos: vi.fn(),
  deleteCobroAdjunto: vi.fn(),
  downloadCobroAdjunto: vi.fn(),
}))

vi.mock('../hooks/useAppNotice', () => ({
  useAppNotice: () => ({
    notify: vi.fn(),
    noticeDialog: null,
  }),
}))

vi.mock('../hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    confirm: vi.fn(async () => false),
    confirmDialog: null,
  }),
}))

import CobrosHistorialTable from './CobrosHistorialTable'

function makeCobro({ id, moneda = 'ARS', metodo = 'Efectivo' }) {
  return {
    id,
    codigo: `P-${id}`,
    fecha: '2026-11-20T10:00:00',
    monto: moneda === 'USD' ? 100 : 1000,
    montoARS: 1000,
    moneda,
    metodo,
    motivo: 'Cobro',
    reservaId: 10,
    reserva: {
      id: 10,
      mainClient: { id: 1, firstName: 'Ana', lastName: 'Pérez' },
    },
    adjuntos: [],
  }
}

describe('CobrosHistorialTable — moneda', () => {
  it('muestra columna Moneda y filtra por ARS/USD', () => {
    render(
      <CobrosHistorialTable
        payments={[
          makeCobro({ id: 1, moneda: 'ARS' }),
          makeCobro({ id: 2, moneda: 'USD' }),
          makeCobro({ id: 3 }),
        ]}
        testId="cobros-moneda-table"
      />
    )

    expect(screen.getByRole('columnheader', { name: /Moneda/i })).toBeInTheDocument()
    expect(screen.getByTestId('cobro-moneda-1')).toHaveTextContent('ARS')
    expect(screen.getByTestId('cobro-moneda-2')).toHaveTextContent('USD')
    expect(screen.getByTestId('cobro-moneda-3')).toHaveTextContent('ARS')

    fireEvent.click(screen.getByRole('button', { name: 'Filtrar Moneda' }))
    const filtro = screen.getByTestId('pay-filter-moneda')
    fireEvent.change(filtro, { target: { value: 'USD' } })

    expect(screen.getByTestId('cobro-row-2')).toBeInTheDocument()
    expect(screen.queryByTestId('cobro-row-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('cobro-row-3')).not.toBeInTheDocument()

    fireEvent.change(filtro, { target: { value: 'ARS' } })
    expect(screen.getByTestId('cobro-row-1')).toBeInTheDocument()
    expect(screen.getByTestId('cobro-row-3')).toBeInTheDocument()
    expect(screen.queryByTestId('cobro-row-2')).not.toBeInTheDocument()

    const options = within(filtro)
      .getAllByRole('option')
      .map((el) => el.value)
    expect(options).toEqual(expect.arrayContaining(['', 'ARS', 'USD']))
  })
})

describe('CobrosHistorialTable — paginación', () => {
  it('pagina de a 50 por defecto y permite cambiar filas', () => {
    // Misma fecha → orden por id desc: 55…1. Página 1 = 55–6; página 2 = 5–1.
    const payments = Array.from({ length: 55 }, (_, i) =>
      makeCobro({ id: i + 1, moneda: i % 2 === 0 ? 'ARS' : 'USD' })
    )

    render(
      <CobrosHistorialTable payments={payments} testId="cobros-pager-table" />
    )

    expect(screen.getByTestId('cobro-row-55')).toBeInTheDocument()
    expect(screen.getByTestId('cobro-row-6')).toBeInTheDocument()
    expect(screen.queryByTestId('cobro-row-5')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
    expect(screen.getByTestId('cobro-row-5')).toBeInTheDocument()
    expect(screen.getByTestId('cobro-row-1')).toBeInTheDocument()
    expect(screen.queryByTestId('cobro-row-55')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Filas por página'), {
      target: { value: '100' },
    })
    expect(screen.getByTestId('cobro-row-55')).toBeInTheDocument()
    expect(screen.getByTestId('cobro-row-1')).toBeInTheDocument()
  })
})
