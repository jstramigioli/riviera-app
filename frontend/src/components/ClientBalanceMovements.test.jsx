import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ClientBalanceMovements from './ClientBalanceMovements'

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
  updateCargo: vi.fn()
}))

vi.mock('../hooks/useAppNotice', () => ({
  useAppNotice: () => ({
    notify: vi.fn(),
    noticeDialog: null
  })
}))

const formatPrice = (n) => `$${n}`

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
})
