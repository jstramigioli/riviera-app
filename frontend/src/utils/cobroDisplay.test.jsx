import { describe, it, expect } from 'vitest'
import {
  cobroClient,
  cobroClientDisplayName,
  cobroMatchesClientId,
  cobroReservationSearchHaystack,
  cobroReservations,
  paymentCodeLabel,
} from './cobroDisplay'

describe('cobroDisplay — multi-imputación', () => {
  const multi = {
    id: 50,
    codigo: 'A050',
    reservaId: null,
    reserva: null,
    accountId: null,
    imputaciones: [
      {
        id: 1,
        ordenIndex: 0,
        reservaId: 10,
        montoARS: 500,
        reserva: {
          id: 10,
          source: 'MOSTRADOR',
          status: 'CONFIRMADA',
          mainClient: { id: 7, firstName: 'Ana', lastName: 'Pérez' },
        },
      },
      {
        id: 2,
        ordenIndex: 1,
        reservaId: 11,
        montoARS: 500,
        reserva: {
          id: 11,
          source: 'WHATSAPP',
          status: 'CONFIRMADA',
          mainClient: { id: 7, firstName: 'Ana', lastName: 'Pérez' },
        },
      },
    ],
  }

  it('resuelve cliente y reservas desde imputaciones', () => {
    expect(cobroClient(multi)?.id).toBe(7)
    expect(cobroClientDisplayName(multi)).toBe('Ana Pérez')
    expect(cobroReservations(multi).map((r) => r.id)).toEqual([10, 11])
    expect(cobroMatchesClientId(multi, 7)).toBe(true)
    expect(cobroMatchesClientId(multi, 99)).toBe(false)
    expect(cobroReservationSearchHaystack(multi)).toContain('10')
    expect(cobroReservationSearchHaystack(multi)).toContain('11')
    expect(paymentCodeLabel(multi)).toBe('A050')
  })

  it('single reserva sigue funcionando', () => {
    const single = {
      id: 1,
      codigo: 'A001',
      reservaId: 3,
      reserva: {
        id: 3,
        mainClient: { id: 2, firstName: 'Luis', lastName: 'Gómez' },
      },
      imputaciones: [],
    }
    expect(cobroClientDisplayName(single)).toBe('Luis Gómez')
    expect(cobroReservations(single)).toEqual([
      expect.objectContaining({ id: 3 }),
    ])
  })

  it('cuenta externa sin reserva muestra label', () => {
    const external = {
      id: 9,
      reservaId: null,
      reserva: null,
      account: { id: 40, kind: 'EXTERNAL', label: 'Bar walk-in', client: null },
      imputaciones: [
        {
          id: 3,
          accountId: 40,
          reservaId: null,
          account: { id: 40, kind: 'EXTERNAL', label: 'Bar walk-in', client: null },
        },
      ],
    }
    expect(cobroClient(external)).toBeNull()
    expect(cobroClientDisplayName(external)).toBe('Bar walk-in')
    expect(cobroReservations(external)).toEqual([])
  })
})
