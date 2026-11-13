import { describe, expect, it } from 'vitest'
import {
  methodRequiresBilling,
  isCardMethod,
  emptyBillingForm,
  DEFAULT_IVA_CONDITION
} from './billing'

describe('billing constants', () => {
  it('fuerza facturación en transferencia y tarjetas', () => {
    expect(methodRequiresBilling('Transferencia')).toBe(true)
    expect(methodRequiresBilling('Tarjeta Credito')).toBe(true)
    expect(methodRequiresBilling('Tarjeta Debito')).toBe(true)
    expect(methodRequiresBilling('Efectivo')).toBe(false)
    expect(methodRequiresBilling('Mercadopago')).toBe(false)
  })

  it('detecta métodos de tarjeta', () => {
    expect(isCardMethod('Tarjeta Credito')).toBe(true)
    expect(isCardMethod('Tarjeta Debito')).toBe(true)
    expect(isCardMethod('Transferencia')).toBe(false)
  })

  it('emptyBillingForm usa Factura B e IVA default', () => {
    const form = emptyBillingForm()
    expect(form.tipo).toBe('B')
    expect(form.ivaCondition).toBe(DEFAULT_IVA_CONDITION)
    expect(form.fecha).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })
})
