import { describe, expect, it } from 'vitest';
import { searchLibroEntities } from './libroGlobalSearch';

const reservations = [
  {
    id: 12,
    status: 'CONFIRMADA',
    checkIn: '2026-03-10',
    checkOut: '2026-03-12',
    mainClient: {
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@example.com',
      phone: '2235551111'
    }
  }
];

const clients = [
  {
    id: 7,
    firstName: 'Luis',
    lastName: 'Gómez',
    documentNumber: '30111222',
    phone: '2234440000',
    email: 'luis@example.com'
  }
];

const queries = [
  {
    id: 3,
    checkIn: '2026-04-01',
    checkOut: '2026-04-05',
    mainClient: { firstName: 'Marta', lastName: 'Ruiz', phone: '2239998877' }
  }
];

describe('searchLibroEntities', () => {
  it('returns empty without term', () => {
    expect(searchLibroEntities({ reservations, clients, queries }, '  ')).toEqual([]);
  });

  it('finds reservation by client name and id', () => {
    const byName = searchLibroEntities({ reservations, clients, queries }, 'perez');
    expect(byName.some((r) => r.type === 'reservation' && r.id === 12)).toBe(true);

    const byId = searchLibroEntities({ reservations, clients, queries }, '12');
    expect(byId[0].type).toBe('reservation');
    expect(byId[0].id).toBe(12);
  });

  it('finds client by document and query by phone', () => {
    const clientHits = searchLibroEntities({ reservations, clients, queries }, '30111222');
    expect(clientHits).toEqual([
      expect.objectContaining({ type: 'client', id: 7, title: 'Luis Gómez' })
    ]);

    const queryHits = searchLibroEntities({ reservations, clients, queries }, '223999');
    expect(queryHits.some((r) => r.type === 'query' && r.id === 3)).toBe(true);
  });

  it('respects limit and type order', () => {
    const manyClients = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      firstName: 'Ana',
      lastName: `Cliente${i}`
    }));
    const hits = searchLibroEntities(
      { reservations, clients: manyClients, queries },
      'ana',
      { limit: 5 }
    );
    expect(hits).toHaveLength(5);
    expect(hits[0].type).toBe('reservation');
  });
});
