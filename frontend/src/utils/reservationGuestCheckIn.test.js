import { describe, expect, it } from 'vitest';
import {
  GUEST_CHECKIN_STATUS,
  getReservationGuestCheckInLabel,
  getReservationGuestCheckInStatus
} from './reservationGuestCheckIn';

describe('getReservationGuestCheckInStatus', () => {
  it('sin guests ni envío → no_enviado', () => {
    expect(getReservationGuestCheckInStatus({ guests: [], onlineCheckIns: [] })).toBe(
      GUEST_CHECKIN_STATUS.NO_ENVIADO
    );
  });

  it('link enviado sin guests completos → pendiente', () => {
    expect(
      getReservationGuestCheckInStatus({
        guests: [{ id: 1 }],
        checkInTokenSentAt: '2026-11-20T12:00:00.000Z',
        onlineCheckIns: [{ guestId: 1, status: 'SENT', sentAt: '2026-11-20T12:00:00.000Z' }]
      })
    ).toBe(GUEST_CHECKIN_STATUS.PENDIENTE);
  });

  it('todos los guests COMPLETED → completo', () => {
    expect(
      getReservationGuestCheckInStatus({
        guests: [{ id: 1 }, { id: 2 }],
        onlineCheckIns: [
          { guestId: 1, status: 'COMPLETED' },
          { guestId: 2, status: 'COMPLETED' }
        ]
      })
    ).toBe(GUEST_CHECKIN_STATUS.COMPLETO);
  });

  it('parcial COMPLETED → pendiente', () => {
    expect(
      getReservationGuestCheckInStatus({
        guests: [{ id: 1 }, { id: 2 }],
        onlineCheckIns: [
          { guestId: 1, status: 'COMPLETED' },
          { guestId: 2, status: 'PENDING' }
        ]
      })
    ).toBe(GUEST_CHECKIN_STATUS.PENDIENTE);
  });

  it('label en español', () => {
    expect(getReservationGuestCheckInLabel(GUEST_CHECKIN_STATUS.NO_ENVIADO)).toBe('No enviado');
    expect(getReservationGuestCheckInLabel(GUEST_CHECKIN_STATUS.PENDIENTE)).toBe('Pendiente');
    expect(getReservationGuestCheckInLabel(GUEST_CHECKIN_STATUS.COMPLETO)).toBe('Completo');
  });
});
