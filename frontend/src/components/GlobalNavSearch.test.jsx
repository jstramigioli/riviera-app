import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GlobalNavSearch from './GlobalNavSearch';

const navigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate
}));

vi.mock('../services/api', () => ({
  fetchReservations: vi.fn(async () => [
    {
      id: 12,
      status: 'CONFIRMADA',
      checkIn: '2026-03-10',
      checkOut: '2026-03-12',
      mainClient: { firstName: 'Ana', lastName: 'Pérez' }
    }
  ]),
  fetchClients: vi.fn(async () => [
    { id: 7, firstName: 'Luis', lastName: 'Gómez', documentNumber: '30111222' }
  ]),
  fetchQueries: vi.fn(async () => [
    {
      id: 3,
      checkIn: '2026-04-01',
      checkOut: '2026-04-05',
      mainClient: { firstName: 'Marta', lastName: 'Ruiz' }
    }
  ])
}));

describe('GlobalNavSearch', () => {
  beforeEach(() => {
    navigate.mockClear();
  });

  it('muestra la barra siempre y navega al seleccionar resultados', async () => {
    render(<GlobalNavSearch />);

    const input = screen.getByRole('searchbox', {
      name: 'Buscar reservas, clientes o consultas'
    });
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'perez' } });
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Ana Pérez/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('option', { name: /Ana Pérez/i }));
    expect(navigate).toHaveBeenCalledWith('/reservations/12');

    fireEvent.change(
      screen.getByRole('searchbox', {
        name: 'Buscar reservas, clientes o consultas'
      }),
      { target: { value: '30111222' } }
    );
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Luis Gómez/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('option', { name: /Luis Gómez/i }));
    expect(navigate).toHaveBeenCalledWith('/clients/7');

    fireEvent.change(
      screen.getByRole('searchbox', {
        name: 'Buscar reservas, clientes o consultas'
      }),
      { target: { value: 'marta' } }
    );
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Marta Ruiz/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('option', { name: /Marta Ruiz/i }));
    expect(navigate).toHaveBeenCalledWith('/consulta', {
      state: {
        queryData: expect.objectContaining({ id: 3 }),
        isEditing: true
      }
    });
  });
});
