import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import EstadoFinancieroTab from './EstadoFinancieroTab'

vi.mock('../../hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    confirm: vi.fn().mockResolvedValue(true),
    confirmDialog: null
  })
}))

vi.mock('../../hooks/useAppNotice', () => ({
  useAppNotice: () => ({
    notify: vi.fn(),
    noticeDialog: null
  })
}))

vi.mock('../../services/api', () => ({
  fetchPaymentMethodConfigs: vi.fn().mockResolvedValue([
    { id: 1, label: 'Efectivo' },
    { id: 2, label: 'Transferencia' }
  ])
}))

vi.mock('../PaymentForm', () => ({
  default: () => null
}))

vi.mock('./LiquidacionPrint', () => ({
  default: () => null
}))

const summary = {
  resumen: {
    totalCargos: 100000,
    totalPagos: 45000,
    totalDescuentos: 5000,
    saldo: 50000,
    estadoPago: 'PENDIENTE'
  },
  cargos: {
    items: [
      {
        id: 1,
        descripcion: 'Alojamiento noche 1',
        monto: 100000,
        fecha: '2026-11-10',
        roomTypeId: 1,
        serviceTypeId: 1
      }
    ],
    porTipo: {
      ALOJAMIENTO: {
        codigo: 'ALOJAMIENTO',
        nombre: 'Alojamiento',
        total: 100000,
        items: [
          {
            id: 1,
            descripcion: 'Alojamiento noche 1',
            monto: 100000,
            fecha: '2026-11-10',
            roomTypeId: 1,
            serviceTypeId: 1
          }
        ]
      }
    }
  },
  pagos: {
    items: [
      {
        id: 10,
        codigo: 'A010',
        fecha: '2026-11-11T12:00:00.000Z',
        monto: 45000,
        montoARS: 45000,
        moneda: 'ARS',
        metodo: 'Efectivo',
        motivo: 'Pago',
        notas: null,
        discountApplication: {
          id: 3,
          montoARS: 5000,
          porcentaje: 10,
          tipo: 'PAYMENT_METHOD',
          notas: 'Descuento Efectivo'
        }
      }
    ]
  },
  descuentos: {
    items: [
      {
        id: 3,
        montoARS: 5000,
        porcentaje: 10,
        tipo: 'PAYMENT_METHOD',
        notas: 'Descuento Efectivo'
      }
    ]
  }
}

describe('EstadoFinancieroTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: {} })
    })
  })

  it('calcula saldo con descuentos y muestra panel resumen', async () => {
    render(
      <EstadoFinancieroTab
        reservation={{ id: 22, status: 'INGRESADA', checkOut: '2099-12-31' }}
        financialSummary={summary}
        loadingFinancial={false}
        formatDate={(d) => String(d).slice(0, 10)}
        formatCurrency={(n) => `$${Number(n).toLocaleString('es-AR')}`}
        onFinancialChange={vi.fn()}
        onAddCargo={vi.fn()}
        onUpdateCargo={vi.fn()}
        onDeleteCargo={vi.fn()}
        onUpdatePago={vi.fn()}
        onDeletePago={vi.fn()}
      />
    )

    expect(screen.getByTestId('financial-saldo')).toHaveTextContent('50.000')
    expect(screen.getByTestId('summary-total-cargos')).toHaveTextContent('100.000')
    expect(screen.getByTestId('summary-total-pagos')).toHaveTextContent('45.000')
    expect(screen.getByTestId('summary-total-descuentos')).toHaveTextContent('5.000')
    expect(screen.getByTestId('financial-summary-panel')).toBeInTheDocument()
    expect(screen.getByTestId('summary-cargos-breakdown')).toHaveTextContent(/Alojamiento/)
    expect(screen.getByTestId('saldo-icon-pending')).toBeInTheDocument()
    expect(screen.getByTestId('financial-saldo-estado')).toHaveTextContent(/Pendiente/)
  })

  it('muestra check verde si está pagado y alerta roja si vencido tras check-out', () => {
    const paid = {
      ...summary,
      resumen: { ...summary.resumen, totalPagos: 100000, totalDescuentos: 0, saldo: 0 }
    }
    const { rerender } = render(
      <EstadoFinancieroTab
        reservation={{ id: 22, status: 'INGRESADA' }}
        financialSummary={paid}
        loadingFinancial={false}
        formatDate={(d) => String(d).slice(0, 10)}
        formatCurrency={(n) => `$${Number(n).toLocaleString('es-AR')}`}
        onFinancialChange={vi.fn()}
      />
    )
    expect(screen.getByTestId('saldo-icon-paid')).toBeInTheDocument()
    expect(screen.getByTestId('financial-saldo-block')).toHaveAttribute('data-status', 'PAGADO')

    rerender(
      <EstadoFinancieroTab
        reservation={{ id: 22, status: 'FINALIZADA', checkOut: '2020-01-01' }}
        financialSummary={summary}
        loadingFinancial={false}
        formatDate={(d) => String(d).slice(0, 10)}
        formatCurrency={(n) => `$${Number(n).toLocaleString('es-AR')}`}
        onFinancialChange={vi.fn()}
      />
    )
    expect(screen.getByTestId('saldo-icon-overdue')).toBeInTheDocument()
    expect(screen.getByTestId('financial-saldo-estado')).toHaveTextContent(/vencido/i)
  })

  it('muestra pagos en tabla editable y guarda cambios', async () => {
    const onUpdatePago = vi.fn().mockResolvedValue({})
    render(
      <EstadoFinancieroTab
        reservation={{ id: 22 }}
        financialSummary={summary}
        loadingFinancial={false}
        formatDate={(d) => String(d).slice(0, 10)}
        formatCurrency={(n) => `$${Number(n).toLocaleString('es-AR')}`}
        onFinancialChange={vi.fn()}
        onAddCargo={vi.fn()}
        onUpdateCargo={vi.fn()}
        onDeleteCargo={vi.fn()}
        onUpdatePago={onUpdatePago}
        onDeletePago={vi.fn()}
      />
    )

    expect(screen.getByTestId('financial-pagos-table')).toBeInTheDocument()
    expect(screen.getByText('A010')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('pago-edit-10'))
    const monto = screen.getByTestId('pago-edit-monto-10')
    fireEvent.change(monto, { target: { value: '40000' } })
    fireEvent.click(screen.getByTestId('pago-save-10'))

    await waitFor(() =>
      expect(onUpdatePago).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ monto: 40000, moneda: 'ARS', metodo: 'Efectivo' })
      )
    )
  })

  it('si el resumen no trae saldo, usa cargos − pagos − descuentos', () => {
    const withoutSaldo = {
      ...summary,
      resumen: {
        totalCargos: 100000,
        totalPagos: 45000,
        totalDescuentos: 5000
      }
    }
    render(
      <EstadoFinancieroTab
        reservation={{ id: 22 }}
        financialSummary={withoutSaldo}
        loadingFinancial={false}
        formatDate={(d) => String(d).slice(0, 10)}
        formatCurrency={(n) => `$${Number(n).toLocaleString('es-AR')}`}
        onFinancialChange={vi.fn()}
      />
    )
    expect(screen.getByTestId('financial-saldo')).toHaveTextContent('50.000')
  })
})
