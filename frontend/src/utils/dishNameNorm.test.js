import { describe, expect, it } from 'vitest'
import { normalizeDishName } from './dishNameNorm'

describe('normalizeDishName', () => {
  it('quita acentos y unifica mayúsculas', () => {
    expect(normalizeDishName('  Milanesa Napolitána  ')).toBe('milanesa napolitana')
  })
})
