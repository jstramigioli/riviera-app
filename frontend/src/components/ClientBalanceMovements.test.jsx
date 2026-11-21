import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ClientBalanceMovements from './ClientBalanceMovements'
import { deleteCargo, deletePago, updateCargo } from '../services/api'

vi.mock('./PaymentForm', () => ({
  default: ({ onClose }) => (
    <div data-testid="payment-form-mock">
      <button type="button" onClick={onClose}>
        cerrar
      </button>
    </div>
  )
}))

vi.mock('../services/api', () => ({
  updateCargo: vi.fn(),
  deleteCargo: vi.fn(),
  deletePago: vi.fn()
}))

const notify = vi.fn()
const confirm = vi.fn()

vi.mock('../hooks/useAppNotice', () => ({
  useAppNotice: () => ({
    notify,
    noticeDialog: null
  })
}))

vi.mock('../hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    confirm,
    confirmDialog: null
  })
}))

const formatPrice = (n) => `${n} ARS`

describe('ClientBalanceMovements', () => {
  const cargos = [
    {
      id: 10,
      descripcion: 'Minibar',
      monto: 1500,
      fecha: '2026-01-05T00:00:00.000Z',
      notas: 'Agua',
      accountLabel: 'Reserva #9',
      editable: true,
      subcategoriaCargoId: 3,
      subcategoriaNombre: 'Consumos'
    },
    {
      id: 11,
      descripcion: 'Alojamiento',
      monto: 80000,
      fecha: '2026-01-01T00:00:00.000Z',
      accountLabel: 'Reserva #9',
      editable: false
    }
  ]
  const pagos = [
    {
      id: 20,
      imputacionId: 200,
      codigo: 'A010',
      fecha: '2026-01-06T00:00:00.000Z',
      montoARS: 5000,
      pagoTotalARS: 5000,
      moneda: 'ARS',
      metodo: 'Efectivo',
      motivo: 'Pago',
      accountLabel: 'Reserva #9',
      esImputacionParcial: false,
      reservaId: 9,
      accountId: 1
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    confirm.mockResolvedValue(true)
    deleteCargo.mockResolvedValue({})
    deletePago.mockResolvedValue({})
    updateCargo.mockResolvedValue({})
  })

  it('muestra tablas de cargos y pagos y detalle al seleccionar', () => {
    render(
      <ClientBalanceMovements
        cargos={cargos}
        pagos={pagos}
        formatPrice={formatPrice}
        onChanged={vi.fn()}
      />
    )

    expect(screen.getByTestId('client-cargos-table')).toBeInTheDocument()
    expect(screen.getByTestId('client-pagos-table')).toBeInTheDocument()
    expect(screen.getByTestId('client-balance-detail')).toHaveTextContent(
      /Seleccioná un cargo o un pago/i
    )

    fireEvent.click(screen.getByTestId('client-cargo-row-10'))
    expect(screen.getByTestId('client-balance-detail')).toHaveTextContent(/Minibar/)
    expect(screen.getByTestId('client-balance-detail')).toHaveTextContent(/Agua/)

    fireEvent.click(screen.getByTestId('client-pago-row-20-200'))
    expect(screen.getByTestId('client-balance-detail')).toHaveTextContent(/A010/)
    expect(screen.getByTestId('client-balance-detail')).toHaveTextContent(/Efectivo/)
  })

  it('abre PaymentForm al editar un pago', () => {
    render(
      <ClientBalanceMovements
        cargos={cargos}
        pagos={pagos}
        formatPrice={formatPrice}
        onChanged={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('client-pago-edit-20'))
    expect(screen.getByTestId('payment-form-mock')).toBeInTheDocument()
  })

  it('elimina un pago tras confirmar en modal in-app', async () => {
    const onChanged = vi.fn()
    render(
      <ClientBalanceMovements
        cargos={cargos}
        pagos={pagos}
        formatPrice={formatPrice}
        onChanged={onChanged}
      />
    )

    fireEvent.click(screen.getByTestId('client-pago-delete-20'))

    await waitFor(() => {
      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Eliminar pago',
          confirmText: 'Eliminar'
        })
      )
    })
    await waitFor(() => {
      expect(deletePago).toHaveBeenCalledWith(20)
    })
    expect(onChanged).toHaveBeenCalled()
  })

  it('elimina un cargo editable tras confirmar', async () => {
    const onChanged = vi.fn()
    render(
      <ClientBalanceMovements
        cargos={cargos}
        pagos={pagos}
        formatPrice={formatPrice}
        onChanged={onChanged}
      />
    )

    fireEvent.click(screen.getByTestId('client-cargo-delete-10'))

    await waitFor(() => {
      expect(confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Eliminar cargo',
          confirmText: 'Eliminar'
        })
      )
    })
    await waitFor(() => {
      expect(deleteCargo).toHaveBeenCalledWith(10)
    })
    expect(onChanged).toHaveBeenCalled()
  })

  it('no elimina cargo de alojamiento y avisa', async () => {
    render(
      <ClientBalanceMovements
        cargos={cargos}
        pagos={pagos}
        formatPrice={formatPrice}
        onChanged={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('client-cargo-delete-11'))

    await waitFor(() => {
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'No eliminable',
          type: 'warning'
        })
      )
    })
    expect(confirm).not.toHaveBeenCalled()
    expect(deleteCargo).not.toHaveBeenCalled()
  })

  it('no llama delete si se cancela el modal', async () => {
    confirm.mockResolvedValue(false)
    render(
      <ClientBalanceMovements
        cargos={cargos}
        pagos={pagos}
        formatPrice={formatPrice}
        onChanged={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('client-pago-delete-20'))

    await waitFor(() => {
      expect(confirm).toHaveBeenCalled()
    })
    expect(deletePago).not.toHaveBeenCalled()
  })
})
