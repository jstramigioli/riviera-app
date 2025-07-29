/* eslint-env jest */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSidePanel } from './useSidePanel';

// Mock del servicio API
vi.mock('../services/api.js', () => ({
  getClientBalance: vi.fn()
}));

describe('useSidePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useSidePanel());

    expect(result.current.sidePanelOpen).toBe(false);
    expect(result.current.selectedReservation).toBe(null);
    expect(result.current.selectedClient).toBe(null);
    expect(result.current.clientBalance).toBe(null);
    expect(result.current.isEditing).toBe(false);
    expect(result.current.editData).toBe(null);
    expect(result.current.panelMode).toBe('reservation');
  });

  it('should handle reservation click correctly', () => {
    const { result } = renderHook(() => useSidePanel());
    const mockReservation = { id: 1, checkIn: '2024-01-01', checkOut: '2024-01-03' };

    act(() => {
      result.current.handleReservationClick(mockReservation);
    });

    expect(result.current.sidePanelOpen).toBe(true);
    expect(result.current.selectedReservation).toBe(mockReservation);
    expect(result.current.selectedClient).toBe(null);
    expect(result.current.editData).toBe(mockReservation);
    expect(result.current.isEditing).toBe(false);
    expect(result.current.panelMode).toBe('reservation');
  });

  it('should handle client click correctly', async () => {
    const { result } = renderHook(() => useSidePanel());
    const mockClient = { id: 1, firstName: 'Juan', lastName: 'Pérez' };
    const mockBalance = { total: 1000, paid: 800, pending: 200 };

    // Mock de getClientBalance
    const { getClientBalance } = await import('../services/api.js');
    getClientBalance.mockResolvedValue(mockBalance);

    await act(async () => {
      await result.current.handleClientClick(mockClient);
    });

    expect(result.current.sidePanelOpen).toBe(true);
    expect(result.current.selectedClient).toBe(mockClient);
    expect(result.current.selectedReservation).toBe(null);
    expect(result.current.editData).toBe(mockClient);
    expect(result.current.isEditing).toBe(false);
    expect(result.current.panelMode).toBe('client');
    expect(result.current.clientBalance).toBe(mockBalance);
    expect(getClientBalance).toHaveBeenCalledWith(mockClient.id);
  });

  it('should handle client click error gracefully', async () => {
    const { result } = renderHook(() => useSidePanel());
    const mockClient = { id: 1, firstName: 'Juan', lastName: 'Pérez' };

    // Mock de getClientBalance para que falle
    const { getClientBalance } = await import('../services/api.js');
    getClientBalance.mockRejectedValue(new Error('Network error'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await act(async () => {
      await result.current.handleClientClick(mockClient);
    });

    expect(result.current.sidePanelOpen).toBe(true);
    expect(result.current.selectedClient).toBe(mockClient);
    expect(result.current.clientBalance).toBe(null);
    expect(consoleSpy).toHaveBeenCalledWith('Error loading client balance:', expect.any(Error));

    consoleSpy.mockRestore();
  });

  it('should handle edit change correctly', () => {
    const { result } = renderHook(() => useSidePanel());
    const mockReservation = { id: 1, checkIn: '2024-01-01', checkOut: '2024-01-03' };

    act(() => {
      result.current.handleReservationClick(mockReservation);
      result.current.handleEditChange('checkOut', '2024-01-05');
    });

    expect(result.current.editData).toEqual({
      ...mockReservation,
      checkOut: '2024-01-05'
    });
  });

  it('should handle edit toggle correctly', () => {
    const { result } = renderHook(() => useSidePanel());
    const mockReservation = { id: 1, checkIn: '2024-01-01', checkOut: '2024-01-03' };

    act(() => {
      result.current.handleReservationClick(mockReservation);
    });

    act(() => {
      result.current.handleEditToggle();
    });

    expect(result.current.isEditing).toBe(true);
    expect(result.current.editData).toEqual(mockReservation);

    act(() => {
      result.current.handleEditToggle();
    });

    expect(result.current.isEditing).toBe(false);
  });

  it('should handle edit toggle for client mode', () => {
    const { result } = renderHook(() => useSidePanel());
    const mockClient = { id: 1, firstName: 'Juan', lastName: 'Pérez' };

    act(() => {
      result.current.handleClientClick(mockClient);
    });

    act(() => {
      result.current.handleEditToggle();
    });

    expect(result.current.isEditing).toBe(true);
    expect(result.current.editData).toEqual(mockClient);
  });

  it('should close panel correctly', () => {
    const { result } = renderHook(() => useSidePanel());
    const mockReservation = { id: 1, checkIn: '2024-01-01', checkOut: '2024-01-03' };

    act(() => {
      result.current.handleReservationClick(mockReservation);
      result.current.closePanel();
    });

    expect(result.current.sidePanelOpen).toBe(false);
    expect(result.current.selectedReservation).toBe(null);
    expect(result.current.selectedClient).toBe(null);
    expect(result.current.clientBalance).toBe(null);
    expect(result.current.isEditing).toBe(false);
    expect(result.current.editData).toBe(null);
  });

  it('should provide all necessary setter functions', () => {
    const { result } = renderHook(() => useSidePanel());

    expect(typeof result.current.setSidePanelOpen).toBe('function');
    expect(typeof result.current.setSelectedReservation).toBe('function');
    expect(typeof result.current.setSelectedClient).toBe('function');
    expect(typeof result.current.setClientBalance).toBe('function');
    expect(typeof result.current.setIsEditing).toBe('function');
    expect(typeof result.current.setEditData).toBe('function');
    expect(typeof result.current.setPanelMode).toBe('function');
  });
}); 