import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HuespedesTab from './HuespedesTab';

vi.mock('../../hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    confirm: vi.fn(async () => true),
    confirmDialog: null
  })
}));

vi.mock('../../hooks/useAppNotice', () => ({
  useAppNotice: () => ({
    notify: vi.fn(),
    noticeDialog: null
  })
}));

vi.mock('../../services/api', () => ({
  API_URL: 'http://test/api',
  getClientDocumentPhotos: vi.fn(async () => ({
    front: { exists: false },
    back: { exists: false }
  })),
  uploadClientDocumentPhoto: vi.fn(async () => ({ originalName: 'doc.jpg' }))
}));

const baseReservation = {
  id: 42,
  mainClientId: 7,
  mainClient: {
    id: 7,
    firstName: 'Martín',
    lastName: 'González',
    email: 'martin@example.com',
    phone: '123',
    documentType: 'DNI',
    documentNumber: '111'
  },
  segments: [{ guestCount: 2, isActive: true, startDate: '2026-12-01', endDate: '2026-12-05' }],
  guests: [
    {
      id: 100,
      firstName: 'Martín',
      lastName: 'González',
      clientId: 7,
      documentType: 'DNI',
      documentNumber: '111'
    }
  ]
};

describe('HuespedesTab — responsable vs huéspedes', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('muestra Responsable y marca que también es huésped', () => {
    render(<HuespedesTab reservation={baseReservation} />);
    expect(screen.getByTestId('guest-holder-card')).toBeInTheDocument();
    expect(screen.getByText('Responsable')).toBeInTheDocument();
    expect(screen.getByTestId('holder-guest-status')).toHaveTextContent(
      'También figura como huésped'
    );
    expect(screen.getByTestId('holder-guest-card')).toBeInTheDocument();
    expect(screen.queryByTestId('include-holder-as-guest')).not.toBeInTheDocument();
  });

  it('permite quitar al responsable de huéspedes sin perder la card de responsable', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    render(<HuespedesTab reservation={baseReservation} />);

    fireEvent.click(screen.getByTestId('remove-holder-guest'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://test/api/guests/100',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    await waitFor(() => {
      expect(screen.queryByTestId('holder-guest-card')).not.toBeInTheDocument();
      expect(screen.getByTestId('guest-holder-card')).toBeInTheDocument();
      expect(screen.getByTestId('holder-guest-status')).toHaveTextContent(
        'No se aloja en esta habitación'
      );
      expect(screen.getByTestId('include-holder-as-guest')).toBeInTheDocument();
    });
  });

  it('capacidad usa guestCount completo (no guestCount-1)', () => {
    const withoutHolder = {
      ...baseReservation,
      guests: []
    };
    render(<HuespedesTab reservation={withoutHolder} />);
    // guestCount=2 y 0 huéspedes → 2 slots vacíos
    expect(screen.getAllByTestId('empty-guest-slot')).toHaveLength(2);
  });
});
