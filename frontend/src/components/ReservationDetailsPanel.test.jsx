import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ReservationDetailsPanel from './ReservationDetailsPanel';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});
vi.mock('../services/api', () => ({
  fetchComidasDeReserva: vi.fn(),
  fetchServiceTypes: vi.fn().mockResolvedValue([]),
  getReservationFinancialSummary: vi.fn().mockResolvedValue({ resumen: { saldo: 0 } }),
  fetchReservationStatuses: vi.fn().mockResolvedValue([])
}));
import { fetchComidasDeReserva, getReservationFinancialSummary } from '../services/api';

const reservation = {
  id: 40,
  status: 'INGRESADA',
  mainClient: { id: 7, firstName: 'Ana', lastName: 'Pérez' },
  segments: [
    {
      id: 1,
      startDate: '2026-12-01',
      endDate: '2026-12-04',
      roomId: 3,
      room: { id: 3, name: '12' },
      services: ['st_mp'],
      guestCount: 2,
      isActive: true
    }
  ]
};

function renderPanel() {
  return render(
    <MemoryRouter>
      <ReservationDetailsPanel reservation={reservation} onStatusChange={vi.fn()} />
    </MemoryRouter>
  );
}

describe('ReservationDetailsPanel — almuerzo sin cargo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
  });

  it('muestra los disponibles y abre la pestaña Comidas de la reserva', async () => {
    const user = userEvent.setup();
    fetchComidasDeReserva.mockResolvedValue({ data: { beneficiosDisponibles: 2 } });
    renderPanel();
    const link = await screen.findByRole('button', { name: '2 disponibles' });
    expect(fetchComidasDeReserva).toHaveBeenCalledWith(40);
    await user.click(link);
    expect(navigateMock).toHaveBeenCalledWith('/reservations/40', { state: { activeTab: 'comidas' } });
  });

  it('sin beneficios disponibles no muestra la fila', async () => {
    fetchComidasDeReserva.mockResolvedValue({ data: { beneficiosDisponibles: 0 } });
    renderPanel();
    await screen.findByText('Ana Pérez');
    expect(screen.queryByTestId('panel-almuerzo-sin-cargo')).not.toBeInTheDocument();
  });
});

describe('ReservationDetailsPanel — saldo', () => {
  beforeEach(() => {
    fetchComidasDeReserva.mockResolvedValue({ data: { beneficiosDisponibles: 0 } });
  });

  it('muestra el saldo pendiente bajo el total', async () => {
    getReservationFinancialSummary.mockResolvedValueOnce({ resumen: { saldo: 30000 } });
    renderPanel();
    expect(await screen.findByTestId('panel-guest-saldo')).toHaveTextContent(/Saldo/);
    expect(getReservationFinancialSummary).toHaveBeenCalledWith(40);
  });

  it('sin deuda dice Pagado y con crédito A favor', async () => {
    getReservationFinancialSummary.mockResolvedValueOnce({ resumen: { saldo: 0 } });
    const { unmount } = renderPanel();
    expect(await screen.findByTestId('panel-guest-saldo')).toHaveTextContent('Pagado');
    unmount();
    getReservationFinancialSummary.mockResolvedValueOnce({ resumen: { saldo: -500 } });
    renderPanel();
    expect(await screen.findByTestId('panel-guest-saldo')).toHaveTextContent(/A favor/);
  });
});
