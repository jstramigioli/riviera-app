/* eslint-env jest */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as api from './api';

// Mock de fetch global
global.fetch = vi.fn();

describe('api service', () => {
  const mockApiUrl = 'http://localhost:3001/api';

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock de las variables de entorno
    vi.stubEnv('VITE_API_URL', mockApiUrl);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('fetchReservations', () => {
    it('should fetch reservations successfully', async () => {
      const mockReservations = [
        { id: 1, checkIn: '2024-01-01', checkOut: '2024-01-03' },
        { id: 2, checkIn: '2024-01-02', checkOut: '2024-01-04' }
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockReservations
      });

      const result = await api.fetchReservations();

      expect(global.fetch).toHaveBeenCalledWith(`${mockApiUrl}/reservations`);
      expect(result).toEqual(mockReservations);
    });

    it('should throw error on fetch failure', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(api.fetchReservations()).rejects.toThrow('Network error');
    });

    it('should throw error on non-ok response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(api.fetchReservations()).rejects.toThrow('Error fetching reservations');
    });
  });

  describe('fetchClients', () => {
    it('should fetch clients successfully', async () => {
      const mockClients = [
        { id: 1, firstName: 'Juan', lastName: 'Pérez' },
        { id: 2, firstName: 'María', lastName: 'García' }
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockClients
      });

      const result = await api.fetchClients();

      expect(global.fetch).toHaveBeenCalledWith(`${mockApiUrl}/clients`);
      expect(result).toEqual(mockClients);
    });

    it('should throw error on fetch failure', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(api.fetchClients()).rejects.toThrow('Network error');
    });
  });

  describe('fetchRooms', () => {
    it('should fetch rooms successfully', async () => {
      const mockRooms = [
        { id: 1, name: 'Habitación 1' },
        { id: 2, name: 'Habitación 2' }
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRooms
      });

      const result = await api.fetchRooms();

      expect(global.fetch).toHaveBeenCalledWith(`${mockApiUrl}/rooms`);
      expect(result).toEqual(mockRooms);
    });
  });

  describe('createReservation', () => {
    it('should create reservation successfully', async () => {
      const mockReservation = {
        checkIn: '2024-01-01',
        checkOut: '2024-01-03',
        roomId: 1,
        mainClientId: 1
      };

      const mockCreatedReservation = { id: 1, ...mockReservation };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCreatedReservation
      });

      const result = await api.createReservation(mockReservation);

      expect(global.fetch).toHaveBeenCalledWith(`${mockApiUrl}/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockReservation)
      });
      expect(result).toEqual(mockCreatedReservation);
    });

    it('should throw error on creation failure', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      });

      await expect(api.createReservation({})).rejects.toThrow('Error creating reservation');
    });
  });

  describe('createClient', () => {
    it('should create client successfully', async () => {
      const mockClient = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan@example.com'
      };

      const mockCreatedClient = { id: 1, ...mockClient };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCreatedClient
      });

      const result = await api.createClient(mockClient);

      expect(global.fetch).toHaveBeenCalledWith(`${mockApiUrl}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockClient)
      });
      expect(result).toEqual(mockCreatedClient);
    });
  });

  describe('updateReservation', () => {
    it('should update reservation successfully', async () => {
      const reservationId = 1;
      const updateData = { checkOut: '2024-01-05' };
      const mockUpdatedReservation = { id: 1, checkIn: '2024-01-01', checkOut: '2024-01-05' };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUpdatedReservation
      });

      const result = await api.updateReservation(reservationId, updateData);

      expect(global.fetch).toHaveBeenCalledWith(`${mockApiUrl}/reservations/${reservationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      expect(result).toEqual(mockUpdatedReservation);
    });
  });

  describe('updateClient', () => {
    it('should update client successfully', async () => {
      const clientId = 1;
      const updateData = { firstName: 'Juan Carlos' };
      const mockUpdatedClient = { id: 1, firstName: 'Juan Carlos', lastName: 'Pérez' };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockUpdatedClient
      });

      const result = await api.updateClient(clientId, updateData);

      expect(global.fetch).toHaveBeenCalledWith(`${mockApiUrl}/clients/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      expect(result).toEqual(mockUpdatedClient);
    });
  });

  describe('deleteReservation', () => {
    it('should delete reservation successfully', async () => {
      const reservationId = 1;

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Reservation deleted successfully' })
      });

      await api.deleteReservation(reservationId);

      expect(global.fetch).toHaveBeenCalledWith(`${mockApiUrl}/reservations/${reservationId}`, {
        method: 'DELETE'
      });
    });

    it('should throw error on deletion failure', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(api.deleteReservation(999)).rejects.toThrow('Error deleting reservation');
    });
  });

  describe('getClientBalance', () => {
    it('should get client balance successfully', async () => {
      const clientId = 1;
      const mockBalance = {
        total: 1000,
        paid: 800,
        pending: 200
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockBalance
      });

      const result = await api.getClientBalance(clientId);

      expect(global.fetch).toHaveBeenCalledWith(`${mockApiUrl}/clients/${clientId}/balance`);
      expect(result).toEqual(mockBalance);
    });
  });

  describe('findAvailableRooms', () => {
    it('should find available rooms successfully', async () => {
      const searchParams = {
        checkIn: '2024-01-01',
        checkOut: '2024-01-03',
        requiredGuests: 2,
        requiredTags: [1, 2]
      };

      const mockResult = {
        availableRooms: [
          { id: 1, name: 'Habitación 1', maxPeople: 2, tags: [{ id: 1 }] }
        ],
        totalFound: 1
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult
      });

      const result = await api.findAvailableRooms(searchParams);

      const expectedUrl = `${mockApiUrl}/reservations/available-rooms?checkIn=${searchParams.checkIn}&checkOut=${searchParams.checkOut}&requiredGuests=${searchParams.requiredGuests}&requiredTags=1&requiredTags=2`;
      expect(global.fetch).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockResult);
    });

    it('should handle empty requiredTags', async () => {
      const searchParams = {
        checkIn: '2024-01-01',
        checkOut: '2024-01-03',
        requiredGuests: 2,
        requiredTags: []
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ availableRooms: [], totalFound: 0 })
      });

      await api.findAvailableRooms(searchParams);

      const expectedUrl = `${mockApiUrl}/reservations/available-rooms?checkIn=${searchParams.checkIn}&checkOut=${searchParams.checkOut}&requiredGuests=${searchParams.requiredGuests}`;
      expect(global.fetch).toHaveBeenCalledWith(expectedUrl);
    });
  });

  describe('fetchTags', () => {
    it('should fetch tags successfully', async () => {
      const mockTags = [
        { id: 1, name: 'WiFi', color: '#ff0000' },
        { id: 2, name: 'Aire Acondicionado', color: '#00ff00' }
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTags
      });

      const result = await api.fetchTags();

      expect(global.fetch).toHaveBeenCalledWith(`${mockApiUrl}/tags`);
      expect(result).toEqual(mockTags);
    });
  });

  describe('fetchRoomTypes', () => {
    it('should fetch room types successfully', async () => {
      const mockRoomTypes = [
        { id: 1, name: 'single', capacity: 1 },
        { id: 2, name: 'doble', capacity: 2 }
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRoomTypes
      });

      const result = await api.fetchRoomTypes();

      expect(global.fetch).toHaveBeenCalledWith(`${mockApiUrl}/room-types`);
      expect(result).toEqual(mockRoomTypes);
    });
  });



  describe('error handling', () => {
    it('should handle network errors consistently', async () => {
      const networkError = new Error('Network error');
      global.fetch.mockRejectedValue(networkError);

      await expect(api.fetchReservations()).rejects.toThrow('Network error');
      await expect(api.fetchClients()).rejects.toThrow('Network error');
      await expect(api.fetchRooms()).rejects.toThrow('Network error');
    });

    it('should handle HTTP errors consistently', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(api.fetchReservations()).rejects.toThrow('Error fetching reservations');
      await expect(api.fetchClients()).rejects.toThrow('Error fetching clients');
      await expect(api.fetchRooms()).rejects.toThrow('Error fetching rooms');
    });
  });
}); 