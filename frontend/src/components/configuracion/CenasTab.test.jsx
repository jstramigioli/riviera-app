import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import CenasTab from './CenasTab';

vi.mock('../../services/api', () => ({
  fetchTiposCena: vi.fn(),
  createTipoCena: vi.fn(),
  updateTipoCena: vi.fn(),
  deleteTipoCena: vi.fn()
}));
import { fetchTiposCena, createTipoCena, updateTipoCena } from '../../services/api';

describe('CenasTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchTiposCena.mockResolvedValue({
      data: [{ id: 3, nombre: 'Cena habitual', precioAlojado: 18000, precioExterno: 22000, activo: true, usos: 5 }]
    });
    createTipoCena.mockResolvedValue({});
    updateTipoCena.mockResolvedValue({});
  });

  it('lista tipos con sus precios y permite agregar uno nuevo', async () => {
    const user = userEvent.setup();
    render(<CenasTab />);
    expect(await screen.findByDisplayValue('Cena habitual')).toBeInTheDocument();
    expect(fetchTiposCena).toHaveBeenCalledWith({ includeInactive: true });
    // Usado: no se puede eliminar (solo desactivar)
    expect(screen.queryByRole('button', { name: 'Eliminar Cena habitual' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Tipo de cena/ }));
    const nombres = screen.getAllByRole('textbox', { name: 'Nombre del tipo de cena' });
    await user.type(nombres[1], 'Cena temática');
    const alojado = screen.getAllByRole('spinbutton', { name: 'Precio alojado' })[1];
    await user.type(alojado, '20000');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(createTipoCena).toHaveBeenCalledWith({ nombre: 'Cena temática', precioAlojado: 20000, precioExterno: 0 })
    );
  });

  it('editar un precio muestra guardar/cancelar y guarda solo esa fila', async () => {
    const user = userEvent.setup();
    render(<CenasTab />);
    const externo = await screen.findByDisplayValue('22000');
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
    await user.clear(externo);
    await user.type(externo, '25000');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(updateTipoCena).toHaveBeenCalledWith(3, { nombre: 'Cena habitual', precioAlojado: 18000, precioExterno: 25000 })
    );
  });

  it('activar / desactivar', async () => {
    const user = userEvent.setup();
    render(<CenasTab />);
    await user.click(await screen.findByRole('button', { name: /Activo/ }));
    await waitFor(() => expect(updateTipoCena).toHaveBeenCalledWith(3, { activo: false }));
  });
});
