import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('./calendarDates', () => ({ todayIsoLocal: vi.fn(() => '2026-11-27') }));
import { todayIsoLocal } from './calendarDates';
import { comandaPresetForReservation } from './comandaPreset';

const reserva = {
  id: 97,
  segments: [
    { roomId: 9, isActive: true, startDate: '2026-12-09T00:00:00.000Z', endDate: '2026-12-11T00:00:00.000Z' }
  ]
};

describe('comandaPresetForReservation', () => {
  afterEach(() => todayIsoLocal.mockReturnValue('2026-11-27'));

  it('reserva futura: abre en el día de ingreso con la reserva y la habitación elegidas', () => {
    expect(comandaPresetForReservation(reserva)).toEqual({ reservationId: 97, roomId: 9, fecha: '2026-12-09' });
  });

  it('alojada: hoy; ya finalizada: el día de egreso', () => {
    todayIsoLocal.mockReturnValue('2026-12-10');
    expect(comandaPresetForReservation(reserva).fecha).toBe('2026-12-10');
    todayIsoLocal.mockReturnValue('2026-12-20');
    expect(comandaPresetForReservation(reserva).fecha).toBe('2026-12-11');
  });

  it('sin reserva no hay preset', () => {
    expect(comandaPresetForReservation(null)).toBeNull();
  });
});
