import { describe, expect, it } from 'vitest';
import {
  buildConsultaEditPath,
  buildConsultaEditState,
  isConsultaEditIntent,
  resolveEditReservationId
} from './consultaNavigation';

describe('consultaNavigation', () => {
  it('buildConsultaEditPath includes the reservation id', () => {
    expect(buildConsultaEditPath(42)).toBe('/consulta/42');
    expect(buildConsultaEditPath('99')).toBe('/consulta/99');
  });

  it('buildConsultaEditPath rejects empty id', () => {
    expect(() => buildConsultaEditPath(null)).toThrow(/required/i);
    expect(() => buildConsultaEditPath('')).toThrow(/required/i);
  });

  it('buildConsultaEditState flags edit mode', () => {
    expect(buildConsultaEditState(7)).toEqual({
      isEditingReservation: true,
      reservationId: 7,
      reservationEdit: { id: 7 }
    });
  });

  it('resolveEditReservationId prefers path over query over state', () => {
    expect(
      resolveEditReservationId({
        paramId: '10',
        queryId: '20',
        state: { reservationId: 30 }
      })
    ).toBe(10);

    expect(
      resolveEditReservationId({
        paramId: null,
        queryId: '20',
        state: { reservationId: 30 }
      })
    ).toBe(20);

    expect(
      resolveEditReservationId({
        paramId: null,
        queryId: null,
        state: { reservationEdit: { id: 30 } }
      })
    ).toBe(30);
  });

  it('isConsultaEditIntent detects url or state', () => {
    expect(isConsultaEditIntent({ paramId: '1' })).toBe(true);
    expect(isConsultaEditIntent({ queryId: '2' })).toBe(true);
    expect(isConsultaEditIntent({ state: { isEditingReservation: true } })).toBe(true);
    expect(isConsultaEditIntent({})).toBe(false);
  });
});
