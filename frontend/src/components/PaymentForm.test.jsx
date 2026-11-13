import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PaymentForm from './PaymentForm'

vi.mock('../services/api', () => ({
  createPago: vi.fn(),
  getTipoCambioActual: vi.fn().mockResolvedValue({ tipoCambio: 1000 }),
  fetchOccupiedRoomsToday: vi.fn().mockResolvedValue({
    data: [
      {
        reservationId: 11,
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

import { createPago, getClientBillingProfile } from '../services/api'

describe('PaymentForm facturación', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createPago.mockResolvedValue({ id: 1, codigo: 'A001' })
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
    expect(screen.getByLabelText(/^Motivo/i)).toHaveValue('Pago')
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
})
