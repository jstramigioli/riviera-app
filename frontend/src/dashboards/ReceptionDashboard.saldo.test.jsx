import { describe, it, expect } from 'vitest'
import { creditSaldoAmount } from './ReceptionDashboard'

describe('creditSaldoAmount', () => {
  it('devuelve el absoluto cuando hay saldo a favor', () => {
    expect(creditSaldoAmount({ saldo: -12500, estadoCobro: 'A_FAVOR' })).toBe(12500)
  })

  it('ignora saldo deudor o cero', () => {
    expect(creditSaldoAmount({ saldo: 8000 })).toBeNull()
    expect(creditSaldoAmount({ saldo: 0, estadoCobro: 'PAGADO' })).toBeNull()
    expect(creditSaldoAmount(null)).toBeNull()
  })
})
