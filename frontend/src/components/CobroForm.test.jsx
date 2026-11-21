import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CobroForm from './CobroForm'

vi.mock('../services/api', () => ({
  createCobro: vi.fn(),
  createAccountCobro: vi.fn(),
  createClientMultiCobro: vi.fn(),
  updateCobro: vi.fn(),
  uploadCobroAdjuntos: vi.fn(),
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
        origen: 'RESERVA'
      },
      {
        reservationId: 22,
        accountId: 202,
        roomName: '202',
        clientId: 5,
        clientLastName: 'Pérez',
        label: '202 - Pérez',
        accountKind: 'RESERVATION',
        origen: 'RESERVA'
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
          notas: 'Seña parcial',
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

    await waitFor(() => expect(screen.getByTestId('payment-alloc-hint')).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('payment-monto-ingresado'), { target: { value: '1000' } })
    const montoInputs = screen.getAllByLabelText(/Monto imputado/i)
    fireEvent.change(montoInputs[0], { target: { value: '600' } })
    fireEvent.change(montoInputs[1], { target: { value: '400' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar cobro/i }))

    await waitFor(() =>
      expect(createClientMultiCobro).toHaveBeenCalledWith(
        5,
        expect.objectContaining({
          monto: 1000,
          imputaciones: expect.arrayContaining([
            expect.objectContaining({ reservaId: 11, montoARS: 600 }),
            expect.objectContaining({ reservaId: 22, montoARS: 400 })
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
    expect(screen.getByTestId('summary-saldo')).toHaveTextContent(/^Saldo:/)
  })

  it('fuerza toggle de facturación en Transferencia y muestra Factura B', async () => {
    render(<CobroForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)

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
  })

  it('tabs Nuevo cobro / Nueva devolución y toggle Seña sin desplegable Motivo', async () => {
    render(<CobroForm reservaId={22} onClose={vi.fn()} onSuccess={vi.fn()} />)

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

    const input = screen.getByLabelText(/Comprobante \(opcional\)/i)
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
})
