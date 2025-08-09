import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSeasonBlock } from './useSeasonBlock';

// Mock de fetch
global.fetch = vi.fn();

describe('useSeasonBlock', () => {
  const mockRoomTypes = [
    { id: 1, name: 'Habitación Simple' },
    { id: 2, name: 'Habitación Doble' }
  ];

  const mockServiceTypes = [
    { id: 'service-1', name: 'Desayuno' },
    { id: 'service-2', name: 'Media Pensión' }
  ];

  const mockSeasonBlock = {
    id: 'test-block',
    name: 'Temporada Alta',
    description: 'Temporada de verano',
    startDate: '2025-01-01T00:00:00.000Z',
    endDate: '2025-03-31T00:00:00.000Z',
    seasonPrices: [
      { roomTypeId: 1, basePrice: 50000 }
    ],
    seasonServiceAdjustments: [
      { roomTypeId: 1, serviceTypeId: 'service-1', mode: 'PERCENTAGE', value: 10 }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful responses por defecto
    fetch.mockImplementation((url) => {
      if (url.includes('/room-types')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockRoomTypes)
        });
      }
      if (url.includes('/service-types')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockServiceTypes)
        });
      }
      if (url.includes('/season-blocks/test-block')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSeasonBlock)
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useSeasonBlock(null, 'test-hotel'));

    expect(result.current.loading).toBe(false);
    expect(result.current.saving).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.formData.name).toBe('');
    expect(result.current.formData.description).toBe('');
    expect(result.current.formData.startDate).toBe('');
    expect(result.current.formData.endDate).toBe('');
  });

  it('should load reference data when hotelId is provided', async () => {
    const { result } = renderHook(() => useSeasonBlock(null, 'test-hotel'));

    await waitFor(() => {
      expect(result.current.roomTypes).toEqual(mockRoomTypes);
      expect(result.current.serviceTypes).toEqual(mockServiceTypes);
    });

    expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/room-types');
    expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/service-types');
  });

  it('should load season block data when blockId is provided', async () => {
    const { result } = renderHook(() => useSeasonBlock('test-block', 'test-hotel'));

    await waitFor(() => {
      expect(result.current.formData.name).toBe('Temporada Alta');
      expect(result.current.formData.description).toBe('Temporada de verano');
      expect(result.current.formData.startDate).toBe('2025-01-01');
      expect(result.current.formData.endDate).toBe('2025-03-31');
    });

    expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/season-blocks/test-block');
  });

  it('should update form data correctly', async () => {
    const { result } = renderHook(() => useSeasonBlock(null, 'test-hotel'));

    await waitFor(() => {
      expect(result.current.roomTypes.length).toBeGreaterThan(0);
    });

    act(() => {
      result.current.updateFormData('name', 'Nueva Temporada');
    });

    expect(result.current.formData.name).toBe('Nueva Temporada');
  });

  it('should update season price correctly', async () => {
    const { result } = renderHook(() => useSeasonBlock(null, 'test-hotel'));

    await waitFor(() => {
      expect(result.current.formData.seasonPrices.length).toBeGreaterThan(0);
    });

    act(() => {
      result.current.updateSeasonPrice(1, '60000');
    });

    const price = result.current.formData.seasonPrices.find(p => p.roomTypeId === 1);
    expect(price.basePrice).toBe(60000);
  });

  it('should update service adjustment correctly', async () => {
    const { result } = renderHook(() => useSeasonBlock(null, 'test-hotel'));

    await waitFor(() => {
      expect(result.current.formData.serviceAdjustments.length).toBeGreaterThan(0);
    });

    act(() => {
      result.current.updateServiceAdjustment(1, 'service-1', 'value', '15');
    });

    const adjustment = result.current.formData.serviceAdjustments.find(
      adj => adj.roomTypeId === 1 && adj.serviceTypeId === 'service-1'
    );
    expect(adjustment.value).toBe(15);
  });

  it('should validate form correctly', async () => {
    const { result } = renderHook(() => useSeasonBlock(null, 'test-hotel'));

    await waitFor(() => {
      expect(result.current.roomTypes.length).toBeGreaterThan(0);
    });

    // Formulario vacío debería fallar validación
    act(() => {
      const isValid = result.current.validateForm();
      expect(isValid).toBe(false);
    });

    expect(result.current.validationErrors.name).toBeTruthy();
    expect(result.current.validationErrors.startDate).toBeTruthy();
    expect(result.current.validationErrors.endDate).toBeTruthy();
  });

  it('should save season block successfully', async () => {
    fetch.mockImplementation((url, options) => {
      if (options?.method === 'POST' && url.includes('/season-blocks')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'new-block', name: 'Test Block' })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(url.includes('/room-types') ? mockRoomTypes : mockServiceTypes)
      });
    });

    const { result } = renderHook(() => useSeasonBlock(null, 'test-hotel'));

    await waitFor(() => {
      expect(result.current.roomTypes.length).toBeGreaterThan(0);
    });

    // Configurar datos válidos
    act(() => {
      result.current.updateFormData('name', 'Test Block');
      result.current.updateFormData('startDate', '2025-01-01');
      result.current.updateFormData('endDate', '2025-12-31');
      result.current.updateSeasonPrice(1, '50000');
    });

    let saveResult;
    await act(async () => {
      saveResult = await result.current.saveSeasonBlock();
    });

    expect(saveResult.success).toBe(true);
    expect(saveResult.data.id).toBe('new-block');
  });

  it('should handle save conflict', async () => {
    fetch.mockImplementation((url, options) => {
      if (options?.method === 'POST' && url.includes('/season-blocks')) {
        return Promise.resolve({
          status: 409,
          json: () => Promise.resolve({ message: 'Conflict detected' })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(url.includes('/room-types') ? mockRoomTypes : mockServiceTypes)
      });
    });

    const { result } = renderHook(() => useSeasonBlock(null, 'test-hotel'));

    await waitFor(() => {
      expect(result.current.roomTypes.length).toBeGreaterThan(0);
    });

    // Configurar datos válidos
    act(() => {
      result.current.updateFormData('name', 'Test Block');
      result.current.updateFormData('startDate', '2025-01-01');
      result.current.updateFormData('endDate', '2025-12-31');
      result.current.updateSeasonPrice(1, '50000');
    });

    let saveResult;
    await act(async () => {
      saveResult = await result.current.saveSeasonBlock();
    });

    expect(saveResult.success).toBe(false);
    expect(saveResult.hasConflict).toBe(true);
  });

  it('should delete season block successfully', async () => {
    fetch.mockImplementation((url, options) => {
      if (options?.method === 'DELETE' && url.includes('/season-blocks/test-block')) {
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(url.includes('/room-types') ? mockRoomTypes : mockServiceTypes)
      });
    });

    const { result } = renderHook(() => useSeasonBlock('test-block', 'test-hotel'));

    let deleteResult;
    await act(async () => {
      deleteResult = await result.current.deleteSeasonBlock();
    });

    expect(deleteResult.success).toBe(true);
  });

  it('should handle copy operations correctly', async () => {
    const { result } = renderHook(() => useSeasonBlock(null, 'test-hotel'));

    await waitFor(() => {
      expect(result.current.formData.serviceAdjustments.length).toBeGreaterThan(0);
    });

    // Configurar un valor inicial
    act(() => {
      result.current.updateServiceAdjustment(1, 'service-1', 'value', '20');
      result.current.updateServiceAdjustment(1, 'service-1', 'mode', 'FIXED');
    });

    // Copiar a toda la fila
    act(() => {
      result.current.copyValueToRow(1, 'service-1', 20, 'FIXED');
    });

    const rowAdjustments = result.current.formData.serviceAdjustments.filter(
      adj => adj.roomTypeId === 1
    );
    rowAdjustments.forEach(adj => {
      expect(adj.value).toBe(20);
      expect(adj.mode).toBe('FIXED');
    });
  });

  it('should clone season block correctly', async () => {
    const { result } = renderHook(() => useSeasonBlock('test-block', 'test-hotel'));

    await waitFor(() => {
      expect(result.current.formData.name).toBe('Temporada Alta');
    });

    act(() => {
      result.current.cloneSeasonBlock();
    });

    expect(result.current.formData.name).toBe('Temporada Alta (Copia)');
    expect(result.current.formData.startDate).toBe('');
    expect(result.current.formData.endDate).toBe('');
  });

  it('should handle API errors gracefully', async () => {
    fetch.mockImplementation(() => {
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ message: 'API Error' })
      });
    });

    const { result } = renderHook(() => useSeasonBlock(null, 'test-hotel'));

    await waitFor(() => {
      expect(result.current.error).toBe('Error al cargar datos de referencia');
    });
  });
}); 