/* eslint-env jest */
import { describe, it, expect } from 'vitest';
import { sortRooms } from './roomUtils';

describe('roomUtils', () => {
  describe('sortRooms', () => {
    it('should sort numeric rooms in ascending order', () => {
      const rooms = [
        { id: 1, name: '10' },
        { id: 2, name: '2' },
        { id: 3, name: '1' },
        { id: 4, name: '15' }
      ];

      const sorted = sortRooms(rooms);

      expect(sorted.map(r => r.name)).toEqual(['1', '2', '10', '15']);
    });

    it('should put numeric rooms before non-numeric rooms', () => {
      const rooms = [
        { id: 1, name: 'Departamento A' },
        { id: 2, name: '2' },
        { id: 3, name: '1' },
        { id: 4, name: 'Departamento B' }
      ];

      const sorted = sortRooms(rooms);

      expect(sorted.map(r => r.name)).toEqual(['1', '2', 'Departamento A', 'Departamento B']);
    });

    it('should handle rooms with only numeric names', () => {
      const rooms = [
        { id: 1, name: '10' },
        { id: 2, name: '2' },
        { id: 3, name: '1' }
      ];

      const sorted = sortRooms(rooms);

      expect(sorted.map(r => r.name)).toEqual(['1', '2', '10']);
    });

    it('should handle rooms with only non-numeric names', () => {
      const rooms = [
        { id: 1, name: 'Departamento B' },
        { id: 2, name: 'Departamento A' },
        { id: 3, name: 'Suite' }
      ];

      const sorted = sortRooms(rooms);

      // Los departamentos mantienen el orden original ya que no se ordenan alfabéticamente
      expect(sorted.map(r => r.name)).toEqual(['Departamento B', 'Departamento A', 'Suite']);
    });

    it('should handle empty array', () => {
      const rooms = [];
      const sorted = sortRooms(rooms);
      expect(sorted).toEqual([]);
    });

    it('should handle single room', () => {
      const rooms = [{ id: 1, name: '1' }];
      const sorted = sortRooms(rooms);
      expect(sorted).toEqual(rooms);
    });

    it('should preserve room objects structure', () => {
      const rooms = [
        { id: 1, name: '10', type: 'single' },
        { id: 2, name: '2', type: 'doble' },
        { id: 3, name: '1', type: 'triple' }
      ];

      const sorted = sortRooms(rooms);

      expect(sorted[0]).toEqual({ id: 3, name: '1', type: 'triple' });
      expect(sorted[1]).toEqual({ id: 2, name: '2', type: 'doble' });
      expect(sorted[2]).toEqual({ id: 1, name: '10', type: 'single' });
    });

    it('should handle rooms with mixed naming patterns', () => {
      const rooms = [
        { id: 1, name: 'Suite 101' },
        { id: 2, name: '2' },
        { id: 3, name: '1' },
        { id: 4, name: 'Departamento A' },
        { id: 5, name: '10' }
      ];

      const sorted = sortRooms(rooms);

      // Solo las habitaciones numéricas se ordenan, las demás mantienen el orden original
      expect(sorted.map(r => r.name)).toEqual(['1', '2', '10', 'Suite 101', 'Departamento A']);
    });

    it('should handle rooms with special characters', () => {
      const rooms = [
        { id: 1, name: '1A' },
        { id: 2, name: '2' },
        { id: 3, name: '1' },
        { id: 4, name: 'A-1' }
      ];

      const sorted = sortRooms(rooms);

      expect(sorted.map(r => r.name)).toEqual(['1', '2', '1A', 'A-1']);
    });
  });
}); 