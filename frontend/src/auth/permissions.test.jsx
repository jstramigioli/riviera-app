import { describe, it, expect } from 'vitest'
import { hasPermission, ROLES } from './permissions'

describe('hasPermission — reportes (Estadísticas)', () => {
  it('permite ADMIN y PROPIETARIO', () => {
    expect(hasPermission(ROLES.ADMIN, 'reportes')).toBe(true)
    expect(hasPermission(ROLES.PROPIETARIO, 'reportes')).toBe(true)
  })

  it('bloquea GERENCIA y RECEPCION', () => {
    expect(hasPermission(ROLES.GERENCIA, 'reportes')).toBe(false)
    expect(hasPermission(ROLES.RECEPCION, 'reportes')).toBe(false)
  })
})
