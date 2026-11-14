import { describe, it, expect } from 'vitest'
import { roomRequirementsCompliance } from './roomRequirementsCompliance'

describe('roomRequirementsCompliance', () => {
  it('no crashea si room.tags es undefined (caso edición prefill)', () => {
    expect(() =>
      roomRequirementsCompliance({ id: 9, name: 'Hab 9' }, ['tag-1'])
    ).not.toThrow()
    const result = roomRequirementsCompliance({ id: 9 }, ['tag-1'])
    expect(result.complies).toBe(false)
  })

  it('sin tags requeridos → cumple', () => {
    expect(roomRequirementsCompliance({ tags: undefined }, []).complies).toBe(true)
  })

  it('cumple cuando la habitación tiene todas las etiquetas', () => {
    const room = {
      tags: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' }
      ]
    }
    const result = roomRequirementsCompliance(room, ['a', 'b'])
    expect(result.complies).toBe(true)
    expect(result.message).toContain('A')
  })
})
