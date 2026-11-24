import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CobroForm from './CobroForm'

vi.mock('../services/api', () => ({
  createCobro: vi.fn(),
  createAccountCobro: vi.fn(),
  createClientMultiCobro: vi.fn(),
  updateCobro: vi.fn(),
  uploadCobroAdjuntos: vi.fn(),
  updateReservationStatus: vi.fn().mockResolvedValue({ id: 22, status: 'CONFIRMADA' }),
  getTipoCambioActual: vi.fn().mockResolvedValue({ tipoCambio: 1000 }),
  previewPromotion: vi.fn().mockResolvedValue({ aplica: false }),
  fetchPaymentMethodConfigs: vi.fn().mockResolvedValue([
    {
      id: 1,
      code: 'EFECTIVO',
      label: 'Efectivo',
      requiereFacturacion: false,
      descuentoActivo: true,
      descuentoValor: 10,
      aplicaEnSeña: true
    },
    {
      id: 2,
      code: 'TRANSFERENCIA',
      label: 'Transferencia',
      requiereFacturacion: true,
      descuentoActivo: false,
      descuentoValor: 0,
      aplicaEnSeña: true
    },
    {
      id: 3,
      code: 'TARJETA_DEBITO',
      label: 'Tarjeta Debito',
      requiereFacturacion: true,
      descuentoActivo: false,
      descuentoValor: 0,
      aplicaEnSeña: true
    },
    {
      id: 4,
      code: 'TARJETA_CREDITO',
      label: 'Tarjeta Credito',
      requiereFacturacion: true,
      descuentoActivo: false,
      descuentoValor: 0,
      aplicaEnSeña: true
    }
  ]),
  fetchAccountResumen: vi.fn().mockResolvedValue({ resumen: { saldo: 100000 } }),
  fetchAccountCobros: vi.fn().mockResolvedValue([]),
  getReservationFinancialSummary: vi.fn().mockResolvedValue({
    resumen: { saldo: 100000, totalCargos: 100000, totalCobros: 0, totalDescuentos: 0 },
    cobros: {
      items: [
        {
          id: 77,
          codigo: 'A010',
          metodo: 'Efectivo',
          motivo: 'Cobro',
          montoARS: 90000,
          discountApplication: { id: 1, montoARS: 10000, activo: true }
        }
      ]
    },
    descuentos: { items: [] }
  }),
  fetchCuentasParaCobro: vi.fn().mockResolvedValue({
    data: [
      {
        reservationId: 11,
        accountId: 101,
        roomName: '101',
        clientId: 5,
        clientLastName: 'Pérez',
        label: '101 - Pérez',
        accountKind: 'RESERVATION',
        origen: 'RESERVA',
        status: 'CONFIRMADA'
      },
      {
        reservationId: 22,
        accountId: 202,
        roomName: '202',
        clientId: 5,
        clientLastName: 'Pérez',
        label: '202 - Pérez',
        accountKind: 'RESERVATION',
        origen: 'RESERVA',
        status: 'CONFIRMADA'
      },
      {
        reservationId: null,
        accountId: 303,
        label: 'Bar viejo',
        clientId: 5,
        accountKind: 'EXTERNAL',
        origen: 'EXTERNA'
      }
    ]
  }),
  createExternalAccount: vi.fn().mockResolvedValue({
    success: true,
    data: { id: 999, label: 'Bar mesa 3' }
  }),
  fetchReservation: vi.fn().mockResolvedValue({
    id: 22,
    status: 'CONFIRMADA',
    mainClientId: 5,
    mainClient: { id: 5, firstName: 'Ana', lastName: 'Pérez' },
    account: { id: 202 }
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
  createCobro,
  createClientMultiCobro,
  createExternalAccount,
  updateCobro,
  updateReservationStatus,
  fetchCuentasParaCobro,
  getClientBillingProfile,
  previewPromotion,
  uploadCobroAdjuntos
} from '../services/api'
import { todayLocalDateInputValue } from '../constants/billing'

describe('CobroForm facturación', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createCobro.mockResolvedValue({ id: 1, codigo: 'A001', adjuntos: [] })
    createClientMultiCobro.mockResolvedValue({ id: 2, codigo: 'A002', adjuntos: [] })
    updateCobro.mockResolvedValue({ id: 10, codigo: 'A010' })
    uploadCobroAdjuntos.mockResolvedValue([])
    previewPromotion.mockResolvedValue({ aplica: false })
  })

  it('fecha del cobro defaultea a hoy', async () => {
    render(<CobroForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)
    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())
    expect(screen.getByTestId('payment-fecha')).toHaveValue(todayLocalDateInputValue())
  })

  it('layout: fecha+reserva en fila; sin títulos Destino/Datos; método|moneda encima de montos', async () => {
    render(<CobroForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)
    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())

    const row = screen.getByTestId('payment-fecha-destino-row')
    const fecha = screen.getByTestId('payment-fecha')
    const imputa = screen.getByTestId('payment-imputa-label')
    const metodoMoneda = screen.getByTestId('payment-metodo-moneda-row')
    const montos = screen.getByTestId('payment-montos-zone')
    const datos = screen.getByRole('region', { name: 'Datos del cobro' })

    expect(row.contains(fecha)).toBe(true)
    expect(row.contains(imputa)).toBe(true)
    expect(fecha.compareDocumentPosition(imputa) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /Destino del cobro/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Datos del cobro/i })).not.toBeInTheDocument()
    expect(datos.contains(metodoMoneda)).toBe(true)
    expect(datos.contains(montos)).toBe(true)
    expect(
      metodoMoneda.compareDocumentPosition(montos) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(metodoMoneda.querySelector('#payment-metodo')).not.toBeNull()
    expect(metodoMoneda.querySelector('#payment-moneda')).not.toBeNull()

    fireEvent.change(screen.getByLabelText(/Método de pago/i), {
      target: { value: 'Transferencia' }
    })
    expect(screen.getByLabelText(/^Comprobante$/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Comprobante \(opcional\)/i)).not.toBeInTheDocument()
  })

  it('en modo edición prefills y llama updateCobro', async () => {
    const onSuccess = vi.fn()
    render(
      <CobroForm
        reservaId={22}
        initialCobro={{
          id: 10,
          monto: 45000,
          moneda: 'ARS',
          metodo: 'Efectivo',
          motivo: 'Cobro',
          fecha: '2026-11-11T15:00:00.000Z'
        }}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />
    )

    expect(screen.getByRole('heading', { name: /Editar cobro/i })).toBeInTheDocument()
    expect(screen.getByTestId('payment-fecha')).toHaveValue('2026-11-11')
    expect(screen.getByTestId('payment-monto-ingresado')).toHaveValue(45000)

    fireEvent.change(screen.getByTestId('payment-monto-ingresado'), {
      target: { value: '40000' }
    })
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/i }))

    await waitFor(() =>
      expect(updateCobro).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ monto: 40000, metodo: 'Efectivo', fecha: expect.any(String) })
      )
    )
    expect(createCobro).not.toHaveBeenCalled()
    expect(onSuccess).toHaveBeenCalled()
  })

  it('muestra medios del backend sin porcentaje hardcodeado en el label', async () => {
    render(<CobroForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)

    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())

    const metodo = screen.getByLabelText(/Método de pago/i)
    const efectivo = Array.from(metodo.querySelectorAll('option')).find(
      (o) => o.value === 'Efectivo'
    )
    expect(efectivo).toBeTruthy()
    expect(efectivo.textContent).toBe('Efectivo')
    expect(efectivo.textContent).not.toMatch(/10%|−10%|-10%/)
  })

  it('resumen en modo ingresado muestra monto saldado y equivalente ARS solo en otra moneda', async () => {
    previewPromotion.mockImplementation(async (payload) => {
      if (payload.mode === 'received') {
        return {
          aplica: true,
          dineroARS: 90000,
          descuentoARS: 10000,
          creditoARS: 100000,
          porcentaje: 10,
          appliedRules: [
            {
              promotionRuleId: 1,
              label: 'Descuento Efectivo',
              code: 'EF10',
              montoARS: 10000,
              porcentaje: 10,
              modality: 'AUTO'
            }
          ]
        }
      }
      return { aplica: false }
    })

    render(<CobroForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)
    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText(/Monto ingresado/i), {
      target: { value: '90000' }
    })

    await waitFor(() => {
      expect(screen.getByTestId('summary-monto-saldado')).toHaveTextContent(/100\.000/)
    })
    expect(screen.queryByTestId('summary-equivalente-ars')).not.toBeInTheDocument()
    expect(screen.queryByText(/Equivalente en ARS/i)).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Moneda/i), { target: { value: 'USD' } })
    fireEvent.change(screen.getByTestId('payment-monto-ingresado'), {
      target: { value: '90' }
    })

    await waitFor(() => {
      expect(screen.getByTestId('summary-equivalente-ars')).toBeInTheDocument()
    })
    expect(screen.getByTestId('payment-fx-sync')).toBeInTheDocument()
    expect(screen.getByTestId('payment-equiv-ars')).toBeInTheDocument()
    expect(screen.getByText(/Equivalente en ARS/i)).toBeInTheDocument()
    expect(screen.getByTestId('summary-monto-saldado')).toBeInTheDocument()
  })

  it('monto a saldar calcula abono en el resumen sticky (sin banner verde)', async () => {
    previewPromotion.mockImplementation(async (payload) => {
      if (payload.mode === 'settle') {
        return {
          aplica: true,
          dineroARS: 90000,
          descuentoARS: 10000,
          creditoARS: 100000,
          porcentaje: 10,
          appliedRules: [
            {
              promotionRuleId: 1,
              label: 'Descuento Efectivo',
              code: 'EF10',
              montoARS: 10000,
              porcentaje: 10,
              modality: 'AUTO'
            }
          ]
        }
      }
      return { aplica: false }
    })

    render(<CobroForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)
    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())

    expect(screen.queryByTestId('payment-tender-banner')).not.toBeInTheDocument()
    expect(screen.getByTestId('payment-summary')).toHaveTextContent('—')

    fireEvent.change(screen.getByLabelText(/Monto a saldar/i), {
      target: { value: '100000' }
    })

    await waitFor(() => {
      expect(screen.getByTestId('payment-summary')).toHaveTextContent(/90\.000/)
    })
    await waitFor(() => {
      expect(screen.getByTestId('payment-monto-ingresado')).toHaveValue(90000)
    })
    expect(screen.getByTestId('payment-monto-saldar')).toHaveValue(100000)
    expect(screen.getByText(/Cliente abona/i)).toBeInTheDocument()
    expect(screen.getByTestId('summary-monto-saldado')).toHaveTextContent(/100\.000/)
    expect(screen.queryByText(/El cliente debe abonar/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Guardar cobro/i }))
    await waitFor(() =>
      expect(createCobro).toHaveBeenCalledWith(
        22,
        expect.objectContaining({ monto: 90000, moneda: 'ARS', motivo: 'Cobro' })
      )
    )
  })

  it('monto ingresado actualiza monto a saldar según descuento', async () => {
    previewPromotion.mockImplementation(async (payload) => {
      if (payload.mode === 'received') {
        return {
          aplica: true,
          dineroARS: 9000,
          descuentoARS: 1000,
          creditoARS: 10000,
          porcentaje: 10,
          appliedRules: [
            {
              promotionRuleId: 1,
              label: 'Descuento Efectivo',
              code: 'EF10',
              montoARS: 1000,
              porcentaje: 10,
              modality: 'AUTO'
            }
          ]
        }
      }
      return { aplica: false }
    })

    render(<CobroForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)
    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText(/Monto ingresado/i), {
      target: { value: '9000' }
    })

    await waitFor(() => {
      expect(screen.getByTestId('payment-monto-saldar')).toHaveValue(10000)
    })
    expect(screen.getByTestId('payment-monto-ingresado')).toHaveValue(9000)
  })

  it('sin descuento sync 1:1 entre monto ingresado y a saldar', async () => {
    previewPromotion.mockResolvedValue({ aplica: false })

    render(<CobroForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)
    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText(/Monto a saldar/i), {
      target: { value: '50000' }
    })
    await waitFor(() => {
      expect(screen.getByTestId('payment-monto-ingresado')).toHaveValue(50000)
    })
    expect(screen.getByTestId('payment-monto-saldar')).toHaveValue(50000)

    fireEvent.change(screen.getByLabelText(/Monto ingresado/i), {
      target: { value: '12000' }
    })
    await waitFor(() => {
      expect(screen.getByTestId('payment-monto-saldar')).toHaveValue(12000)
    })
    expect(screen.getByTestId('payment-monto-ingresado')).toHaveValue(12000)
  })

  it('no muestra el help text de completar monto para ver descuentos', async () => {
    previewPromotion.mockResolvedValue({
      aplica: true,
      dineroARS: 90000,
      descuentoARS: 10000,
      creditoARS: 100000,
      porcentaje: 10,
      appliedRules: [
        {
          promotionRuleId: 1,
          label: 'Descuento Efectivo',
          code: 'EF10',
          montoARS: 10000,
          porcentaje: 10,
          modality: 'AUTO'
        }
      ]
    })

    render(<CobroForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)
    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByTestId('payment-applied-promos')).toBeInTheDocument())

    expect(
      screen.queryByText(/completá monto ingresado o a saldar/i)
    ).not.toBeInTheDocument()
  })

  it('permite elegir USD e Imputar a sin hint redundante', async () => {
    render(<CobroForm onClose={vi.fn()} onSuccess={vi.fn()} />)
    await waitFor(() => expect(fetchCuentasParaCobro).toHaveBeenCalled())

    expect(screen.queryByText(/^Cuenta \*$/)).not.toBeInTheDocument()
    expect(screen.getByTestId('payment-imputa-label')).toHaveTextContent(/Imputar a/i)
    expect(screen.queryByTestId('payment-imputa-hint')).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Elegí a qué reserva/i)
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('payment-account-search')).toBeInTheDocument()
    fireEvent.focus(screen.getByTestId('payment-account-search'))
    expect(screen.getByTestId('payment-create-external')).toBeInTheDocument()

    const moneda = screen.getByTestId('payment-moneda')
    expect(moneda).not.toBeDisabled()
    expect(screen.queryByTestId('payment-tc')).not.toBeInTheDocument()
    fireEvent.change(moneda, { target: { value: 'USD' } })
    expect(moneda).toHaveValue('USD')
    expect(screen.getByTestId('payment-moneda-tc')).toBeInTheDocument()
    expect(screen.getByTestId('payment-tc')).toBeInTheDocument()
    expect(screen.getByLabelText(/Tipo de cambio/i)).toBeInTheDocument()
    // TC junto a moneda, no dentro de Monto ingresado
    expect(screen.getByTestId('payment-fx-sync')).toBeInTheDocument()
    expect(screen.getByTestId('payment-fx-sync').querySelector('#payment-tc')).toBeNull()
    expect(screen.getByTestId('payment-moneda-tc').querySelector('#payment-tc')).not.toBeNull()
  })

  it('USD: TC junto a moneda; monto USD + equiv ARS bajo ingresado sync con saldar', async () => {
    previewPromotion.mockResolvedValue({ aplica: false })

    render(<CobroForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)
    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())

    fireEvent.change(screen.getByTestId('payment-moneda'), { target: { value: 'USD' } })
    expect(screen.getByTestId('payment-moneda-tc').querySelector('#payment-tc')).not.toBeNull()
    expect(screen.getByTestId('payment-fx-sync').querySelector('#payment-tc')).toBeNull()
    expect(screen.getByTestId('payment-fx-sync')).toBeInTheDocument()
    expect(screen.queryByTestId('payment-saldar-currency-hint')).not.toBeInTheDocument()

    // Monto USD → equiv ARS + saldar
    fireEvent.change(screen.getByTestId('payment-monto-ingresado'), {
      target: { value: '100' }
    })
    await waitFor(() => {
      expect(screen.getByTestId('payment-equiv-ars')).toHaveValue(100000)
    })
    await waitFor(() => {
      expect(screen.getByTestId('payment-monto-saldar')).toHaveValue(100000)
    })

    // Equiv ARS → monto USD + saldar
    fireEvent.change(screen.getByTestId('payment-equiv-ars'), {
      target: { value: '50000' }
    })
    await waitFor(() => {
      expect(screen.getByTestId('payment-monto-ingresado')).toHaveValue(50)
    })
    await waitFor(() => {
      expect(screen.getByTestId('payment-monto-saldar')).toHaveValue(50000)
    })

    // TC → mantiene monto USD, recalcula ARS/saldar
    fireEvent.change(screen.getByTestId('payment-tc'), { target: { value: '1200' } })
    await waitFor(() => {
      expect(screen.getByTestId('payment-equiv-ars')).toHaveValue(60000)
    })
    await waitFor(() => {
      expect(screen.getByTestId('payment-monto-saldar')).toHaveValue(60000)
    })
    expect(screen.getByTestId('payment-monto-ingresado')).toHaveValue(50)

    // Saldar ARS → monto USD + equiv
    fireEvent.change(screen.getByTestId('payment-monto-saldar'), {
      target: { value: '24000' }
    })
    await waitFor(() => {
      expect(screen.getByTestId('payment-monto-ingresado')).toHaveValue(20)
    })
    await waitFor(() => {
      expect(screen.getByTestId('payment-equiv-ars')).toHaveValue(24000)
    })
  })

  it('USD↔ARS: saldar en ARS muestra ingresado en USD sin forzar moneda', async () => {
    previewPromotion.mockResolvedValue({ aplica: false })

    render(<CobroForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)
    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())

    fireEvent.change(screen.getByTestId('payment-moneda'), { target: { value: 'USD' } })
    expect(screen.getByTestId('payment-moneda')).toHaveValue('USD')

    fireEvent.change(screen.getByLabelText(/Monto a saldar/i), {
      target: { value: '50000' }
    })
    await waitFor(() => {
      expect(screen.getByTestId('payment-monto-ingresado')).toHaveValue(50)
    })
    expect(screen.getByTestId('payment-moneda')).toHaveValue('USD')
    expect(screen.getByTestId('payment-monto-saldar')).toHaveValue(50000)
    await waitFor(() => {
      expect(screen.getByTestId('payment-equiv-ars')).toHaveValue(50000)
    })

    fireEvent.change(screen.getByTestId('payment-monto-ingresado'), {
      target: { value: '120' }
    })
    await waitFor(() => {
      expect(screen.getByTestId('payment-monto-saldar')).toHaveValue(120000)
    })
    expect(screen.getByTestId('payment-moneda')).toHaveValue('USD')

    fireEvent.click(screen.getByRole('button', { name: /Guardar cobro/i }))
    await waitFor(() =>
      expect(createCobro).toHaveBeenCalledWith(
        22,
        expect.objectContaining({ monto: 120, moneda: 'USD', tipoCambio: 1000 })
      )
    )
  })

  it('tras elegir reserva muestra chip y permite agregar otra; externa vive en el combobox', async () => {
    render(<CobroForm onClose={vi.fn()} onSuccess={vi.fn()} />)
    await waitFor(() => expect(fetchCuentasParaCobro).toHaveBeenCalled())

    const search = screen.getByTestId('payment-account-search')
    fireEvent.focus(search)
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /101 - Pérez/i })).toBeInTheDocument()
    })
    expect(screen.getByTestId('payment-create-external')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('option', { name: /101 - Pérez/i }))

    await waitFor(() => {
      expect(screen.getByTestId('payment-add-allocation')).toBeInTheDocument()
    })
    expect(screen.getByText(/101 - Pérez/i)).toBeInTheDocument()
    expect(screen.queryByTestId('payment-account-search')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('payment-add-allocation'))
    const search2 = await screen.findByTestId('payment-account-search')
    fireEvent.focus(search2)
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /202 - Pérez/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('option', { name: /202 - Pérez/i }))

    fireEvent.change(screen.getByTestId('payment-monto-ingresado'), { target: { value: '1000' } })
    expect(screen.queryByLabelText(/Monto imputado/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId('payment-alloc-hint')).not.toBeInTheDocument()
    expect(screen.queryByTestId('payment-auto-imputaciones')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Imputaciones/i })).not.toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByTestId('payment-summary-multi-accounts')).toBeInTheDocument()
    )
    fireEvent.click(screen.getByRole('button', { name: /Guardar cobro/i }))

    await waitFor(() =>
      expect(createClientMultiCobro).toHaveBeenCalledWith(
        5,
        expect.objectContaining({
          monto: 1000,
          imputaciones: expect.arrayContaining([
            expect.objectContaining({ reservaId: 11, montoARS: 500 }),
            expect.objectContaining({ reservaId: 22, montoARS: 500 })
          ])
        })
      )
    )
  })

  it('desde reserva también ofrece agregar otra imputación', async () => {
    render(<CobroForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)
    await waitFor(() => expect(fetchCuentasParaCobro).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByTestId('payment-add-allocation')).toBeInTheDocument())
    expect(screen.getByText(/202 - Pérez/i)).toBeInTheDocument()
  })

  it('resumen multi: saldos por cuenta + totales; oculto con 1 cuenta', async () => {
    previewPromotion.mockResolvedValue({
      aplica: true,
      dineroARS: 90000,
      descuentoARS: 10000,
      creditoARS: 100000,
      porcentaje: 10,
      appliedRules: [
        {
          promotionRuleId: 1,
          label: 'Descuento Efectivo',
          code: 'EF10',
          montoARS: 10000,
          porcentaje: 10,
          modality: 'AUTO'
        }
      ]
    })

    render(<CobroForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)
    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())
    fireEvent.change(screen.getByTestId('payment-monto-ingresado'), {
      target: { value: '90000' }
    })
    await waitFor(() =>
      expect(screen.getByTestId('summary-monto-saldado')).toHaveTextContent(/100\.000/)
    )
    expect(screen.queryByTestId('payment-summary-multi-accounts')).not.toBeInTheDocument()
    expect(screen.queryByTestId('payment-summary-por-cuenta')).not.toBeInTheDocument()
    expect(screen.getByTestId('summary-saldo')).toHaveTextContent(/Nuevo saldo/)

    fireEvent.click(screen.getByTestId('payment-add-allocation'))
    const search = await screen.findByTestId('payment-account-search')
    fireEvent.focus(search)
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /101 - Pérez/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('option', { name: /101 - Pérez/i }))

    const multi = await screen.findByTestId('payment-summary-multi-accounts')
    expect(screen.getByTestId('payment-summary-saldo-original')).toBeInTheDocument()
    expect(screen.getByTestId('payment-summary-monto-saldado')).toBeInTheDocument()
    expect(screen.getByTestId('payment-summary-saldo-restante')).toBeInTheDocument()
    // 100000 crédito / 2 saldos iguales → 50000 c/u (no 45000 de caja)
    expect(screen.getByTestId('payment-summary-monto-saldado').textContent).toMatch(/50\.000/)
    expect(screen.getByTestId('payment-summary-monto-saldado').textContent).not.toMatch(/45\.000/)
    expect(screen.getByTestId('payment-summary-monto-saldado').textContent).toMatch(/Total/)
    expect(multi.textContent).toMatch(/Saldo original/)
    expect(multi.textContent).toMatch(/Saldo restante/)
    expect(screen.queryByRole('heading', { name: /Imputaciones/i })).not.toBeInTheDocument()
  })

  it('pide preview settlement al elegir medio aunque no haya monto', async () => {
    previewPromotion.mockResolvedValue({
      aplica: true,
      dineroARS: 90000,
      descuentoARS: 10000,
      creditoARS: 100000,
      porcentaje: 10,
      appliedRules: [
        {
          promotionRuleId: 1,
          label: 'Descuento Efectivo',
          code: 'EF10',
          montoARS: 10000,
          porcentaje: 10,
          modality: 'AUTO'
        }
      ]
    })

    render(<CobroForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)
    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())

    await waitFor(() => expect(previewPromotion).toHaveBeenCalled())
    expect(previewPromotion.mock.calls.some((c) => c[0]?.layer === 'SETTLEMENT')).toBe(
      true
    )
    await waitFor(() => {
      expect(screen.getByTestId('payment-applied-promos')).toBeInTheDocument()
    })
    expect(screen.getByText(/Descuento Efectivo/i)).toBeInTheDocument()
  })

  it('lista promos como Consulta: nombre+monto, Quitar solo opcionales, + descuento', async () => {
    previewPromotion.mockImplementation(async (payload) => {
      expect(payload.applySuggestedDefaults).toBe(true)
      expect(payload.applyAutomatics).toBeUndefined()
      if (payload.mode === 'settle') {
        return {
          aplica: true,
          dineroARS: 90000,
          descuentoARS: 10000,
          creditoARS: 100000,
          porcentaje: 10,
          appliedRules: [
            {
              promotionRuleId: 1,
              label: 'Descuento Efectivo',
              code: 'EF10',
              montoARS: 10000,
              porcentaje: 10,
              modality: 'AUTO'
            }
          ]
        }
      }
      return {
        aplica: true,
        dineroARS: 9000,
        descuentoARS: 1500,
        creditoARS: 10500,
        porcentaje: 10,
        appliedRules: [
          {
            promotionRuleId: 1,
            label: 'Descuento Efectivo',
            code: 'EF10',
            montoARS: 1000,
            porcentaje: 10,
            modality: 'AUTO'
          },
          {
            promotionRuleId: 2,
            label: 'Promo caja fija',
            code: 'FIX500',
            montoARS: 500,
            modality: 'SUGERIDA',
            defaultOn: true
          }
        ],
        suggestions: [
          {
            id: 3,
            label: 'Cortesía manual',
            modality: 'MANUAL',
            benefitType: 'PERCENT',
            benefitValue: 5
          }
        ]
      }
    })

    render(<CobroForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)
    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText(/Monto ingresado/i), { target: { value: '9000' } })

    await waitFor(() => {
      expect(screen.getByTestId('payment-applied-promos')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('payment-automatics-toggle')).not.toBeInTheDocument()
    expect(screen.getByText(/Descuento Efectivo/i)).toBeInTheDocument()
    expect(screen.getByText(/Promo caja fija/i)).toBeInTheDocument()
    expect(screen.getByText(/−1\.000,00 ARS/)).toBeInTheDocument()
    expect(screen.getByText(/−500,00 ARS/)).toBeInTheDocument()
    expect(screen.queryByTestId('payment-promo-remove-1')).not.toBeInTheDocument()
    expect(screen.getByTestId('payment-promo-remove-2')).toBeInTheDocument()
    expect(screen.getByTestId('payment-add-optional-promo')).toBeEnabled()
    expect(screen.getByTestId('payment-add-optional-promo')).toHaveTextContent(/descuento/i)
    expect(screen.queryByText(/Recibe \/ registra/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Crédito a cuenta/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Saldo restante/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('summary-saldo')).toHaveTextContent(/Nuevo saldo/)
    expect(screen.getByTestId('summary-saldo')).toHaveTextContent(/89\.500/)
  })

  it('fuerza toggle de facturación en Transferencia y muestra Factura B', async () => {
    render(<CobroForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)

    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())

    expect(screen.queryByText(/Datos adicionales/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId('payment-extras')).not.toBeInTheDocument()
    expect(screen.getByTestId('payment-sena-row')).toBeInTheDocument()
    expect(screen.getByTestId('payment-fecha-lead')).toContainElement(
      screen.getByTestId('payment-sena-row')
    )

    fireEvent.change(screen.getByLabelText(/Método de pago/i), {
      target: { value: 'Transferencia' }
    })

    const toggle = screen.getByLabelText(/Requiere facturación/i)
    expect(toggle).toBeChecked()
    expect(toggle).toBeDisabled()
    expect(toggle).toHaveAttribute('role', 'switch')
    expect(screen.queryByText(/Obligatorio para este medio de pago/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('payment-billing-toggle-row')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Factura B' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Fecha de facturación/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/^Motivo/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^Seña$/i)).not.toBeChecked()
    expect(screen.queryByPlaceholderText(/Concepto/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^Nombre/i)).toHaveValue('Ana')
    expect(screen.getByLabelText(/^Apellido/i)).toHaveValue('Pérez')
  })

  it('permite toggle manual en Efectivo y campos de Factura A', async () => {
    render(<CobroForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)

    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())

    const toggle = screen.getByLabelText(/Requiere facturación/i)
    expect(toggle).not.toBeDisabled()
    fireEvent.click(toggle)

    fireEvent.click(screen.getByRole('button', { name: 'Factura A' }))
    expect(screen.getByLabelText(/Razón social/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Condición frente al IVA/i)).toHaveValue(
      'Responsable Inscripto'
    )
    expect(screen.getByLabelText(/Domicilio comercial/i)).toBeRequired()
  })

  it('exige domicilio en Factura B y domicilio comercial en Factura A', async () => {
    render(<CobroForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)
    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText(/Método de pago/i), {
      target: { value: 'Transferencia' }
    })
    const domicilioB = screen.getByLabelText(/^Domicilio/i)
    expect(domicilioB).toBeRequired()
    expect(domicilioB).toHaveValue('Calle 1')

    fireEvent.change(domicilioB, { target: { value: '   ' } })
    fireEvent.change(screen.getByLabelText(/Monto a saldar/i), {
      target: { value: '1000' }
    })
    fireEvent.click(screen.getByRole('button', { name: /Guardar cobro/i }))
    await waitFor(() => {
      expect(screen.getByText(/El domicilio es requerido para Factura B/i)).toBeInTheDocument()
    })
    expect(createCobro).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Factura A' }))
    fireEvent.change(screen.getByLabelText(/Razón social/i), {
      target: { value: 'ACME SA' }
    })
    fireEvent.change(screen.getByLabelText(/^CUIT/i), {
      target: { value: '30-71234567-1' }
    })
    fireEvent.change(screen.getByLabelText(/Domicilio comercial/i), {
      target: { value: '   ' }
    })
    fireEvent.click(screen.getByRole('button', { name: /Guardar cobro/i }))
    await waitFor(() => {
      expect(
        screen.getByText(/El domicilio comercial es requerido para Factura A/i)
      ).toBeInTheDocument()
    })
    expect(createCobro).not.toHaveBeenCalled()
  })

  it('muestra Factura T con mismos campos que B más país emisor del pasaporte', async () => {
    render(<CobroForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)

    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())

    fireEvent.click(screen.getByLabelText(/Requiere facturación/i))
    fireEvent.click(screen.getByRole('button', { name: 'Factura T' }))

    expect(screen.getByLabelText(/^Nombre/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Apellido/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Tipo documento/i)).toHaveValue('Pasaporte')
    expect(screen.getByLabelText(/País emisor del pasaporte/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Razón social/i)).not.toBeInTheDocument()
  })

  it('tabs Nuevo cobro / Nueva devolución y toggle Seña sin desplegable Motivo', async () => {
    const onClose = vi.fn()
    render(<CobroForm reservaId={22} onClose={onClose} onSuccess={vi.fn()} />)

    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())

    expect(screen.getByRole('tab', { name: 'Nuevo cobro' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByRole('tab', { name: 'Nueva devolución' })).toHaveAttribute(
      'aria-selected',
      'false'
    )
    expect(screen.queryByLabelText(/^Motivo/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^Referencia/i)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nuevo cobro' })).toBeInTheDocument()

    const sena = screen.getByLabelText(/^Seña$/i)
    expect(sena).not.toBeChecked()
    fireEvent.click(sena)
    expect(sena).toBeChecked()

    fireEvent.change(screen.getByLabelText(/Monto ingresado/i), { target: { value: '1500' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar cobro/i }))

    await waitFor(() =>
      expect(createCobro).toHaveBeenCalledWith(
        22,
        expect.objectContaining({ monto: 1500, motivo: 'Seña' })
      )
    )
    expect(createCobro.mock.calls[0][1]).not.toHaveProperty('referencia')
    expect(screen.queryByRole('heading', { name: /Cambiar a Confirmada/i })).not.toBeInTheDocument()
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(updateReservationStatus).not.toHaveBeenCalled()
  })

  it('seña sobre prerreserva ofrece cambiar a Confirmada', async () => {
    fetchCuentasParaCobro.mockResolvedValueOnce({
      data: [
        {
          reservationId: 22,
          accountId: 202,
          roomName: '202',
          clientId: 5,
          clientLastName: 'Pérez',
          label: '202 - Pérez',
          accountKind: 'RESERVATION',
          origen: 'RESERVA',
          status: 'PENDIENTE'
        }
      ]
    })
    const onClose = vi.fn()
    const onSuccess = vi.fn()
    render(<CobroForm reservaId={22} onClose={onClose} onSuccess={onSuccess} />)

    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())
    fireEvent.click(screen.getByLabelText(/^Seña$/i))
    fireEvent.change(screen.getByLabelText(/Monto ingresado/i), { target: { value: '2000' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar cobro/i }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /Cambiar a Confirmada/i })).toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: 'Mantener en prerreserva' })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

    await waitFor(() =>
      expect(updateReservationStatus).toHaveBeenCalledWith(22, 'CONFIRMADA')
    )
    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    expect(onClose).toHaveBeenCalled()
  })

  it('seña sobre prerreserva puede mantenerse sin confirmar', async () => {
    fetchCuentasParaCobro.mockResolvedValueOnce({
      data: [
        {
          reservationId: 22,
          accountId: 202,
          roomName: '202',
          clientId: 5,
          clientLastName: 'Pérez',
          label: '202 - Pérez',
          accountKind: 'RESERVATION',
          origen: 'RESERVA',
          status: 'PENDIENTE'
        }
      ]
    })
    const onClose = vi.fn()
    render(<CobroForm reservaId={22} onClose={onClose} onSuccess={vi.fn()} />)

    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())
    fireEvent.click(screen.getByLabelText(/^Seña$/i))
    fireEvent.change(screen.getByLabelText(/Monto ingresado/i), { target: { value: '2000' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar cobro/i }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /Cambiar a Confirmada/i })).toBeInTheDocument()
    )
    fireEvent.click(screen.getByRole('button', { name: 'Mantener en prerreserva' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(updateReservationStatus).not.toHaveBeenCalled()
  })

  it('Nueva devolución envía motivo Devolución', async () => {
    render(<CobroForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)

    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('tab', { name: 'Nueva devolución' }))
    expect(screen.getByRole('heading', { name: /Nueva devolución/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/^Seña$/i)).not.toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByLabelText(/Cobro de origen/i)).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText(/Cobro de origen/i), { target: { value: '77' } })
    fireEvent.change(screen.getByLabelText(/Monto a devolver/i), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar devolución/i }))

    await waitFor(() =>
      expect(createCobro).toHaveBeenCalledWith(
        22,
        expect.objectContaining({
          monto: 500,
          motivo: 'Devolución',
          cobroOrigenId: 77
        })
      )
    )
  })

  it('devolución: sin origen sync 1:1 entre devolver y a saldar', async () => {
    render(<CobroForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)

    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('tab', { name: 'Nueva devolución' }))

    fireEvent.change(screen.getByLabelText(/Monto a devolver/i), {
      target: { value: '5000' }
    })
    await waitFor(() => {
      expect(screen.getByTestId('payment-monto-saldar')).toHaveValue(5000)
    })

    fireEvent.change(screen.getByLabelText(/Monto a saldar/i), {
      target: { value: '8000' }
    })
    await waitFor(() => {
      expect(screen.getByTestId('payment-monto-ingresado')).toHaveValue(8000)
    })
  })

  it('devolución: monto a saldar calcula efectivo según descuento del origen', async () => {
    render(<CobroForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)

    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('tab', { name: 'Nueva devolución' }))

    await waitFor(() => {
      expect(screen.getByLabelText(/Cobro de origen/i)).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText(/Cobro de origen/i), { target: { value: '77' } })
    fireEvent.change(screen.getByLabelText(/Monto a saldar/i), {
      target: { value: '100000' }
    })

    await waitFor(() => {
      expect(screen.getByTestId('payment-monto-ingresado')).toHaveValue(90000)
    })
    expect(screen.getByTestId('payment-summary')).toHaveTextContent(/Devolver al cliente/)
    expect(screen.getByTestId('payment-summary')).toHaveTextContent(/90\.000/)

    fireEvent.click(screen.getByRole('button', { name: /Guardar devolución/i }))
    await waitFor(() =>
      expect(createCobro).toHaveBeenCalledWith(
        22,
        expect.objectContaining({
          monto: 90000,
          motivo: 'Devolución',
          cobroOrigenId: 77
        })
      )
    )
  })

  it('sin reservaId busca cuentas y permite filtrar por texto', async () => {
    render(<CobroForm reservaId={null} onClose={vi.fn()} onSuccess={vi.fn()} />)

    await waitFor(() => expect(fetchCuentasParaCobro).toHaveBeenCalled())

    const search = screen.getByTestId('payment-account-search')
    fireEvent.focus(search)
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /101 - Pérez/i })).toBeInTheDocument()
    })
    fireEvent.change(search, { target: { value: 'Pérez' } })
    expect(screen.getByRole('option', { name: /101 - Pérez/i })).toBeInTheDocument()
    fireEvent.change(search, { target: { value: 'zzzz-no-match' } })
    expect(screen.getByText(/Sin coincidencias/i)).toBeInTheDocument()
  })

  it('Transferencia muestra comprobante opcional y lo sube tras crear', async () => {
    const file = new File(['pdf'], 'comp.pdf', { type: 'application/pdf' })
    uploadCobroAdjuntos.mockResolvedValue([
      { id: 9, tipo: 'COMPROBANTE', originalName: 'comp.pdf' }
    ])

    render(<CobroForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)
    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText(/Método de pago/i), {
      target: { value: 'Transferencia' }
    })

    const input = screen.getByLabelText(/^Comprobante$/i)
    expect(input).toBeInTheDocument()
    fireEvent.change(input, { target: { files: [file] } })

    fireEvent.change(screen.getByLabelText(/Monto ingresado/i), { target: { value: '2000' } })
    fireEvent.change(screen.getByLabelText(/Fecha de facturación/i), {
      target: { value: '2026-11-13' }
    })
    fireEvent.click(screen.getByRole('button', { name: /Guardar cobro/i }))

    await waitFor(() => expect(createCobro).toHaveBeenCalled())
    await waitFor(() =>
      expect(uploadCobroAdjuntos).toHaveBeenCalledWith(1, 'COMPROBANTE', [file])
    )
  })

  it('initialMode devolucion abre Nueva devolución con monto precargado', async () => {
    render(
      <CobroForm
        reservaId={22}
        initialMode="devolucion"
        initialMonto={12500}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    )

    expect(
      screen.getByRole('heading', { name: /Nueva devolución/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Nueva devolución/i })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByTestId('payment-monto-ingresado')).toHaveValue(12500)
    await waitFor(() => {
      expect(screen.getByTestId('payment-monto-saldar')).toHaveValue(12500)
    })
  })

  it('initialMode devolucion + initialMontoASaldar precarga monto a saldar', async () => {
    render(
      <CobroForm
        reservaId={22}
        initialMode="devolucion"
        initialMontoASaldar={100000}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    )

    expect(screen.getByTestId('payment-monto-saldar')).toHaveValue(100000)
    await waitFor(() => {
      expect(screen.getByTestId('payment-monto-ingresado')).toHaveValue(100000)
    })

    await waitFor(() => {
      expect(screen.getByLabelText(/Cobro de origen/i)).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText(/Cobro de origen/i), { target: { value: '77' } })

    await waitFor(() => {
      expect(screen.getByTestId('payment-monto-ingresado')).toHaveValue(90000)
    })
  })

  it('valor manual: no auto-commit al tipear; Enter/Aceptar confirma; Modificar reabre', async () => {
    previewPromotion.mockImplementation(async (payload) => {
      const benefit = payload.benefitValueByRuleId?.[40]
      const hasBenefit = benefit != null && Number(benefit) > 0
      return {
        aplica: hasBenefit,
        dineroARS: hasBenefit ? 9000 : 10000,
        descuentoARS: hasBenefit ? 1000 : 0,
        creditoARS: hasBenefit ? 10000 : 10000,
        appliedRules: hasBenefit
          ? [
              {
                promotionRuleId: 40,
                label: 'Bonif. manual',
                code: 'BM40',
                montoARS: 1000,
                modality: 'SUGERIDA',
                defaultOn: true
              }
            ]
          : [],
        suggestions: [
          {
            id: 40,
            label: 'Bonif. manual',
            modality: 'SUGERIDA',
            defaultOn: true,
            benefitType: 'FIXED',
            benefitValueManual: true
          }
        ]
      }
    })

    render(<CobroForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)
    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())
    fireEvent.change(screen.getByLabelText(/Monto ingresado/i), { target: { value: '10000' } })

    const input = await screen.findByTestId('payment-manual-promo-input-40')
    previewPromotion.mockClear()
    fireEvent.change(input, { target: { value: '1000' } })
    await new Promise((r) => setTimeout(r, 400))
    const callsWhileTyping = previewPromotion.mock.calls.filter(
      (c) => c[0]?.benefitValueByRuleId?.[40] != null
    )
    expect(callsWhileTyping).toHaveLength(0)

    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
    await waitFor(() =>
      expect(screen.getByTestId('payment-manual-promo-value-40')).toHaveTextContent('1000')
    )
    expect(screen.queryByTestId('payment-manual-promo-input-40')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(
        previewPromotion.mock.calls.some((c) => c[0]?.benefitValueByRuleId?.[40] === 1000)
      ).toBe(true)
    })

    fireEvent.click(screen.getByTestId('payment-manual-promo-modify-40'))
    const reopened = await screen.findByTestId('payment-manual-promo-input-40')
    expect(reopened).toHaveValue(1000)
    fireEvent.change(reopened, { target: { value: '500' } })
    fireEvent.click(screen.getByTestId('payment-manual-promo-accept-40'))
    await waitFor(() =>
      expect(screen.getByTestId('payment-manual-promo-value-40')).toHaveTextContent('500')
    )
  })

  it('opcional MANUAL (default-off) no se auto-aplica; entra con + Descuento y sale con X', async () => {
    previewPromotion.mockImplementation(async (payload) => {
      const selected = new Set((payload.selectedRuleIds || []).map(Number))
      const deselected = new Set((payload.deselectedRuleIds || []).map(Number))
      const appliedRules = []
      if (selected.has(30) && !deselected.has(30)) {
        appliedRules.push({
          promotionRuleId: 30,
          label: 'Cortesía off',
          code: 'OFF10',
          montoARS: 900,
          porcentaje: 10,
          modality: 'MANUAL',
          defaultOn: false
        })
      }
      return {
        aplica: appliedRules.length > 0,
        dineroARS: 9000,
        descuentoARS: appliedRules.reduce((s, r) => s + r.montoARS, 0),
        creditoARS: 9000 + appliedRules.reduce((s, r) => s + r.montoARS, 0),
        appliedRules,
        suggestions: [
          {
            id: 30,
            label: 'Cortesía off',
            modality: 'MANUAL',
            defaultOn: false,
            benefitType: 'PERCENT',
            benefitValue: 10
          }
        ]
      }
    })

    render(<CobroForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)
    await waitFor(() => expect(getClientBillingProfile).toHaveBeenCalled())
    fireEvent.change(screen.getByLabelText(/Monto ingresado/i), { target: { value: '9000' } })

    await waitFor(() => {
      expect(screen.getByTestId('payment-add-optional-promo')).toBeEnabled()
    })
    expect(screen.queryByText(/Cortesía off/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId('payment-applied-promos')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('payment-add-optional-promo'))
    fireEvent.click(screen.getByRole('button', { name: /Cortesía off/i }))

    await waitFor(() => {
      expect(screen.getByTestId('payment-applied-promos')).toBeInTheDocument()
    })
    expect(screen.getByText(/Cortesía off/i)).toBeInTheDocument()
    expect(screen.getByTestId('payment-promo-remove-30')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('payment-promo-remove-30'))
    await waitFor(() => {
      expect(screen.queryByTestId('payment-applied-promos')).not.toBeInTheDocument()
    })
    expect(screen.queryByText(/Cortesía off/i)).not.toBeInTheDocument()
  })

  it('layout workspace + extras de método en el mismo slot junto a montos', async () => {
    render(<CobroForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)
    await waitFor(() => expect(screen.getByTestId('payment-cash-tender')).toBeInTheDocument())

    const montosZone = screen.getByTestId('payment-montos-zone')
    expect(screen.getByTestId('payment-workspace')).toBeInTheDocument()
    expect(screen.getByTestId('payment-summary')).toBeInTheDocument()
    expect(screen.getByTestId('payment-summary-panel')).toBeInTheDocument()
    expect(montosZone).toContainElement(screen.getByTestId('payment-method-fields'))
    expect(montosZone).toContainElement(screen.getByTestId('payment-cash-tender'))
    expect(screen.getByTestId('payment-amount-modes')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Datos del cobro' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Medio de pago' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Descuentos' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Método de pago/i), {
      target: { value: 'Transferencia' }
    })
    expect(screen.queryByTestId('payment-cash-tender')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^Comprobante$/i)).toBeInTheDocument()
    expect(montosZone).toContainElement(screen.getByTestId('payment-method-fields'))
    expect(montosZone).toContainElement(screen.getByLabelText(/^Comprobante$/i))
    expect(screen.getByTestId('payment-summary-panel')).toBeInTheDocument()
    expect(screen.getByTestId('payment-workspace')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Datos del cobro' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Medio de pago' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Descuentos' })).toBeInTheDocument()
    expect(screen.getByText(/Requiere facturación/i)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Método de pago/i), {
      target: { value: 'Tarjeta Credito' }
    })
    expect(screen.getByLabelText(/Número de tarjeta/i)).toBeInTheDocument()
    expect(montosZone).toContainElement(screen.getByLabelText(/Número de tarjeta/i))
    expect(montosZone).toContainElement(screen.getByTestId('payment-method-fields'))
    expect(screen.getByTestId('payment-summary-panel')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Medio de pago' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Descuentos' })).toBeInTheDocument()
  })

  it('efectivo: sección movimiento + sync recibido/vuelto (A/B); transferencia la oculta (F)', async () => {
    const { createCobro } = await import('../services/api')
    render(<CobroForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)

    await waitFor(() => expect(screen.getByTestId('payment-cash-tender')).toBeInTheDocument())
    const montosZone = screen.getByTestId('payment-montos-zone')
    expect(montosZone).toContainElement(screen.getByTestId('payment-amount-modes'))
    expect(montosZone).toContainElement(screen.getByTestId('payment-cash-tender'))

    fireEvent.change(screen.getByTestId('payment-monto-ingresado'), {
      target: { value: '100000' }
    })
    await waitFor(() => {
      expect(screen.getByTestId('payment-dinero-recibido')).toHaveValue(100000)
      expect(screen.getByTestId('payment-vuelto-ars')).toHaveValue(0)
    })
    expect(screen.getByTestId('payment-vuelto-ars')).toHaveAttribute('readonly')

    fireEvent.change(screen.getByTestId('payment-dinero-recibido'), {
      target: { value: '120000' }
    })
    await waitFor(() => {
      expect(screen.getByTestId('payment-vuelto-ars')).toHaveValue(20000)
    })

    // Intentar editar vuelto no cambia el valor sugerido (solo lectura).
    fireEvent.change(screen.getByTestId('payment-vuelto-ars'), {
      target: { value: '0' }
    })
    await waitFor(() => {
      expect(screen.getByTestId('payment-vuelto-ars')).toHaveValue(20000)
    })

    fireEvent.change(screen.getByLabelText(/Método de pago/i), {
      target: { value: 'Transferencia' }
    })
    expect(screen.queryByTestId('payment-cash-tender')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Método de pago/i), {
      target: { value: 'Efectivo' }
    })
    await waitFor(() => expect(screen.getByTestId('payment-cash-tender')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('payment-dinero-recibido'), {
      target: { value: '120000' }
    })
    await waitFor(() => {
      expect(screen.getByTestId('payment-vuelto-ars')).toHaveValue(20000)
    })

    fireEvent.click(screen.getByRole('button', { name: /Guardar cobro/i }))
    await waitFor(() =>
      expect(createCobro).toHaveBeenCalledWith(
        22,
        expect.objectContaining({
          monto: 100000,
          dineroRecibido: 120000,
          vueltoARS: 20000,
          metodo: 'Efectivo'
        })
      )
    )
  })
})
