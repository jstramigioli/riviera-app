import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReservationPanelActions from './ReservationPanelActions';

const FINANCIAL_ACTIONS = { ADD_CONSUMO: 'add-consumo', ADD_COBRO: 'add-cobro' };

const navigateMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock
}));

describe('ReservationPanelActions', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it('muestra las tres acciones siempre visibles, sin emoji', () => {
    render(<ReservationPanelActions reservation={{ id: 9 }} />);
    for (const name of ['Comanda', 'Cobro', 'Liquidación']) {
      const btn = screen.getByRole('button', { name });
      expect(btn.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    }
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('navega a la página financiera con la acción elegida', async () => {
    const user = userEvent.setup();
    render(<ReservationPanelActions reservation={{ id: 42 }} />);

    await user.click(screen.getByTestId(`panel-action-${FINANCIAL_ACTIONS.ADD_COBRO}`));

    expect(navigateMock).toHaveBeenCalledWith('/reservations/42', {
      state: {
        activeTab: 'financiero',
        financialAction: FINANCIAL_ACTIONS.ADD_COBRO
      }
    });
  });

  it('usa onAddConsumo para la comanda sin navegar', async () => {
    const user = userEvent.setup();
    const onAddConsumo = vi.fn();
    const reservation = { id: 7, segments: [{ roomId: 3 }] };
    render(<ReservationPanelActions reservation={reservation} onAddConsumo={onAddConsumo} />);

    await user.click(screen.getByTestId(`panel-action-${FINANCIAL_ACTIONS.ADD_CONSUMO}`));

    expect(onAddConsumo).toHaveBeenCalledWith(reservation);
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
