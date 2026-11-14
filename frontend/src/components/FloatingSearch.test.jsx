import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FloatingSearch from './FloatingSearch';

describe('FloatingSearch', () => {
  const reservations = [
    {
      id: 12,
      status: 'CONFIRMADA',
      checkIn: '2026-03-10',
      checkOut: '2026-03-12',
      mainClient: { firstName: 'Ana', lastName: 'Pérez' }
    }
  ];
  const clients = [
    { id: 7, firstName: 'Luis', lastName: 'Gómez', documentNumber: '30111222' }
  ];
  const queries = [
    {
      id: 3,
      checkIn: '2026-04-01',
      checkOut: '2026-04-05',
      mainClient: { firstName: 'Marta', lastName: 'Ruiz' }
    }
  ];

  it('abre la barra desde la lupa gris y selecciona resultados', () => {
    const onSelectReservation = vi.fn();
    const onSelectClient = vi.fn();
    const onSelectQuery = vi.fn();

    render(
      <FloatingSearch
        reservations={reservations}
        clients={clients}
        queries={queries}
        onSelectReservation={onSelectReservation}
        onSelectClient={onSelectClient}
        onSelectQuery={onSelectQuery}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Buscar en el Libro' }));
    const input = screen.getByRole('searchbox', {
      name: 'Buscar reservas, clientes o consultas'
    });
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'perez' } });
    fireEvent.click(screen.getByRole('option', { name: /Ana Pérez/i }));
    expect(onSelectReservation).toHaveBeenCalledWith(reservations[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Buscar en el Libro' }));
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Buscar reservas, clientes o consultas' }),
      { target: { value: '30111222' } }
    );
    fireEvent.click(screen.getByRole('option', { name: /Luis Gómez/i }));
    expect(onSelectClient).toHaveBeenCalledWith(clients[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Buscar en el Libro' }));
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Buscar reservas, clientes o consultas' }),
      { target: { value: 'marta' } }
    );
    fireEvent.click(screen.getByRole('option', { name: /Marta Ruiz/i }));
    expect(onSelectQuery).toHaveBeenCalledWith(queries[0]);
  });
});
