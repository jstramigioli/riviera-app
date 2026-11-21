import { describe, expect, it } from 'vitest'
import { formatMoney, formatMoneyArs, formatMoneyUsd } from './formatMoney'

describe('formatMoney', () => {
  it('formatea ARS por defecto sin símbolo $', () => {
    expect(formatMoney(1234.5)).toBe('1.234,50 ARS')
    expect(formatMoney(1234.5)).not.toMatch(/\$/)
  })

  it('formatea USD con código', () => {
    expect(formatMoney(120, 'USD')).toBe('120,00 USD')
    expect(formatMoneyUsd(99.1)).toBe('99,10 USD')
  })

  it('acepta moneda en minúsculas y vacía', () => {
    expect(formatMoney(10, 'usd')).toBe('10,00 USD')
    expect(formatMoney(10, '')).toBe('10,00 ARS')
    expect(formatMoneyArs(10)).toBe('10,00 ARS')
  })

  it('soporta 0 decimales y negativos', () => {
    expect(formatMoney(1500, 'ARS', { minimumFractionDigits: 0, maximumFractionDigits: 0 })).toBe(
      '1.500 ARS'
    )
    expect(formatMoney(-12.5, 'ARS')).toBe('-12,50 ARS')
    expect(formatMoney(-12.5, 'ARS', { signed: true })).toBe('−12,50 ARS')
  })

  it('tolera valores no numéricos', () => {
    expect(formatMoney(null)).toBe('0,00 ARS')
    expect(formatMoney(undefined)).toBe('0,00 ARS')
    expect(formatMoney('abc')).toBe('0,00 ARS')
  })
})
