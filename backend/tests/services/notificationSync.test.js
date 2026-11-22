const {
  buildBirthdayPayloads,
  isBirthdayToday,
  monthDayOf,
  BIRTHDAY_AUDIENCE_ROLES
} = require('../../src/services/notificationSync');

describe('notificationSync birthday', () => {
  test('monthDayOf / isBirthdayToday ignoran el año', () => {
    expect(monthDayOf('1990-11-21')).toBe('11-21');
    expect(isBirthdayToday('1990-11-21', '2026-11-21')).toBe(true);
    expect(isBirthdayToday('1990-11-22', '2026-11-21')).toBe(false);
    expect(isBirthdayToday(null, '2026-11-21')).toBe(false);
  });

  test('buildBirthdayPayloads: titular alojado genera notifs por rol', () => {
    const reservations = [
      {
        id: 42,
        status: 'INGRESADA',
        mainClient: {
          id: 7,
          firstName: 'Ana',
          lastName: 'Pérez',
          birthDate: '1985-11-21T12:00:00.000Z'
        },
        guests: [],
        segments: [
          {
            isActive: true,
            startDate: '2026-11-20',
            endDate: '2026-11-23',
            room: { name: '12' }
          }
        ]
      }
    ];

    const payloads = buildBirthdayPayloads('2026-11-21', reservations);
    expect(payloads).toHaveLength(BIRTHDAY_AUDIENCE_ROLES.length);
    expect(payloads.every((p) => p.type === 'GUEST_BIRTHDAY')).toBe(true);
    expect(payloads.map((p) => p.audienceRole).sort()).toEqual(
      [...BIRTHDAY_AUDIENCE_ROLES].sort()
    );
    expect(payloads[0].body).toContain('Ana Pérez');
    expect(payloads[0].body).toContain('hab. 12');
    expect(payloads[0].body).toContain('reserva #42');
    expect(payloads[0].linkType).toBe('RESERVATION');
    expect(payloads[0].linkId).toBe('42');
    expect(payloads[0].dedupeKey).toMatch(
      /^GUEST_BIRTHDAY:2026-11-21:7:42:/
    );
  });

  test('no notifica si no está INGRESADA o sin birthDate', () => {
    const reservations = [
      {
        id: 1,
        status: 'CONFIRMADA',
        mainClient: {
          id: 1,
          firstName: 'A',
          lastName: 'B',
          birthDate: '1990-11-21'
        },
        guests: [],
        segments: [
          {
            isActive: true,
            startDate: '2026-11-20',
            endDate: '2026-11-23',
            room: { name: '1' }
          }
        ]
      },
      {
        id: 2,
        status: 'INGRESADA',
        mainClient: {
          id: 2,
          firstName: 'C',
          lastName: 'D',
          birthDate: null
        },
        guests: [],
        segments: [
          {
            isActive: true,
            startDate: '2026-11-20',
            endDate: '2026-11-23',
            room: { name: '2' }
          }
        ]
      }
    ];
    expect(buildBirthdayPayloads('2026-11-21', reservations)).toEqual([]);
  });

  test('incluye huésped vinculado y evita duplicar al titular', () => {
    const reservations = [
      {
        id: 9,
        status: 'INGRESADA',
        mainClient: {
          id: 10,
          firstName: 'Titular',
          lastName: 'X',
          birthDate: '1990-11-21'
        },
        guests: [
          {
            clientId: 10,
            client: {
              id: 10,
              firstName: 'Titular',
              lastName: 'X',
              birthDate: '1990-11-21'
            }
          },
          {
            clientId: 11,
            client: {
              id: 11,
              firstName: 'Huésped',
              lastName: 'Y',
              birthDate: '1991-11-21'
            }
          }
        ],
        segments: [
          {
            isActive: true,
            startDate: '2026-11-19',
            endDate: '2026-11-22',
            room: { name: '5' }
          }
        ]
      }
    ];

    const payloads = buildBirthdayPayloads('2026-11-21', reservations);
    const clientIds = [
      ...new Set(payloads.map((p) => p.meta.clientId))
    ].sort((a, b) => a - b);
    expect(clientIds).toEqual([10, 11]);
    expect(payloads).toHaveLength(BIRTHDAY_AUDIENCE_ROLES.length * 2);
  });

  test('fuera del rango de estadía no notifica', () => {
    const reservations = [
      {
        id: 3,
        status: 'INGRESADA',
        mainClient: {
          id: 3,
          firstName: 'Z',
          lastName: 'Z',
          birthDate: '1990-11-21'
        },
        guests: [],
        segments: [
          {
            isActive: true,
            startDate: '2026-11-10',
            endDate: '2026-11-15',
            room: { name: '3' }
          }
        ]
      }
    ];
    expect(buildBirthdayPayloads('2026-11-21', reservations)).toEqual([]);
  });
});
