import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

vi.mock('../services/api', () => ({
  updatePago: vi.fn(),
  uploadPagoAdjuntos: vi.fn(),
  deletePagoAdjunto: vi.fn(),
  downloadPagoAdjunto: vi.fn(),
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

import PagosHistorialTable from './PagosHistorialTable'

function makePago({ id, moneda = 'ARS', metodo = 'Efectivo' }) {
  return {
    id,
    codigo: `P-${id}`,
    fecha: '2026-11-20T10:00:00',
    monto: moneda === 'USD' ? 100 : 1000,
    montoARS: 1000,
    moneda,
    metodo,
    motivo: 'Pago',
    reservaId: 10,
    reserva: {
      id: 10,
      mainClient: { id: 1, firstName: 'Ana', lastName: 'Pérez' },
    },
    adjuntos: [],
  }
}

describe('PagosHistorialTable — moneda', () => {
  it('muestra columna Moneda y filtra por ARS/USD', () => {
    render(
      <PagosHistorialTable
        payments={[
          makePago({ id: 1, moneda: 'ARS' }),
          makePago({ id: 2, moneda: 'USD' }),
          makePago({ id: 3 }),
        ]}
        testId="pagos-moneda-table"
      />
    )

    expect(screen.getByRole('columnheader', { name: /Moneda/i })).toBeInTheDocument()
    expect(screen.getByTestId('pago-moneda-1')).toHaveTextContent('ARS')
    expect(screen.getByTestId('pago-moneda-2')).toHaveTextContent('USD')
    expect(screen.getByTestId('pago-moneda-3')).toHaveTextContent('ARS')

    fireEvent.click(screen.getByRole('button', { name: 'Filtrar Moneda' }))
    const filtro = screen.getByTestId('pay-filter-moneda')
    fireEvent.change(filtro, { target: { value: 'USD' } })

    expect(screen.getByTestId('pago-row-2')).toBeInTheDocument()
    expect(screen.queryByTestId('pago-row-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pago-row-3')).not.toBeInTheDocument()

    fireEvent.change(filtro, { target: { value: 'ARS' } })
    expect(screen.getByTestId('pago-row-1')).toBeInTheDocument()
    expect(screen.getByTestId('pago-row-3')).toBeInTheDocument()
    expect(screen.queryByTestId('pago-row-2')).not.toBeInTheDocument()

    const options = within(filtro)
      .getAllByRole('option')
      .map((el) => el.value)
    expect(options).toEqual(expect.arrayContaining(['', 'ARS', 'USD']))
  })
})
