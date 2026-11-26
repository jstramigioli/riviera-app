import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ComensalesTab from './ComensalesTab';

vi.mock('../../services/api', () => ({
  fetchComidasDelDia: vi.fn(),
  actualizarComida: vi.fn(),
  cancelarComida: vi.fn(),
  reactivarComida: vi.fn()
}));
vi.mock('../ConsumptionOrderModal', () => ({
  default: ({ open, preset }) => (open ? <div data-testid="comanda-modal">{JSON.stringify(preset)}</div> : null)
}));
vi.mock('./NuevaCenaModal', () => ({ default: () => null }));
import { fetchComidasDelDia, cancelarComida, reactivarComida } from '../../services/api';

const item = (overrides) => ({
  id: 1,
  tipo: 'CENA',
  origen: 'REGIMEN',
  esExterno: false,
  estado: 'PREVISTA',
  pax: 2,
  reservationId: 40,
  reservationStatus: 'INGRESADA',
  guestName: 'Ana Pérez',
  roomLabel: '12',
  comandaId: null,
  comandaEstado: null,
  ...overrides
});

describe('ComensalesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchComidasDelDia.mockResolvedValue({
      data: {
        fecha: '2026-12-02',
        cenas: {
          total: 6,
          items: [
            item({}),
            item({ id: 2, origen: 'MANUAL', esExterno: true, reservationId: null, guestName: 'Familia Ruiz', roomLabel: 'Externo', pax: 4, comandaId: 9, comandaEstado: 'ACTIVA' }),
            item({ id: 3, estado: 'CANCELADA', guestName: 'Luis Gómez', roomLabel: '14' })
          ]
        },
        desayunos: { total: 2, items: [item({ id: 4, tipo: 'DESAYUNO' })] }
      }
    });
    cancelarComida.mockResolvedValue({});
    reactivarComida.mockResolvedValue({});
  });

  function renderTab() {
    return render(
      <MemoryRouter>
        <ComensalesTab />
      </MemoryRouter>
    );
  }

  it('muestra cenas y desayunos con totales, origen y estado', async () => {
    renderTab();
    const cenas = await screen.findByRole('region', { name: 'Cenas' });
    expect(fetchComidasDelDia.mock.calls[0][1]).toEqual({ incluirCanceladas: true });
    expect(within(cenas).getByText('6')).toBeInTheDocument();
    expect(within(cenas).getAllByText('Incluida')).toHaveLength(2);
    // Habitación y origen de la fila externa
    expect(within(cenas).getAllByText('Externo', { selector: 'td' })).toHaveLength(2);
    expect(within(cenas).getByText('Cancelada')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Desayunos' })).toHaveTextContent('Ana Pérez');
  });

  it('cancelar pide confirmación y llama a la API; reactivar solo en incluidas canceladas', async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(await screen.findByRole('button', { name: 'Cancelar cena de Ana Pérez' }));
    await user.click(await screen.findByRole('button', { name: 'Cancelar cena' }));
    await waitFor(() => expect(cancelarComida).toHaveBeenCalledWith(1));

    await user.click(screen.getByRole('button', { name: 'Reactivar cena de Luis Gómez' }));
    await waitFor(() => expect(reactivarComida).toHaveBeenCalledWith(3));
  });

  it('consumos: agrega a la comanda de la cena manual o abre una comanda de Cena para el huésped', async () => {
    const user = userEvent.setup();
    renderTab();
    const botones = await screen.findAllByRole('button', { name: 'Consumos de la cena' });
    await user.click(botones[1]);
    expect(screen.getByTestId('comanda-modal')).toHaveTextContent('"comandaId":9');
    await user.click(botones[0]);
    expect(screen.getByTestId('comanda-modal')).toHaveTextContent('"reservationId":40');
    expect(screen.getByTestId('comanda-modal')).toHaveTextContent('"ambito":"CENA"');
  });
});
