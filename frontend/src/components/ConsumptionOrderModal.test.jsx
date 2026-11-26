import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ConsumptionOrderModal from './ConsumptionOrderModal';

vi.mock('../services/api', () => ({
  fetchOccupiedRoomsToday: vi.fn(),
  fetchCuentasParaCobro: vi.fn(),
  fetchMenuItems: vi.fn(),
  fetchMenuCategories: vi.fn(),
  createConsumptionOrder: vi.fn(),
  anularConsumptionOrder: vi.fn()
}));

import {
  fetchOccupiedRoomsToday,
  fetchCuentasParaCobro,
  fetchMenuItems,
  fetchMenuCategories,
  createConsumptionOrder,
  anularConsumptionOrder
} from '../services/api';

const RESERVATION = {
  roomId: 3,
  roomName: '12',
  reservationId: 40,
  status: 'INGRESADA',
  clientLastName: 'Pérez',
  label: '12 - Pérez'
};

const CUENTA_EXTERNA = {
  accountId: 9,
  accountKind: 'EXTERNAL',
  label: 'Mesa 4'
};

async function chooseAgua(user) {
  const input = await screen.findByPlaceholderText('Buscar ítem del menú…');
  await user.type(input, 'Agua');
  await user.keyboard('{Enter}');
}

describe('ConsumptionOrderModal — ámbito de la comanda', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom no implementa scrollIntoView (lo usa el desplegable de ítems).
    Element.prototype.scrollIntoView = vi.fn();
    window.localStorage.clear();
    fetchOccupiedRoomsToday.mockResolvedValue({ data: [RESERVATION] });
    fetchCuentasParaCobro.mockResolvedValue({ data: [CUENTA_EXTERNA] });
    fetchMenuItems.mockResolvedValue({
      data: [{ id: 1, name: 'Agua', price: 1500, category: 'BEBIDAS', isActive: true }]
    });
    fetchMenuCategories.mockResolvedValue({ data: [{ code: 'BEBIDAS', label: 'Bebidas' }] });
    createConsumptionOrder.mockResolvedValue({
      data: { comandaId: 77, total: 1500, cargos: [{ id: 5 }] }
    });
    anularConsumptionOrder.mockResolvedValue({ data: { id: 77, estado: 'ANULADA' } });
  });

  it('muestra los cuatro ámbitos y exige elegir uno', async () => {
    const user = userEvent.setup();
    render(<ConsumptionOrderModal open onClose={vi.fn()} preset={{ reservationId: 40 }} />);

    const group = screen.getByRole('radiogroup', { name: 'Ámbito' });
    for (const name of ['Cena', 'Minutas', 'Cafetería', 'Frigobar']) {
      expect(screen.getByRole('radio', { name })).toBeInTheDocument();
    }
    expect(group).toBeInTheDocument();

    await chooseAgua(user);
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Elegí el ámbito de la comanda');
    expect(createConsumptionOrder).not.toHaveBeenCalled();
  });

  it('envía el ámbito elegido y lo recuerda para la próxima comanda', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ConsumptionOrderModal open onClose={onClose} preset={{ reservationId: 40 }} />);

    await user.click(screen.getByRole('radio', { name: 'Minutas' }));
    await chooseAgua(user);
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(createConsumptionOrder).toHaveBeenCalledTimes(1));
    expect(createConsumptionOrder.mock.calls[0][0]).toMatchObject({
      reservationId: 40,
      ambito: 'MINUTAS',
      items: [{ menuItemId: 1, varietyId: null, quantity: 1 }]
    });
    expect(window.localStorage.getItem('riviera.comanda.ultimoAmbito')).toBe('MINUTAS');
    expect(onClose).toHaveBeenCalled();
  });

  it('toma el ámbito del preset', async () => {
    render(
      <ConsumptionOrderModal
        open
        onClose={vi.fn()}
        preset={{ reservationId: 40, ambito: 'CENA' }}
      />
    );
    expect(screen.getByRole('radio', { name: 'Cena' })).toBeChecked();
  });

  it('Deshacer anula la comanda completa', async () => {
    const user = userEvent.setup();
    render(<ConsumptionOrderModal open onClose={vi.fn()} preset={{ reservationId: 40 }} />);

    await user.click(screen.getByRole('radio', { name: 'Cafetería' }));
    await chooseAgua(user);
    await user.click(screen.getByRole('button', { name: /Guardar y otra/ }));

    const undo = await screen.findByRole('button', { name: 'Deshacer' });
    expect(screen.getByRole('status')).toHaveTextContent('Comanda Cafetería cargada en 12 - Pérez');
    await user.click(undo);

    await waitFor(() => expect(anularConsumptionOrder).toHaveBeenCalledWith(77));
  });
});
