const {
  shouldIncludeVirtualRooms,
  inheritTagsFromComponents,
  formatVirtualRoomForAvailability
} = require('../../src/utils/virtualRoomAvailability');

describe('virtualRoomAvailability', () => {
  test('con habitación específica no incluye virtuales', () => {
    expect(shouldIncludeVirtualRooms(8)).toBe(false);
    expect(shouldIncludeVirtualRooms('8')).toBe(false);
  });

  test('sin habitación específica sí incluye virtuales', () => {
    expect(shouldIncludeVirtualRooms(null)).toBe(true);
    expect(shouldIncludeVirtualRooms(undefined)).toBe(true);
    expect(shouldIncludeVirtualRooms('')).toBe(true);
  });

  test('hereda unión de tags de componentes (sin duplicados)', () => {
    const tags = inheritTagsFromComponents([
      { room: { tags: [{ id: 1, name: 'Balcón' }, { id: 2, name: 'Vista' }] } },
      { room: { tags: [{ id: 2, name: 'Vista' }, { id: 3, name: 'Planta' }] } },
      { room: { tags: undefined } },
      {}
    ]);
    expect(tags.map((t) => t.id)).toEqual([1, 2, 3]);
    expect(tags.map((t) => t.name)).toEqual(['Balcón', 'Vista', 'Planta']);
  });

  test('sin tags en componentes → array vacío', () => {
    expect(inheritTagsFromComponents([])).toEqual([]);
    expect(inheritTagsFromComponents([{ room: {} }])).toEqual([]);
  });

  test('formatVirtualRoomForAvailability incluye tags heredados e isVirtual', () => {
    const formatted = formatVirtualRoomForAvailability({
      id: 2,
      name: '8-9 (cuadruple)',
      description: 'conectable',
      maxPeople: 4,
      roomType: { id: 9, name: 'Cuádruple' },
      components: [
        { roomId: 8, room: { tags: [{ id: 1, name: 'Balcón' }] } },
        { roomId: 9, room: { tags: [{ id: 4, name: 'Escalera' }] } }
      ]
    });
    expect(formatted.id).toBe('virtual_2');
    expect(formatted.isVirtual).toBe(true);
    expect(formatted.virtualRoomId).toBe(2);
    expect(formatted.tags.map((t) => t.name)).toEqual(['Balcón', 'Escalera']);
  });
});
