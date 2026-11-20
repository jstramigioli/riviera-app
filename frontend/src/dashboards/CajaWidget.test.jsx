import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../services/api', () => ({
  getAllPagos: vi.fn(),
  updatePago: vi.fn(),
  uploadPagoAdjuntos: vi.fn(),
  deletePagoAdjunto: vi.fn(),
  downloadPagoAdjunto: vi.fn(),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ can: () => false }),
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

vi.mock('../components/PaymentForm', () => ({
  default: ({ initialPago, onClose }) => (
    <div data-testid="payment-form">
      {initialPago?.id ? `edit-${initialPago.id}` : 'create'}
      <button type="button" onClick={onClose}>
        cerrar
      </button>
    </div>
  ),
}))

import { getAllPagos } from '../services/api'
import CajaWidget, { pagoInHorizon } from './CajaWidget'

const TODAY = '2026-11-20'

function makePago({ id, fecha, codigo }) {
  return {
    id,
    codigo: codigo || `P-${id}`,
    fecha,
    montoARS: 1000,
    metodo: 'Efectivo',
    motivo: 'Pago',
    reservaId: 10,
    reserva: {
      id: 10,
      mainClient: { id: 1, firstName: 'Ana', lastName: 'Pérez' },
    },
    adjuntos: [],
  }
}

describe('CajaWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAllPagos.mockResolvedValue([
      makePago({ id: 1, fecha: '2026-11-20T10:00:00' }),
      makePago({ id: 2, fecha: '2026-11-18T10:00:00' }),
      makePago({ id: 3, fecha: '2026-11-10T10:00:00' }),
    ])
  })

  it('muestra pagos de hoy por defecto y permite cambiar a 3 días', async () => {
    render(
      <MemoryRouter>
        <CajaWidget todayIso={TODAY} />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('caja-pagos-table')).toBeInTheDocument()
    })

    expect(screen.getByTestId('pago-row-1')).toBeInTheDocument()
    expect(screen.queryByTestId('pago-row-2')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pago-row-3')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '3 días' }))

    await waitFor(() => {
      expect(screen.getByTestId('pago-row-1')).toBeInTheDocument()
      expect(screen.getByTestId('pago-row-2')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('pago-row-3')).not.toBeInTheDocument()
  })

  it('abre crear y editar pago', async () => {
    render(
      <MemoryRouter>
        <CajaWidget todayIso={TODAY} />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('pago-row-1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('caja-nuevo-pago'))
    expect(screen.getByTestId('payment-form')).toHaveTextContent('create')
    fireEvent.click(screen.getByRole('button', { name: 'cerrar' }))

    fireEvent.click(screen.getByTestId('pago-edit-1'))
    expect(screen.getByTestId('payment-form')).toHaveTextContent('edit-1')
  })

  it('pagoInHorizon compara por día civil local', () => {
    expect(
      pagoInHorizon({ fecha: '2026-11-20T15:00:00.000Z' }, TODAY, 1)
    ).toBe(true)
    expect(
      pagoInHorizon({ fecha: '2026-11-19T15:00:00.000Z' }, TODAY, 1)
    ).toBe(false)
    expect(
      pagoInHorizon({ fecha: '2026-11-18T15:00:00.000Z' }, TODAY, 3)
    ).toBe(true)
  })

  it('vuelve a pedir pagos cuando cambia refreshToken', async () => {
    const { rerender } = render(
      <MemoryRouter>
        <CajaWidget todayIso={TODAY} refreshToken={0} />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(getAllPagos).toHaveBeenCalledTimes(1)
    })

    getAllPagos.mockResolvedValue([
      makePago({ id: 99, fecha: '2026-11-20T15:00:00.000Z', codigo: 'A099' }),
    ])

    rerender(
      <MemoryRouter>
        <CajaWidget todayIso={TODAY} refreshToken={1} />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(getAllPagos).toHaveBeenCalledTimes(2)
      expect(screen.getByTestId('pago-row-99')).toBeInTheDocument()
    })
  })
})
