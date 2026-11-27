import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ComidasReservaPanel from './ComidasReservaPanel';

vi.mock('../ConsumptionOrderModal', () => ({
  default: ({ open, preset }) => (open ? <div data-testid="comanda-modal">{JSON.stringify(preset)}</div> : null)
}));

vi.mock('../../services/api', () => ({
  fetchComidasDeReserva: vi.fn(),
  cancelarComida: vi.fn(),
  reactivarComida: vi.fn(),
  anularBeneficio: vi.fn(),
  restaurarBeneficio: vi.fn(),
  anularConsumptionOrder: vi.fn()
}));
import {
  fetchComidasDeReserva,
  cancelarComida,
  anularBeneficio,
  anularConsumptionOrder
} from '../../services/api';

const data = {
  reservationId: 40,
  beneficiosDisponibles: 1,
  prestaciones: [
    { id: 1, fecha: '2026-12-01', tipo: 'CENA', origen: 'REGIMEN', estado: 'PREVISTA', pax: 2 },
    { id: 2, fecha: '2026-12-02', tipo: 'DESAYUNO', origen: 'REGIMEN', estado: 'PREVISTA', pax: 2 },
    { id: 3, fecha: '2026-12-02', tipo: 'CENA', origen: 'REGIMEN', estado: 'CANCELADA', pax: 2 }
  ],
  beneficios: [
    { id: 7, estado: 'DISPONIBLE', cenaFecha: '2026-12-02', comanda: null },
    {
      id: 8,
      estado: 'UTILIZADO',
      cenaFecha: '2026-11-30',
      comanda: { id: 12, fecha: '2026-12-01', estado: 'ACTIVA', items: [] }
    },
    { id: 9, estado: 'ANULADO', motivoAnulacion: 'CHECKOUT', cenaFecha: '2026-11-29', comanda: null }
  ]
};

describe('ComidasReservaPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchComidasDeReserva.mockResolvedValue({ data });
    cancelarComida.mockResolvedValue({});
    anularBeneficio.mockResolvedValue({});
    anularConsumptionOrder.mockResolvedValue({});
  });

  it('muestra beneficios con estado, motivo y comanda, y la grilla de comidas', async () => {
    render(<ComidasReservaPanel reservationId={40} reservationStatus="INGRESADA" />);
    const beneficios = await screen.findByRole('region', { name: 'Almuerzos sin cargo' });
    expect(beneficios).toHaveTextContent('1 disponible');
    expect(within(beneficios).getByText('Disponible')).toBeInTheDocument();
    expect(within(beneficios).getByText('Utilizado')).toBeInTheDocument();
    expect(within(beneficios).getByText(/por check-out/)).toBeInTheDocument();
    expect(within(beneficios).getByText(/#12/)).toBeInTheDocument();

    const grilla = screen.getByRole('region', { name: 'Comidas de la estadía' });
    expect(within(grilla).getAllByText('Incluida · 2')).toHaveLength(2);
    expect(within(grilla).getByText('Cambiada por almuerzo')).toBeInTheDocument();
  });

  it('acciones: cancelar cena, anular beneficio y anular la comanda donde se usó', async () => {
    const user = userEvent.setup();
    render(<ComidasReservaPanel reservationId={40} reservationStatus="INGRESADA" />);

    await user.click(await screen.findByRole('button', { name: 'Cambiar por almuerzo la cena del 01/12/26' }));
    await user.click(await screen.findByRole('button', { name: 'Cambiar por almuerzo' }));
    await waitFor(() => expect(cancelarComida).toHaveBeenCalledWith(1));

    await user.click(screen.getByRole('button', { name: 'Anular' }));
    // Confirmación in-app
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Anular' }));
    await waitFor(() => expect(anularBeneficio).toHaveBeenCalledWith(7));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Anular comanda' }));
    const dialogComanda = await screen.findByRole('dialog');
    await user.click(within(dialogComanda).getByRole('button', { name: 'Anular comanda' }));
    await waitFor(() => expect(anularConsumptionOrder).toHaveBeenCalledWith(12));
  });

  it('reserva finalizada: sin acciones sobre las cenas', async () => {
    render(<ComidasReservaPanel reservationId={40} reservationStatus="FINALIZADA" />);
    await screen.findByRole('region', { name: 'Comidas de la estadía' });
    expect(screen.queryByRole('button', { name: /Cambiar por almuerzo la cena del/ })).not.toBeInTheDocument();
  });

  it('comandas: el detalle viene oculto y se despliega; «Nueva comanda» abre con la reserva elegida', async () => {
    const user = userEvent.setup();
    fetchComidasDeReserva.mockResolvedValue({
      data: {
        ...data,
        comandas: [
          {
            id: 5,
            fecha: '2026-12-01',
            ambito: 'CENA',
            estado: 'ACTIVA',
            total: 3000,
            items: [{ id: 1, descripcion: 'Cena x2', subtotal: 3000, sinCargo: false }]
          }
        ]
      }
    });
    const reservation = {
      id: 40,
      segments: [{ roomId: 3, isActive: true, startDate: '2026-12-01T00:00:00.000Z', endDate: '2026-12-03T00:00:00.000Z' }]
    };
    render(<ComidasReservaPanel reservationId={40} reservationStatus="INGRESADA" reservation={reservation} />);
    const comandas = await screen.findByRole('region', { name: 'Comandas' });
    expect(within(comandas).queryByText('Cena x2')).not.toBeInTheDocument();
    await user.click(within(comandas).getByRole('button', { name: 'Ver detalle de la comanda #5' }));
    expect(within(comandas).getByText('Cena x2')).toBeInTheDocument();

    await user.click(within(comandas).getByRole('button', { name: /Nueva comanda/ }));
    expect(screen.getByTestId('comanda-modal')).toHaveTextContent('"reservationId":40');
  });
});
