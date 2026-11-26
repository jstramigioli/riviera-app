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

function makeMultiCobro() {
  return {
    id: 77,
    codigo: 'A077',
    fecha: '2026-11-24T12:00:00',
    monto: 2000,
    montoARS: 2000,
    moneda: 'ARS',
    metodo: 'Efectivo',
    motivo: 'Cobro',
    reservaId: null,
    reserva: null,
    accountId: null,
    adjuntos: [],
    imputaciones: [
      {
        id: 1,
        ordenIndex: 0,
        reservaId: 21,
        montoARS: 1200,
        reserva: {
          id: 21,
          source: 'MOSTRADOR',
          status: 'CONFIRMADA',
          mainClient: { id: 5, firstName: 'María', lastName: 'López' },
        },
      },
      {
        id: 2,
        ordenIndex: 1,
        reservaId: 22,
        montoARS: 800,
        reserva: {
          id: 22,
          source: 'WHATSAPP',
          status: 'CONFIRMADA',
          mainClient: { id: 5, firstName: 'María', lastName: 'López' },
        },
      },
    ],
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

describe('CobrosHistorialTable — multi-imputación y detalle', () => {
  it('muestra cliente y chips de reservas en cobro multi', () => {
    render(
      <CobrosHistorialTable
        payments={[makeMultiCobro()]}
        testId="cobros-multi-table"
      />
    )

    expect(screen.getByTestId('cobro-cliente-77')).toHaveTextContent('María López')
    expect(screen.getByTestId('cobro-reservas-77')).toBeInTheDocument()
    expect(screen.getByTestId('cobro-reserva-link-77-21')).toHaveTextContent('#21')
    expect(screen.getByTestId('cobro-reserva-link-77-22')).toHaveTextContent('#22')
  })

  it('abre modal de detalle al clic en código y dispara Editar', () => {
    const onEdit = vi.fn()
    render(
      <CobrosHistorialTable
        payments={[makeMultiCobro()]}
        onEditCobro={onEdit}
        enableRowActions={false}
        testId="cobros-detail-table"
      />
    )

    fireEvent.click(screen.getByTestId('cobro-codigo-77'))
    expect(screen.getByTestId('cobro-detail-modal')).toBeInTheDocument()
    expect(screen.getByTestId('cobro-detail-reserva-21')).toBeInTheDocument()
    expect(screen.getByTestId('cobro-detail-reserva-22')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('cobro-detail-edit'))
    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({ id: 77, codigo: 'A077' })
    )
    expect(screen.queryByTestId('cobro-detail-modal')).not.toBeInTheDocument()
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
