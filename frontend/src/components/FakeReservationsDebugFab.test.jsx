import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FakeReservationsDebugFab from './FakeReservationsDebugFab';

const fetchMeta = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ realUser: { role: 'ADMIN', id: 1 } })
}));

vi.mock('../services/debugFakeReservationsApi', () => ({
  fetchFakeReservationsMeta: (...args) => fetchMeta(...args),
  previewFakeReservations: vi.fn(),
  generateFakeReservations: vi.fn(),
  deleteFakeReservationBatch: vi.fn(),
  deleteAllFakeReservations: vi.fn()
}));

describe('FakeReservationsDebugFab', () => {
  beforeEach(() => {
    fetchMeta.mockReset();
  });

  it('muestra el FAB Fake aunque meta falle (PGH-374)', async () => {
    fetchMeta.mockRejectedValue(new Error('Debug deshabilitado'));
    render(<FakeReservationsDebugFab />);
    expect(
      await screen.findByRole('button', {
        name: 'Abrir generador de reservas ficticias'
      })
    ).toBeInTheDocument();
  });

  it('con meta OK el FAB sigue visible', async () => {
    fetchMeta.mockResolvedValue({ scenarios: ['arrival_today'] });
    render(<FakeReservationsDebugFab />);
    await waitFor(() => expect(fetchMeta).toHaveBeenCalled());
    expect(
      screen.getByRole('button', { name: 'Abrir generador de reservas ficticias' })
    ).toBeInTheDocument();
  });
});
