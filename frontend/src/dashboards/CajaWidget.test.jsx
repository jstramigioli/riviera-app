import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { MOTIVO_DEVOLUCION } from '../constants/billing'

vi.mock('../services/api', () => ({
  getAllCobros: vi.fn(),
  updateCobro: vi.fn(),
  deleteCobro: vi.fn(),
  uploadCobroAdjuntos: vi.fn(),
  deleteCobroAdjunto: vi.fn(),
  downloadCobroAdjunto: vi.fn(),
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

vi.mock('../components/CobroForm', () => ({
  default: ({ initialCobro, onClose }) => (
    <div data-testid="payment-form">
      {initialCobro?.id ? `edit-${initialCobro.id}` : 'create'}
      <button type="button" onClick={onClose}>
        cerrar
      </button>
    </div>
  ),
}))

import { getAllCobros } from '../services/api'
import CajaWidget, { pagoInHorizon } from './CajaWidget'

const TODAY = '2026-11-20'

function makeCobro({ id, fecha, codigo, motivo = 'Cobro', metodo = 'Efectivo', reservaId = 10 }) {
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
    getAllCobros.mockResolvedValue([
      makeCobro({ id: 1, fecha: '2026-11-20T10:00:00' }),
      makeCobro({ id: 2, fecha: '2026-11-18T10:00:00' }),
      makeCobro({ id: 3, fecha: '2026-11-10T10:00:00' }),
    ])
  })

  it('muestra cobros de hoy por defecto y permite cambiar a 3 días', async () => {
    render(
      <MemoryRouter>
        <CajaWidget todayIso={TODAY} />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('caja-cobros-table')).toBeInTheDocument()
    })

    expect(screen.getByTestId('cobro-row-1')).toBeInTheDocument()
    expect(screen.queryByTestId('cobro-row-2')).not.toBeInTheDocument()
    expect(screen.queryByTestId('cobro-row-3')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '3 días' }))

    await waitFor(() => {
      expect(screen.getByTestId('cobro-row-1')).toBeInTheDocument()
      expect(screen.getByTestId('cobro-row-2')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('cobro-row-3')).not.toBeInTheDocument()
  })

  it('abre crear cobro y no ofrece editar ni eliminar en el listado', async () => {
    render(
      <MemoryRouter>
        <CajaWidget todayIso={TODAY} />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('cobro-row-1')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('cobro-edit-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('cobro-delete-1')).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Acciones' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('caja-nuevo-cobro'))
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

  it('vuelve a pedir cobros cuando cambia refreshToken', async () => {
    const { rerender } = render(
      <MemoryRouter>
        <CajaWidget todayIso={TODAY} refreshToken={0} />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(getAllCobros).toHaveBeenCalledTimes(1)
    })

    getAllCobros.mockResolvedValue([
      makeCobro({ id: 99, fecha: '2026-11-20T15:00:00.000Z', codigo: 'A099' }),
    ])

    rerender(
      <MemoryRouter>
        <CajaWidget todayIso={TODAY} refreshToken={1} />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(getAllCobros).toHaveBeenCalledTimes(2)
      expect(screen.getByTestId('cobro-row-99')).toBeInTheDocument()
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
      expect(screen.getByTestId('cobro-reserva-link-1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('cobro-reserva-link-1'))

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/reservations/10')
    })
  })

  it('devoluciones no muestran toggle Retirado', async () => {
    getAllCobros.mockResolvedValue([
      makeCobro({
        id: 7,
        fecha: '2026-11-20T10:00:00',
        motivo: MOTIVO_DEVOLUCION,
        metodo: 'Efectivo',
      }),
      makeCobro({
        id: 8,
        fecha: '2026-11-20T11:00:00',
        motivo: 'Cobro',
        metodo: 'Efectivo',
      }),
    ])

    render(
      <MemoryRouter>
        <CajaWidget todayIso={TODAY} />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('cobro-row-7')).toBeInTheDocument()
      expect(screen.getByTestId('cobro-row-8')).toBeInTheDocument()
    })

    expect(screen.getByTestId('cobro-retirado-na-7')).toBeInTheDocument()
    expect(screen.queryByTestId('cobro-retirado-toggle-7')).not.toBeInTheDocument()
    expect(screen.getByTestId('cobro-retirado-toggle-8')).toBeInTheDocument()
  })
})
