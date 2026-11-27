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
  rooms: [{ roomId: 5, name: '12' }],
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
          porOrigen: { incluida: 2, adicional: 0, externo: 4 },
          conDieta: 3,
          dietas: ['Celíaco ×1', 'Vegetariano ×2'],
          items: [
            item({ dietas: ['Celíaco ×1', 'Vegetariano ×2'] }),
            item({ id: 2, origen: 'MANUAL', esExterno: true, reservationId: null, guestName: 'Familia Ruiz', roomLabel: 'Externo', rooms: [], pax: 4, comandaId: 9, comandaEstado: 'ACTIVA' }),
            item({ id: 3, estado: 'CANCELADA', guestName: 'Luis Gómez', roomLabel: '14' })
          ]
        },
        desayunos: { total: 2, items: [item({ id: 4, tipo: 'DESAYUNO' })] }
      }
    });
    cancelarComida.mockResolvedValue({});
    reactivarComida.mockResolvedValue({});
  });

  function renderTab(tipo = 'CENA') {
    return render(
      <MemoryRouter>
        <ComensalesTab tipo={tipo} />
      </MemoryRouter>
    );
  }

  it('cena: tablero del día y del siguiente, tabla con origen, estado y chip de habitación', async () => {
    renderTab();
    const cenas = await screen.findByRole('region', { name: 'Cenas' });
    expect(fetchComidasDelDia.mock.calls[0][1]).toEqual({ incluirCanceladas: true });
    expect(fetchComidasDelDia).toHaveBeenCalledTimes(2);
    const hoy = screen.getByLabelText('Resumen Hoy');
    expect(within(hoy).getByText('6')).toBeInTheDocument();
    expect(within(hoy).getByText('Externos')).toBeInTheDocument();
    expect(within(hoy).getByText('Celíaco ×1 · Vegetariano ×2')).toBeInTheDocument();
    expect(screen.getByLabelText('Resumen Mañana')).toBeInTheDocument();
    expect(within(cenas).getAllByText('Incluida')).toHaveLength(2);
    expect(within(cenas).getByText('Externo', { selector: 'td' })).toBeInTheDocument();
    expect(within(cenas).getAllByTitle('Ver habitación 12')).toHaveLength(2);
    expect(within(cenas).getByText('Cambiada por almuerzo')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Desayunos' })).not.toBeInTheDocument();
  });

  it('desayuno: solo la tabla de desayunos, sin «+ Cena»', async () => {
    renderTab('DESAYUNO');
    expect(await screen.findByRole('region', { name: 'Desayunos' })).toHaveTextContent('Ana Pérez');
    expect(screen.queryByRole('button', { name: /Cena/ })).not.toBeInTheDocument();
  });

  it('cancelar pide confirmación y llama a la API; reactivar solo en incluidas canceladas', async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(await screen.findByRole('button', { name: 'Cambiar por almuerzo la cena de Ana Pérez' }));
    await user.click(await screen.findByRole('button', { name: 'Cambiar por almuerzo' }));
    await waitFor(() => expect(cancelarComida).toHaveBeenCalledWith(1));

    await user.click(screen.getByRole('button', { name: 'Reactivar cena de Luis Gómez' }));
    await waitFor(() => expect(reactivarComida).toHaveBeenCalledWith(3));
  });

  it('la cantidad no se edita en la tabla: la adicional se edita con el modal, la incluida se cambia por almuerzo', async () => {
    renderTab();
    const cenas = await screen.findByRole('region', { name: 'Cenas' });
    expect(within(cenas).queryAllByRole('spinbutton')).toHaveLength(0);
    expect(within(cenas).getByRole('button', { name: 'Editar cena de Familia Ruiz' })).toBeInTheDocument();
    expect(within(cenas).queryByRole('button', { name: 'Cambiar por almuerzo la cena de Familia Ruiz' })).not.toBeInTheDocument();
    expect(within(cenas).queryByRole('button', { name: 'Editar cena de Ana Pérez' })).not.toBeInTheDocument();
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

  it('muestra las dietas de los huéspedes para cocina', async () => {
    renderTab();
    const cenas = await screen.findByRole('region', { name: 'Cenas' });
    expect(within(cenas).getByText('Celíaco ×1 · Vegetariano ×2')).toBeInTheDocument();
  });
});
