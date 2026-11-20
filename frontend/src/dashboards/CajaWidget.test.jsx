import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { MOTIVO_DEVOLUCION } from '../constants/billing'

vi.mock('../services/api', () => ({
  getAllPagos: vi.fn(),
  updatePago: vi.fn(),
  deletePago: vi.fn(),
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

function makePago({ id, fecha, codigo, motivo = 'Pago', metodo = 'Efectivo', reservaId = 10 }) {
  return {
    id,
    codigo: codigo || `P-${id}`,
    fecha,
    montoARS: 1000,
    metodo,
    motivo,
    reservaId,
    reserva: {
      id: reservaId,
      mainClient: { id: 1, firstName: 'Ana', lastName: 'Pérez' },
    },
    adjuntos: [],
  }
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
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

  it('abre crear pago y no ofrece editar ni eliminar en el listado', async () => {
    render(
      <MemoryRouter>
        <CajaWidget todayIso={TODAY} />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('pago-row-1')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('pago-edit-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pago-delete-1')).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Acciones' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('caja-nuevo-pago'))
    expect(screen.getByTestId('payment-form')).toHaveTextContent('create')
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

  it('nro de reserva es clickeable y navega a la reserva', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <CajaWidget todayIso={TODAY} />
                <LocationProbe />
              </>
            }
          />
          <Route path="/reservations/:id" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('pago-reserva-link-1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('pago-reserva-link-1'))

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/reservations/10')
    })
  })

  it('devoluciones no muestran toggle Retirado', async () => {
    getAllPagos.mockResolvedValue([
      makePago({
        id: 7,
        fecha: '2026-11-20T10:00:00',
        motivo: MOTIVO_DEVOLUCION,
        metodo: 'Efectivo',
      }),
      makePago({
        id: 8,
        fecha: '2026-11-20T11:00:00',
        motivo: 'Pago',
        metodo: 'Efectivo',
      }),
    ])

    render(
      <MemoryRouter>
        <CajaWidget todayIso={TODAY} />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('pago-row-7')).toBeInTheDocument()
      expect(screen.getByTestId('pago-row-8')).toBeInTheDocument()
    })

    expect(screen.getByTestId('pago-retirado-na-7')).toBeInTheDocument()
    expect(screen.queryByTestId('pago-retirado-toggle-7')).not.toBeInTheDocument()
    expect(screen.getByTestId('pago-retirado-toggle-8')).toBeInTheDocument()
  })
})
