import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PaymentForm from './PaymentForm'

vi.mock('../services/api', () => ({
  createPago: vi.fn(),
  createAccountPago: vi.fn(),
  uploadPagoAdjuntos: vi.fn(),
  getTipoCambioActual: vi.fn().mockResolvedValue({ tipoCambio: 1000 }),
  fetchPaymentMethodConfigs: vi.fn().mockResolvedValue([
    {
      id: 1,
      code: 'EFECTIVO',
      label: 'Efectivo',
      requiereFacturacion: false,
      descuentoActivo: true,
      descuentoValor: 10,
      aplicaEnParcial: true,
      aplicaEnSeña: true
    },
    {
      id: 2,
      code: 'TRANSFERENCIA',
      label: 'Transferencia',
      requiereFacturacion: true,
      descuentoActivo: false,
      descuentoValor: 0,
      aplicaEnParcial: true,
      aplicaEnSeña: true
    },
    {
      id: 3,
      code: 'TARJETA_DEBITO',
      label: 'Tarjeta Debito',
      requiereFacturacion: true,
      descuentoActivo: false,
      descuentoValor: 0,
      aplicaEnParcial: true,
      aplicaEnSeña: true
    },
    {
      id: 4,
      code: 'TARJETA_CREDITO',
      label: 'Tarjeta Credito',
      requiereFacturacion: true,
      descuentoActivo: false,
      descuentoValor: 0,
      aplicaEnParcial: true,
      aplicaEnSeña: true
    }
  ]),
  fetchAccountResumen: vi.fn().mockResolvedValue({ resumen: { saldo: 100000 } }),
  fetchAccountPagos: vi.fn().mockResolvedValue([]),
  getReservationFinancialSummary: vi.fn().mockResolvedValue({
    resumen: { saldo: 100000, totalCargos: 100000, totalPagos: 0, totalDescuentos: 0 },
    pagos: {
      items: [
        {
          id: 77,
          codigo: 'A010',
          metodo: 'Efectivo',
          motivo: 'Pago',
          montoARS: 90000,
          discountApplication: { id: 1, montoARS: 10000, activo: true }
        }
      ]
    },
    descuentos: { items: [] }
  }),
  fetchCuentasParaPago: vi.fn().mockResolvedValue({
    data: [
      {
        reservationId: 11,
        accountId: 101,
        roomName: '101',
        clientId: 5,
        clientLastName: 'Pérez',
        label: '101 - Pérez'
      }
    ]
  }),
  fetchReservation: vi.fn().mockResolvedValue({
    id: 22,
    mainClientId: 5,
    mainClient: { id: 5, firstName: 'Ana', lastName: 'Pérez' }
  }),
  getClientBillingProfile: vi.fn().mockResolvedValue({
    lastInvoiceType: 'B',
    firstName: 'Ana',
    lastName: 'Pérez',
    documentType: 'DNI',
    documentNumber: '30111222',
    address: 'Calle 1',
    email: 'ana@test.com',
    businessName: '',
    cuit: '',
    commercialAddress: '',
    ivaCondition: 'Responsable Inscripto',
    cardNumber: ''
  })
}))

import {
  createPago,
  fetchCuentasParaPago,
  getClientBillingProfile,
  uploadPagoAdjuntos
} from '../services/api'

describe('PaymentForm facturación', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createPago.mockResolvedValue({ id: 1, codigo: 'A001', adjuntos: [] })
    uploadPagoAdjuntos.mockResolvedValue([])
  })

  it('fuerza toggle de facturación en Transferencia y muestra Factura B', async () => {
    render(<PaymentForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)

    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText(/Método de pago/i), {
      target: { value: 'Transferencia' }
    })

    const toggle = screen.getByLabelText(/Requiere facturación/i)
    expect(toggle).toBeChecked()
    expect(toggle).toBeDisabled()

    expect(screen.getByRole('button', { name: 'Factura B' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Fecha de facturación/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/^Motivo/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^Seña$/i)).not.toBeChecked()
    expect(screen.queryByPlaceholderText(/Concepto/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^Nombre/i)).toHaveValue('Ana')
    expect(screen.getByLabelText(/^Apellido/i)).toHaveValue('Pérez')
  })

  it('permite toggle manual en Efectivo y campos de Factura A', async () => {
    render(<PaymentForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)

    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())

    const toggle = screen.getByLabelText(/Requiere facturación/i)
    expect(toggle).not.toBeDisabled()
    fireEvent.click(toggle)

    fireEvent.click(screen.getByRole('button', { name: 'Factura A' }))
    expect(screen.getByLabelText(/Razón social/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Condición frente al IVA/i)).toHaveValue(
      'Responsable Inscripto'
    )
  })

  it('tabs Nuevo pago / Nueva devolución y toggle Seña sin desplegable Motivo', async () => {
    render(<PaymentForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)

    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())

    expect(screen.getByRole('tab', { name: 'Nuevo pago' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByRole('tab', { name: 'Nueva devolución' })).toHaveAttribute(
      'aria-selected',
      'false'
    )
    expect(screen.queryByLabelText(/^Motivo/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^Referencia/i)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nuevo pago' })).toBeInTheDocument()

    const sena = screen.getByLabelText(/^Seña$/i)
    expect(sena).not.toBeChecked()
    fireEvent.click(sena)
    expect(sena).toBeChecked()

    fireEvent.change(screen.getByLabelText(/^Monto/i), { target: { value: '1500' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar pago/i }))

    await waitFor(() =>
      expect(createPago).toHaveBeenCalledWith(
        22,
        expect.objectContaining({ monto: 1500, motivo: 'Seña' })
      )
    )
    expect(createPago.mock.calls[0][1]).not.toHaveProperty('referencia')
  })

  it('Nueva devolución envía motivo Devolución', async () => {
    render(<PaymentForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)

    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('tab', { name: 'Nueva devolución' }))
    expect(screen.getByRole('heading', { name: /Nueva devolución/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/^Seña$/i)).not.toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByLabelText(/Pago de origen/i)).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText(/Pago de origen/i), { target: { value: '77' } })
    fireEvent.change(screen.getByLabelText(/^Monto/i), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar devolución/i }))

    await waitFor(() =>
      expect(createPago).toHaveBeenCalledWith(
        22,
        expect.objectContaining({
          monto: 500,
          motivo: 'Devolución',
          pagoOrigenId: 77
        })
      )
    )
  })

  it('sin reservaId carga Select con cuentas para pago', async () => {
    render(<PaymentForm reservaId={null} onClose={vi.fn()} onSuccess={vi.fn()} />)

    await waitFor(() => expect(fetchCuentasParaPago).toHaveBeenCalled())

    const select = screen.getByLabelText(/Cuenta/i)
    expect(select).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /101 - Pérez/i })).toBeInTheDocument()
    })
  })

  it('Transferencia muestra comprobante opcional y lo sube tras crear', async () => {
    const file = new File(['pdf'], 'comp.pdf', { type: 'application/pdf' })
    uploadPagoAdjuntos.mockResolvedValue([
      { id: 9, tipo: 'COMPROBANTE', originalName: 'comp.pdf' }
    ])

    render(<PaymentForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)
    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText(/Método de pago/i), {
      target: { value: 'Transferencia' }
    })

    const input = screen.getByLabelText(/Comprobante \(opcional\)/i)
    expect(input).toBeInTheDocument()
    fireEvent.change(input, { target: { files: [file] } })

    fireEvent.change(screen.getByLabelText(/^Monto/i), { target: { value: '2000' } })
    fireEvent.change(screen.getByLabelText(/Fecha de facturación/i), {
      target: { value: '2026-11-13' }
    })
    fireEvent.click(screen.getByRole('button', { name: /Guardar pago/i }))

    await waitFor(() => expect(createPago).toHaveBeenCalled())
    await waitFor(() =>
      expect(uploadPagoAdjuntos).toHaveBeenCalledWith(1, 'COMPROBANTE', [file])
    )
  })
})
