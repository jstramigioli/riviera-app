const {
  DINING_SERVICE,
  DINING_STATUS,
  mealFlagsFromServiceRef,
  computeDiningAgenda,
  wouldDoubleCountMediaPension,
  lodgingHasMediaPensionDinner
} = require('./diningGuestsCompute');

function lodging({
  id,
  status = 'CONFIRMADA',
  guests = 2,
  services = ['media_pension'],
  start = '2026-11-20',
  end = '2026-11-23',
  firstName = 'Ana',
  lastName = 'Pérez',
  accountId = null
}) {
  return {
    id,
    status,
    source: 'WHATSAPP',
    mainClientId: id * 10,
    mainClient: { id: id * 10, firstName, lastName },
    guests: Array.from({ length: guests }, (_, i) => ({ id: i + 1 })),
    account: accountId ? { id: accountId } : null,
    segments: [
      {
        id: 1,
        startDate: start,
        endDate: end,
        guestCount: guests,
        services,
        roomId: id,
        virtualRoomId: null,
        isActive: true
      }
    ]
  };
}

function diningRow({
  id,
  serviceDate = '2026-11-21',
  guestCount = 2,
  reservationId = null,
  status = DINING_STATUS.CONFIRMADA,
  clientId = 100,
  firstName = 'Ext',
  lastName = 'Cliente',
  accountId = null
}) {
  return {
    id,
    serviceDate,
    serviceType: DINING_SERVICE.CENA,
    guestCount,
    reservationId,
    status,
    clientId,
    client: { id: clientId, firstName, lastName },
    accountId,
    account: accountId ? { id: accountId } : null,
    notes: null,
    reservation: reservationId
      ? { id: reservationId, status: 'CONFIRMADA', source: 'WHATSAPP' }
      : null
  };
}

describe('diningGuestsCompute', () => {
  const serviceTypes = [
    { id: 'media_pension', name: 'Desayuno y Media Pensión' },
    { id: 'con_desayuno', name: 'Desayuno' },
    { id: 'solo_alojamiento', name: 'Solo alojamiento' }
  ];

  it('clasifica media pensión vs desayuno vs alojamiento', () => {
    expect(mealFlagsFromServiceRef('media_pension').dinner).toBe(true);
    expect(mealFlagsFromServiceRef('con_desayuno').dinner).toBe(false);
    expect(mealFlagsFromServiceRef('solo_alojamiento').dinner).toBe(false);
  });

  it('MP: cuenta comensales en noche half-open (check-in sí, check-out no)', () => {
    const agenda = computeDiningAgenda({
      dayIso: '2026-11-20',
      lodgingReservations: [
        lodging({ id: 1, guests: 3, start: '2026-11-20', end: '2026-11-23' })
      ],
      diningReservations: [],
      serviceTypes
    });
    expect(agenda.totals.mediaPension).toBe(3);
    expect(agenda.totals.total).toBe(3);

    const checkout = computeDiningAgenda({
      dayIso: '2026-11-23',
      lodgingReservations: [
        lodging({ id: 1, guests: 3, start: '2026-11-20', end: '2026-11-23' })
      ],
      diningReservations: [],
      serviceTypes
    });
    expect(checkout.totals.mediaPension).toBe(0);
  });

  it('adicionales: huéspedes sin MP con cena vinculada a alojamiento', () => {
    const agenda = computeDiningAgenda({
      dayIso: '2026-11-21',
      lodgingReservations: [
        lodging({
          id: 2,
          guests: 2,
          services: ['solo_alojamiento'],
          start: '2026-11-20',
          end: '2026-11-23'
        })
      ],
      diningReservations: [
        diningRow({
          id: 10,
          reservationId: 2,
          guestCount: 2,
          clientId: 20,
          firstName: 'Luis',
          lastName: 'SinMP'
        })
      ],
      serviceTypes
    });
    expect(agenda.totals.mediaPension).toBe(0);
    expect(agenda.totals.additional).toBe(2);
    expect(agenda.totals.external).toBe(0);
    expect(agenda.totals.total).toBe(2);
    expect(agenda.additional[0].lodgingReservationId).toBe(2);
  });

  it('externos: sin reservationId', () => {
    const agenda = computeDiningAgenda({
      dayIso: '2026-11-21',
      lodgingReservations: [],
      diningReservations: [
        diningRow({ id: 11, guestCount: 4, reservationId: null })
      ],
      serviceTypes
    });
    expect(agenda.totals.external).toBe(4);
    expect(agenda.totals.total).toBe(4);
    expect(agenda.external[0].source).toBe('external');
  });

  it('combinación MP + adicionales + externos', () => {
    const agenda = computeDiningAgenda({
      dayIso: '2026-11-21',
      lodgingReservations: [
        lodging({ id: 1, guests: 3, services: ['media_pension'] }),
        lodging({
          id: 2,
          guests: 2,
          services: ['con_desayuno'],
          firstName: 'Solo',
          lastName: 'Desayuno'
        })
      ],
      diningReservations: [
        diningRow({
          id: 10,
          reservationId: 2,
          guestCount: 2,
          clientId: 20
        }),
        diningRow({ id: 11, guestCount: 5, reservationId: null })
      ],
      serviceTypes
    });
    expect(agenda.totals).toEqual({
      mediaPension: 3,
      additional: 2,
      external: 5,
      total: 10
    });
  });

  it('canceladas no computan pero quedan en histórico', () => {
    const agenda = computeDiningAgenda({
      dayIso: '2026-11-21',
      lodgingReservations: [],
      diningReservations: [
        diningRow({
          id: 12,
          guestCount: 6,
          status: DINING_STATUS.CANCELADA
        }),
        diningRow({ id: 13, guestCount: 1 })
      ],
      serviceTypes
    });
    expect(agenda.totals.external).toBe(1);
    expect(agenda.totals.total).toBe(1);
    expect(agenda.cancelled).toHaveLength(1);
    expect(agenda.cancelled[0].guestCount).toBe(6);
  });

  it('modificar cantidades se refleja en el total', () => {
    const base = [
      diningRow({ id: 1, guestCount: 2 }),
      diningRow({ id: 2, guestCount: 3, reservationId: null, clientId: 101 })
    ];
    expect(
      computeDiningAgenda({
        dayIso: '2026-11-21',
        lodgingReservations: [],
        diningReservations: base,
        serviceTypes
      }).totals.total
    ).toBe(5);

    const updated = base.map((r) =>
      r.id === 1 ? { ...r, guestCount: 7 } : r
    );
    expect(
      computeDiningAgenda({
        dayIso: '2026-11-21',
        lodgingReservations: [],
        diningReservations: updated,
        serviceTypes
      }).totals.total
    ).toBe(10);
  });

  it('evita doble conteo MP + adicional misma estadía/fecha', () => {
    const agenda = computeDiningAgenda({
      dayIso: '2026-11-21',
      lodgingReservations: [
        lodging({ id: 5, guests: 4, services: ['media_pension'] })
      ],
      diningReservations: [
        diningRow({
          id: 99,
          reservationId: 5,
          guestCount: 4,
          clientId: 50
        })
      ],
      serviceTypes
    });
    expect(agenda.totals.mediaPension).toBe(4);
    expect(agenda.totals.additional).toBe(0);
    expect(agenda.totals.total).toBe(4);
  });

  it('wouldDoubleCountMediaPension detecta conflicto al crear', () => {
    const res = lodging({ id: 7, services: ['media_pension'] });
    expect(
      wouldDoubleCountMediaPension({
        reservation: res,
        dayIso: '2026-11-21',
        serviceTypes
      })
    ).toBe(true);
    expect(
      lodgingHasMediaPensionDinner(res, '2026-11-23', new Map())
    ).toBe(false);

    const noMp = lodging({ id: 8, services: ['solo_alojamiento'] });
    expect(
      wouldDoubleCountMediaPension({
        reservation: noMp,
        dayIso: '2026-11-21',
        serviceTypes
      })
    ).toBe(false);
  });

  it('asociación de cuentas aparece en el desglose', () => {
    const agenda = computeDiningAgenda({
      dayIso: '2026-11-21',
      lodgingReservations: [],
      diningReservations: [
        diningRow({ id: 1, guestCount: 2, accountId: 55 })
      ],
      serviceTypes
    });
    expect(agenda.external[0].accountId).toBe(55);
  });

  it('reserva de alojamiento cancelada no aporta MP', () => {
    const agenda = computeDiningAgenda({
      dayIso: '2026-11-21',
      lodgingReservations: [
        lodging({ id: 1, status: 'CANCELADA', guests: 5 })
      ],
      diningReservations: [],
      serviceTypes
    });
    expect(agenda.totals.mediaPension).toBe(0);
    expect(agenda.totals.total).toBe(0);
  });
});
