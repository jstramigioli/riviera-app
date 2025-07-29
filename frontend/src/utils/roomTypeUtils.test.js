/* eslint-env jest */
import { describe, it, expect } from 'vitest';
import { 
  ROOM_TYPE_CAPACITIES, 
  getRoomTypeCapacity, 
  getRoomTypeColor, 
  getRoomTypeLabel 
} from './roomTypeUtils';

describe('roomTypeUtils', () => {
  describe('ROOM_TYPE_CAPACITIES', () => {
    it('should have correct capacities for all room types', () => {
      expect(ROOM_TYPE_CAPACITIES.single).toBe(1);
      expect(ROOM_TYPE_CAPACITIES.doble).toBe(2);
      expect(ROOM_TYPE_CAPACITIES.triple).toBe(3);
      expect(ROOM_TYPE_CAPACITIES.cuadruple).toBe(4);
      expect(ROOM_TYPE_CAPACITIES.quintuple).toBe(5);
      expect(ROOM_TYPE_CAPACITIES.sextuple).toBe(6);
      expect(ROOM_TYPE_CAPACITIES['departamento El Romerito']).toBe(4);
      expect(ROOM_TYPE_CAPACITIES['departamento El Tilo']).toBe(4);
      expect(ROOM_TYPE_CAPACITIES['departamento Via 1']).toBe(4);
      expect(ROOM_TYPE_CAPACITIES['departamento La Esquinita']).toBe(4);
    });
  });

  describe('getRoomTypeCapacity', () => {
    it('should return correct capacity for known room types', () => {
      expect(getRoomTypeCapacity('single')).toBe(1);
      expect(getRoomTypeCapacity('doble')).toBe(2);
      expect(getRoomTypeCapacity('triple')).toBe(3);
      expect(getRoomTypeCapacity('cuadruple')).toBe(4);
      expect(getRoomTypeCapacity('quintuple')).toBe(5);
      expect(getRoomTypeCapacity('sextuple')).toBe(6);
      expect(getRoomTypeCapacity('departamento El Romerito')).toBe(4);
      expect(getRoomTypeCapacity('departamento El Tilo')).toBe(4);
      expect(getRoomTypeCapacity('departamento Via 1')).toBe(4);
      expect(getRoomTypeCapacity('departamento La Esquinita')).toBe(4);
    });

    it('should return default capacity (1) for unknown room types', () => {
      expect(getRoomTypeCapacity('unknown')).toBe(1);
      expect(getRoomTypeCapacity('')).toBe(1);
      expect(getRoomTypeCapacity(null)).toBe(1);
      expect(getRoomTypeCapacity(undefined)).toBe(1);
    });
  });

  describe('getRoomTypeColor', () => {
    it('should return correct colors for known room types', () => {
      expect(getRoomTypeColor('single')).toBe('#17a2b8');
      expect(getRoomTypeColor('doble')).toBe('#28a745');
      expect(getRoomTypeColor('triple')).toBe('#ffc107');
      expect(getRoomTypeColor('cuadruple')).toBe('#fd7e14');
      expect(getRoomTypeColor('quintuple')).toBe('#6f42c1');
      expect(getRoomTypeColor('sextuple')).toBe('#e83e8c');
      expect(getRoomTypeColor('departamento El Romerito')).toBe('#20c997');
      expect(getRoomTypeColor('departamento El Tilo')).toBe('#6f42c1');
      expect(getRoomTypeColor('departamento Via 1')).toBe('#fd7e14');
      expect(getRoomTypeColor('departamento La Esquinita')).toBe('#20c997');
    });

    it('should return default color for unknown room types', () => {
      expect(getRoomTypeColor('unknown')).toBe('#6c757d');
      expect(getRoomTypeColor('')).toBe('#6c757d');
      expect(getRoomTypeColor(null)).toBe('#6c757d');
      expect(getRoomTypeColor(undefined)).toBe('#6c757d');
    });
  });

  describe('getRoomTypeLabel', () => {
    it('should return correct labels for known room types', () => {
      expect(getRoomTypeLabel('single')).toBe('Individual');
      expect(getRoomTypeLabel('doble')).toBe('Doble');
      expect(getRoomTypeLabel('triple')).toBe('Triple');
      expect(getRoomTypeLabel('cuadruple')).toBe('Cuádruple');
      expect(getRoomTypeLabel('quintuple')).toBe('Quíntuple');
      expect(getRoomTypeLabel('sextuple')).toBe('Séxtuple');
      expect(getRoomTypeLabel('departamento El Romerito')).toBe('Depto. El Romerito');
      expect(getRoomTypeLabel('departamento El Tilo')).toBe('Depto. El Tilo');
      expect(getRoomTypeLabel('departamento Via 1')).toBe('Depto. Via 1');
      expect(getRoomTypeLabel('departamento La Esquinita')).toBe('Depto. La Esquinita');
    });

    it('should return original name for unknown room types', () => {
      expect(getRoomTypeLabel('unknown')).toBe('unknown');
      expect(getRoomTypeLabel('custom-room')).toBe('custom-room');
      expect(getRoomTypeLabel('')).toBe('');
      expect(getRoomTypeLabel(null)).toBe(null);
      expect(getRoomTypeLabel(undefined)).toBe(undefined);
    });
  });

  describe('integration tests', () => {
    it('should handle all room types consistently', () => {
      const roomTypes = [
        'single', 'doble', 'triple', 'cuadruple', 'quintuple', 'sextuple',
        'departamento El Romerito', 'departamento El Tilo', 
        'departamento Via 1', 'departamento La Esquinita'
      ];

      roomTypes.forEach(roomType => {
        const capacity = getRoomTypeCapacity(roomType);
        const color = getRoomTypeColor(roomType);
        const label = getRoomTypeLabel(roomType);

        expect(typeof capacity).toBe('number');
        expect(capacity).toBeGreaterThan(0);
        expect(typeof color).toBe('string');
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
      });
    });

    it('should handle edge cases gracefully', () => {
      const edgeCases = ['', null, undefined, 'UNKNOWN', 'custom-room-type'];

      edgeCases.forEach(edgeCase => {
        expect(() => getRoomTypeCapacity(edgeCase)).not.toThrow();
        expect(() => getRoomTypeColor(edgeCase)).not.toThrow();
        expect(() => getRoomTypeLabel(edgeCase)).not.toThrow();
      });
    });
  });
}); 