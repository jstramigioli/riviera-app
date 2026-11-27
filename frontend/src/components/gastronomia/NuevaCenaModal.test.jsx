import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import NuevaCenaModal from './NuevaCenaModal';

vi.mock('../../services/api', () => ({
  fetchTiposCena: vi.fn(),
  fetchOccupiedRoomsToday: vi.fn(),
  crearCenaManual: vi.fn(),
  searchClients: vi.fn()
}));
import { fetchTiposCena, fetchOccupiedRoomsToday, crearCenaManual, searchClients } from '../../services/api';

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
      reservationId: 40
    });
    expect(crearCenaManual.mock.calls[0][0].comensales).toHaveLength(2);
    expect(onSaved).toHaveBeenCalled();
  });

  it('externo nuevo: exige nombre, apellido y contacto, y envía el cliente', async () => {
    const user = userEvent.setup();
    render(<NuevaCenaModal open fecha="2026-12-02" onClose={vi.fn()} onSaved={vi.fn()} />);
    await screen.findByRole('option', { name: 'Cena habitual' });

    await user.click(screen.getByRole('radio', { name: 'Externo' }));
    await user.type(screen.getByRole('textbox', { name: 'Nombre' }), 'Ana');
    await user.click(screen.getByRole('button', { name: 'Registrar cena' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('nombre y apellido');

    await user.type(screen.getByRole('textbox', { name: 'Apellido' }), 'Ruiz');
    await user.click(screen.getByRole('button', { name: 'Registrar cena' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('teléfono o un email');

    await user.type(screen.getByRole('textbox', { name: 'Teléfono' }), '223 555 1234');
    await user.click(screen.getByRole('button', { name: 'Registrar cena' }));
    await waitFor(() => expect(crearCenaManual).toHaveBeenCalledTimes(1));
    expect(crearCenaManual.mock.calls[0][0]).toMatchObject({
      variedad: 'EXTERNO',
      cliente: { firstName: 'Ana', lastName: 'Ruiz', phone: '223 555 1234', email: null }
    });
    expect(crearCenaManual.mock.calls[0][0]).not.toHaveProperty('reservationId');
  });

  it('externo existente: elige un cliente de la búsqueda y envía su id', async () => {
    const user = userEvent.setup();
    searchClients.mockResolvedValue([{ id: 55, firstName: 'Laura', lastName: 'Gómez', phone: '223 444' }]);
    render(<NuevaCenaModal open fecha="2026-12-02" onClose={vi.fn()} onSaved={vi.fn()} />);
    await screen.findByRole('option', { name: 'Cena habitual' });

    await user.click(screen.getByRole('radio', { name: 'Externo' }));
    await user.type(screen.getByRole('textbox', { name: 'Buscar cliente existente' }), 'gom');
    await user.click(await screen.findByRole('button', { name: /Laura Gómez/ }));
    await user.click(screen.getByRole('button', { name: 'Registrar cena' }));
    await waitFor(() => expect(crearCenaManual).toHaveBeenCalledTimes(1));
    expect(crearCenaManual.mock.calls[0][0]).toMatchObject({ variedad: 'EXTERNO', clientId: 55 });
    expect(crearCenaManual.mock.calls[0][0]).not.toHaveProperty('cliente');
  });

  it('comensales: edad y dietas por comensal; 5 a 10 paga la mitad y menor de 5 no paga', async () => {
    const user = userEvent.setup();
    render(<NuevaCenaModal open fecha="2026-12-02" onClose={vi.fn()} onSaved={vi.fn()} />);
    const reserva = await screen.findByRole('combobox', { name: 'Reserva' });
    await waitFor(() => expect(screen.getByRole('option', { name: /12 - Pérez/ })).toBeInTheDocument());
    await user.selectOptions(reserva, '40');

    const cantidad = screen.getByRole('spinbutton', { name: 'Comensales' });
    await user.clear(cantidad);
    await user.type(cantidad, '3');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Edad del comensal 2' }), 'NINO');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Edad del comensal 3' }), 'MENOR');
    await user.click(screen.getByRole('checkbox', { name: 'Celíaco, comensal 1' }));
    // 18.000 + 9.000 + 0
    expect(screen.getByText('27.000 ARS', { exact: false })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Registrar cena' }));
    await waitFor(() => expect(crearCenaManual).toHaveBeenCalledTimes(1));
    expect(crearCenaManual.mock.calls[0][0].comensales).toEqual([
      { edad: 'ADULTO', dietVegetariano: false, dietVegano: false, dietCeliaco: true },
      { edad: 'NINO', dietVegetariano: false, dietVegano: false, dietCeliaco: false },
      { edad: 'MENOR', dietVegetariano: false, dietVegano: false, dietCeliaco: false }
    ]);
  });
});
