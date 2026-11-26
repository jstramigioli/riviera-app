import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import NuevaCenaModal from './NuevaCenaModal';

vi.mock('../../services/api', () => ({
  fetchTiposCena: vi.fn(),
  fetchOccupiedRoomsToday: vi.fn(),
  crearCenaManual: vi.fn()
}));
import { fetchTiposCena, fetchOccupiedRoomsToday, crearCenaManual } from '../../services/api';

describe('NuevaCenaModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchTiposCena.mockResolvedValue({
      data: [{ id: 3, nombre: 'Cena habitual', precioAlojado: 18000, precioExterno: 22000 }]
    });
    fetchOccupiedRoomsToday.mockResolvedValue({
      data: [
        { reservationId: 40, label: '12 - Pérez', startDate: '2026-12-01', endDate: '2026-12-04' },
        { reservationId: 41, label: '14 - Gómez', startDate: '2026-11-30', endDate: '2026-12-02' }
      ]
    });
    crearCenaManual.mockResolvedValue({ data: { comandaId: 9 } });
  });

  it('huésped: solo ofrece reservas que pasan la noche y usa precio Alojado', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<NuevaCenaModal open fecha="2026-12-02" onClose={vi.fn()} onSaved={onSaved} />);

    const reserva = await screen.findByRole('combobox', { name: 'Reserva' });
    await waitFor(() => expect(screen.getByRole('option', { name: /12 - Pérez/ })).toBeInTheDocument());
    // 14 - Gómez sale el 2/12: no pasa esa noche
    expect(screen.queryByRole('option', { name: /14 - Gómez/ })).not.toBeInTheDocument();

    await user.selectOptions(reserva, '40');
    expect(screen.getByText('36.000 ARS', { exact: false })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Registrar cena' }));

    await waitFor(() => expect(crearCenaManual).toHaveBeenCalledTimes(1));
    expect(crearCenaManual.mock.calls[0][0]).toMatchObject({
      fecha: '2026-12-02',
      menuItemId: 3,
      variedad: 'ALOJADO',
      pax: 2,
      reservationId: 40
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it('externo: pide nombre y usa precio Externo', async () => {
    const user = userEvent.setup();
    render(<NuevaCenaModal open fecha="2026-12-02" onClose={vi.fn()} onSaved={vi.fn()} />);
    await screen.findByRole('option', { name: 'Cena habitual' });

    await user.click(screen.getByRole('radio', { name: 'Externo' }));
    await user.click(screen.getByRole('button', { name: 'Registrar cena' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ingresá el nombre');

    await user.type(screen.getByRole('textbox', { name: 'Nombre' }), 'Familia Ruiz');
    await user.click(screen.getByRole('button', { name: 'Registrar cena' }));
    await waitFor(() => expect(crearCenaManual).toHaveBeenCalledTimes(1));
    expect(crearCenaManual.mock.calls[0][0]).toMatchObject({
      variedad: 'EXTERNO',
      nombreExterno: 'Familia Ruiz'
    });
    expect(crearCenaManual.mock.calls[0][0]).not.toHaveProperty('reservationId');
  });
});
