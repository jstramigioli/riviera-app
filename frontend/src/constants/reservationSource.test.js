import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SOURCE_COLORS,
  DEFAULT_RESERVATION_BAR_COLOR,
  FINISHED_RESERVATION_BAR_STYLE,
  PRERESERVA_LIGHTEN,
  contrastTextColor,
  lightenHex,
  resolveReservationBarColors
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

  it('Mostrador slate → texto blanco', () => {
    expect(contrastTextColor(DEFAULT_SOURCE_COLORS.MOSTRADOR)).toBe('#ffffff')
  })

  it('acepta #rgb corto y valores inválidos con fallback oscuro', () => {
    expect(contrastTextColor('#000')).toBe('#ffffff')
    expect(contrastTextColor('#fff')).toBe('#1a1a1a')
    expect(contrastTextColor('nope')).toBe('#1a1a1a')
    expect(contrastTextColor(null)).toBe('#1a1a1a')
  })
})

describe('resolveReservationBarColors', () => {
  it('FINALIZADA → gris del Libro', () => {
    const style = resolveReservationBarColors('WHATSAPP', 'FINALIZADA', DEFAULT_SOURCE_COLORS)
    expect(style).toMatchObject(FINISHED_RESERVATION_BAR_STYLE)
    expect(style.finished).toBe(true)
  })

  it('medio conocido → color del medio', () => {
    const style = resolveReservationBarColors('BOOKING', 'INGRESADA', DEFAULT_SOURCE_COLORS)
    expect(style.backgroundColor).toBe(DEFAULT_SOURCE_COLORS.BOOKING)
    expect(style.borderColor).toBe(DEFAULT_SOURCE_COLORS.BOOKING)
    expect(style.color).toBe('#ffffff')
    expect(style.finished).toBe(false)
  })

  it('sin medio → celeste por defecto del Libro', () => {
    const style = resolveReservationBarColors(null, 'CONFIRMADA', DEFAULT_SOURCE_COLORS)
    expect(style.backgroundColor).toBe(DEFAULT_RESERVATION_BAR_COLOR)
    expect(style.finished).toBe(false)
  })

  it('PENDIENTE (prerreserva) → tono más claro del mismo canal', () => {
    const full = resolveReservationBarColors('BOOKING', 'CONFIRMADA', DEFAULT_SOURCE_COLORS)
    const pre = resolveReservationBarColors('BOOKING', 'PENDIENTE', DEFAULT_SOURCE_COLORS)
    expect(pre.backgroundColor).toBe(
      lightenHex(DEFAULT_SOURCE_COLORS.BOOKING, PRERESERVA_LIGHTEN)
    )
    expect(pre.backgroundColor).not.toBe(full.backgroundColor)
    expect(pre.prerreserva).toBe(true)
    expect(pre.finished).toBe(false)
  })
})

describe('lightenHex', () => {
  it('mezcla hacia blanco', () => {
    expect(lightenHex('#000000', 0.5)).toBe('#808080')
    expect(lightenHex('#003580', 0)).toBe('#003580')
    expect(lightenHex('#003580', 1)).toBe('#ffffff')
  })
})
