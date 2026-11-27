import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import VentasGastronomia from './VentasGastronomia';

vi.mock('../../services/api', () => ({ fetchVentasGastronomia: vi.fn() }));
vi.mock('../../utils/calendarDates', () => ({ todayIsoLocal: () => '2026-12-15' }));
import { fetchVentasGastronomia } from '../../services/api';

const data = {
  desde: '2026-12-01',
  hasta: '2026-12-15',
  porAmbito: [
    { ambito: 'CENA', comandas: 2, unidades: 6, facturado: 120000, sinCargo: 0 },
    { ambito: 'MINUTAS', comandas: 1, unidades: 3, facturado: 3000, sinCargo: 12000 },
    { ambito: 'CAFETERIA', comandas: 0, unidades: 0, facturado: 0, sinCargo: 0 },
    { ambito: 'FRIGOBAR', comandas: 1, unidades: 1, facturado: 1500, sinCargo: 0 }
  ],
  porProducto: [
    { ambito: 'CENA', menuItemId: 9, producto: 'Cena buffet (Externo)', unidades: 6, facturado: 120000, sinCargo: 0 },
    { ambito: 'MINUTAS', menuItemId: 2, producto: 'Milanesa', unidades: 1, facturado: 0, sinCargo: 12000 },
    { ambito: 'FRIGOBAR', menuItemId: 1, producto: 'Agua', unidades: 1, facturado: 1500, sinCargo: 0 }
  ],
  totales: { comandas: 4, unidades: 10, facturado: 124500, sinCargo: 12000 }
};

describe('VentasGastronomia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchVentasGastronomia.mockResolvedValue({ data });
  });

  it('pide el mes en curso y muestra ventas por ámbito con totales', async () => {
    render(<VentasGastronomia />);
    const porAmbito = await screen.findByRole('region', { name: 'Ventas por ámbito' });
    expect(fetchVentasGastronomia).toHaveBeenCalledWith({ desde: '2026-12-01', hasta: '2026-12-15' });
    expect(within(porAmbito).getByText('Minutas')).toBeInTheDocument();
    expect(within(porAmbito).getByText('Total').closest('tr')).toHaveTextContent('124.500');
  });

  it('filtra productos por ámbito y cambia al mes anterior', async () => {
    const user = userEvent.setup();
    render(<VentasGastronomia />);
    const porProducto = await screen.findByRole('region', { name: 'Ventas por producto' });
    expect(within(porProducto).getAllByRole('row')).toHaveLength(4);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por ámbito' }), 'MINUTAS');
    expect(within(porProducto).getAllByRole('row')).toHaveLength(2);
    expect(within(porProducto).getByText('Milanesa')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mes anterior' }));
    await waitFor(() =>
      expect(fetchVentasGastronomia).toHaveBeenLastCalledWith({ desde: '2026-11-01', hasta: '2026-11-30' })
    );
  });
});
