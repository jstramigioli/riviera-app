import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SOURCE_COLORS,
  contrastTextColor
} from './reservationSource'

describe('contrastTextColor', () => {
  it('Booking azul oscuro → texto blanco', () => {
    expect(contrastTextColor(DEFAULT_SOURCE_COLORS.BOOKING)).toBe('#ffffff')
  })

  it('WhatsApp verde claro → texto oscuro', () => {
    expect(contrastTextColor(DEFAULT_SOURCE_COLORS.WHATSAPP)).toBe('#1a1a1a')
  })

  it('Mail rojo → texto blanco', () => {
    expect(contrastTextColor(DEFAULT_SOURCE_COLORS.MAIL)).toBe('#ffffff')
  })

  it('acepta #rgb corto y valores inválidos con fallback oscuro', () => {
    expect(contrastTextColor('#000')).toBe('#ffffff')
    expect(contrastTextColor('#fff')).toBe('#1a1a1a')
    expect(contrastTextColor('nope')).toBe('#1a1a1a')
    expect(contrastTextColor(null)).toBe('#1a1a1a')
  })
})
