import { describe, it, expect } from 'vitest';
import { documentTitleFor } from './usePageTitle';

describe('documentTitleFor', () => {
  it('arma «Página - Hotel Riviera» y no duplica el nombre', () => {
    expect(documentTitleFor('/')).toBe('Dashboard - Hotel Riviera');
    expect(documentTitleFor('/comedor')).toBe('Comedor - Hotel Riviera');
    expect(documentTitleFor('/reservations/12')).toBe('Reserva - Hotel Riviera');
    expect(documentTitleFor('/ruta-rara')).toBe('Hotel Riviera');
  });
});
