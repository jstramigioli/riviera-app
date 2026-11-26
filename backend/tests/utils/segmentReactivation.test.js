const { selectSegmentIdsToReactivate } = require('../../src/utils/segmentReactivation');

const T_EDIT = '2026-11-01T10:00:00.000Z';
const T_CANCEL = '2026-11-05T15:30:00.000Z';

describe('selectSegmentIdsToReactivate', () => {
  test('reactiva solo el grupo desactivado por la cancelación (no tramos reemplazados antes)', () => {
    const segments = [
      { id: 1, isActive: false, updatedAt: T_EDIT }, // estadía original, reemplazada por edición
      { id: 2, isActive: false, updatedAt: T_CANCEL }, // estadía vigente al cancelar
      { id: 3, isActive: false, updatedAt: T_CANCEL } // segundo tramo vigente al cancelar
    ];
    expect(selectSegmentIdsToReactivate(segments)).toEqual([2, 3]);
  });

  test('si ya hay tramos activos no reactiva nada', () => {
    const segments = [
      { id: 1, isActive: false, updatedAt: T_CANCEL },
      { id: 2, isActive: true, updatedAt: T_EDIT }
    ];
    expect(selectSegmentIdsToReactivate(segments)).toEqual([]);
  });

  test('acepta Date y string y tolera listas vacías', () => {
    expect(selectSegmentIdsToReactivate([])).toEqual([]);
    expect(selectSegmentIdsToReactivate(null)).toEqual([]);
    expect(
      selectSegmentIdsToReactivate([{ id: 7, isActive: false, updatedAt: new Date(T_CANCEL) }])
    ).toEqual([7]);
  });
});
