import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReservationPanelMoreMenu, { FINANCIAL_ACTIONS } from './ReservationPanelMoreMenu';

const navigateMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock
}));

describe('ReservationPanelMoreMenu', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it('renderiza el trigger kebab sin emoji', () => {
    render(<ReservationPanelMoreMenu reservation={{ id: 9 }} />);
    const trigger = screen.getByTestId('reservation-panel-more-menu');
    expect(trigger).toBeInTheDocument();
    expect(trigger.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('abre el menú con las tres acciones', async () => {
    const user = userEvent.setup();
    render(<ReservationPanelMoreMenu reservation={{ id: 9 }} />);

    await user.click(screen.getByTestId('reservation-panel-more-menu'));

    expect(screen.getByText('Agregar consumo')).toBeInTheDocument();
    expect(screen.getByText('Imprimir liquidación')).toBeInTheDocument();
    expect(screen.getByText('Agregar pago')).toBeInTheDocument();
  });

  it('navega a la página financiera con la acción elegida', async () => {
    const user = userEvent.setup();
    render(<ReservationPanelMoreMenu reservation={{ id: 42 }} />);

    await user.click(screen.getByTestId('reservation-panel-more-menu'));
    await user.click(screen.getByTestId(`panel-action-${FINANCIAL_ACTIONS.ADD_PAGO}`));

    expect(navigateMock).toHaveBeenCalledWith('/reservations/42', {
      state: {
        activeTab: 'financiero',
        financialAction: FINANCIAL_ACTIONS.ADD_PAGO
      }
    });
  });

  it('usa onAddConsumo para la comanda sin navegar', async () => {
    const user = userEvent.setup();
    const onAddConsumo = vi.fn();
    const reservation = { id: 7, segments: [{ roomId: 3 }] };
    render(
      <ReservationPanelMoreMenu reservation={reservation} onAddConsumo={onAddConsumo} />
    );

    await user.click(screen.getByTestId('reservation-panel-more-menu'));
    await user.click(screen.getByTestId(`panel-action-${FINANCIAL_ACTIONS.ADD_CONSUMO}`));

    expect(onAddConsumo).toHaveBeenCalledWith(reservation);
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
