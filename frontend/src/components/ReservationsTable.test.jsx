import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReservationsTable from './ReservationsTable';

vi.mock('./GuestCheckInStatusCell', () => ({ default: () => null }));

const reserva = (id, nombre, services, status = 'CONFIRMADA') => ({
  id,
  status,
  checkIn: '2026-12-01T00:00:00.000Z',
  checkOut: '2026-12-03T00:00:00.000Z',
  totalAmount: 1000,
  mainClient: { id, firstName: nombre, lastName: 'Test' },
  segments: [{ isActive: true, services }]
});

describe('ReservationsTable — filtros por columna', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'base', name: 'Solo alojamiento' },
          { id: 'mp', name: 'Media pensión' }
        ]
      })
    });
  });

  it('filtra por tipo de servicio (p. ej. solo media pensión) y por cliente', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ReservationsTable
          reservations={[reserva(1, 'Ana', ['mp']), reserva(2, 'Beto', ['base'])]}
          rooms={[]}
          clients={[]}
          onReservationClick={() => {}}
        />
      </MemoryRouter>
    );
    expect(await screen.findAllByText('Media pensión')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Filtrar Tipo' }));
    const menu = screen.getByRole('dialog', { name: 'Filtro Tipo' });
    await user.click(within(menu).getByLabelText('Media pensión'));
    expect(screen.getByText('Ana Test')).toBeInTheDocument();
    expect(screen.queryByText('Beto Test')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    await user.click(screen.getByRole('button', { name: 'Filtrar Cliente' }));
    await user.type(screen.getByRole('searchbox', { name: 'Filtrar Cliente' }), 'beto');
    expect(screen.queryByText('Ana Test')).not.toBeInTheDocument();
    expect(screen.getByText('Beto Test')).toBeInTheDocument();
  });
});
