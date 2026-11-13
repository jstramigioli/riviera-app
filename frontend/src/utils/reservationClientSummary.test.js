import { describe, expect, it } from 'vitest';
import {
  formatClientDate,
  formatReservationClientSummary
} from './reservationClientSummary';

const serviceLabel = (id) => {
  const map = {
    breakfast: 'Desayuno',
    half: 'Media pensión'
  };
  return map[id] || id;
};

describe('formatClientDate', () => {
  it('formatea YYYY-MM-DD a dd/MM/yyyy', () => {
    expect(formatClientDate('2026-11-10')).toBe('10/11/2026');
  });

  it('devuelve No especificada si falta', () => {
    expect(formatClientDate(null)).toBe('No especificada');
  });
});

describe('formatReservationClientSummary', () => {
  it('arma resumen de huésped sin notas ni medio', () => {
    const text = formatReservationClientSummary(
      {
        id: 42,
        checkIn: '2026-11-10',
        checkOut: '2026-11-14',
        totalAmount: 40000,
        requiredGuests: 2,
        notes: 'Cliente VIP - NO incluir',
        source: 'WHATSAPP',
        mainClient: { id: 9, firstName: 'Ana', lastName: 'Pérez' },
        segments: [
          {
            id: 1,
            startDate: '2026-11-10',
            endDate: '2026-11-14',
            roomId: 22,
            room: { name: '22', roomType: { name: 'Doble' } },
            services: ['breakfast'],
            baseRate: 10000,
            guestCount: 2,
            isActive: true
          }
        ]
      },
      { getServiceTypeLabel: serviceLabel }
    );

    expect(text).toContain('RESERVA');
    expect(text).toContain('Nº 42');
    expect(text).toContain('Ana Pérez');
    expect(text).toContain('Check-in: 10/11/2026');
    expect(text).toContain('Check-out: 14/11/2026');
    expect(text).toContain('Noches: 4');
    expect(text).toContain('Huéspedes: 2');
    expect(text).toContain('22 - Doble');
    expect(text).toContain('Servicio: Desayuno');
    expect(text).toMatch(/TOTAL:.*40/);
    expect(text).not.toContain('VIP');
    expect(text).not.toContain('WHATSAPP');
    expect(text).not.toContain('Medio');
    expect(text).not.toContain('NOTAS');
  });

  it('lista tramos en multi-segmento', () => {
    const text = formatReservationClientSummary(
      {
        id: 7,
        checkIn: '2026-11-10',
        checkOut: '2026-11-16',
        totalAmount: 600,
        mainClient: { firstName: 'Luis', lastName: 'Gómez' },
        notes: 'interno',
        source: 'MAIL',
        segments: [
          {
            id: 1,
            startDate: '2026-11-10',
            endDate: '2026-11-12',
            roomId: 22,
            room: { name: '22', roomType: { name: 'Doble' } },
            services: ['breakfast'],
            guestCount: 2,
            isActive: true
          },
          {
            id: 2,
            startDate: '2026-11-12',
            endDate: '2026-11-16',
            roomId: 31,
            room: { name: '31', roomType: { name: 'Triple' } },
            services: ['half'],
            guestCount: 2,
            isActive: true
          }
        ]
      },
      { getServiceTypeLabel: serviceLabel }
    );

    expect(text).toContain('TRAMOS');
    expect(text).toContain('22 - Doble');
    expect(text).toContain('31 - Triple');
    expect(text).toContain('Media pensión');
    expect(text).not.toContain('interno');
    expect(text).not.toContain('MAIL');
  });
});
