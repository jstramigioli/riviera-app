import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import HotelConfigPanel from './HotelConfigPanel';

const { getHotel, updateHotel } = vi.hoisted(() => ({
  getHotel: vi.fn(),
  updateHotel: vi.fn()
}));

vi.mock('../../services/api', () => ({
  getHotel,
  updateHotel,
  API_URL: '/api'
}));
vi.mock('../../services/api.js', () => ({
  getHotel,
  updateHotel,
  API_URL: '/api'
}));

describe('HotelConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] })
    });
  });

  it('renderiza el formulario de configuración del hotel', async () => {
    getHotel.mockResolvedValue({
      success: true,
      data: {
        name: 'Hotel Riviera',
        description: 'Un hotel de lujo',
        address: 'Calle Principal 123',
        phone: '+54 11 1234-5678',
        email: 'info@hotelriviera.com',
        website: 'https://hotelriviera.com'
      }
    });

    render(<HotelConfigPanel />);

    expect(await screen.findByText('Configuración del Hotel')).toBeInTheDocument();
    expect(screen.getByText('Edita la información básica del hotel')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Hotel Riviera')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nombre del hotel')).toBeInTheDocument();
    expect(screen.getByText('Guardar Cambios')).toBeInTheDocument();
  });

  it('maneja errores al cargar datos del hotel', async () => {
    // Mock de error en la API
    getHotel.mockRejectedValue(new Error('Error de red'));

    render(<HotelConfigPanel />);

    await waitFor(() => {
      expect(screen.getByText('Error al cargar los datos del hotel')).toBeInTheDocument();
    });
  });

  it('actualiza los campos del formulario', async () => {
    // Mock de la respuesta exitosa
    getHotel.mockResolvedValue({
      success: true,
      data: {
        name: 'Hotel Riviera',
        description: '',
        address: '',
        phone: '',
        email: '',
        website: ''
      }
    });

    render(<HotelConfigPanel />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Hotel Riviera')).toBeInTheDocument();
    });

    // Cambiar el nombre del hotel
    const nameInput = screen.getByPlaceholderText('Nombre del hotel');
    fireEvent.change(nameInput, { target: { value: 'Hotel Nuevo' } });

    expect(nameInput.value).toBe('Hotel Nuevo');
  });

  it('envía el formulario correctamente', async () => {
    // Mock de las respuestas de la API
    getHotel.mockResolvedValue({
      success: true,
      data: {
        name: 'Hotel Riviera',
        description: '',
        address: '',
        phone: '',
        email: '',
        website: ''
      }
    });

    updateHotel.mockResolvedValue({
      success: true,
      message: 'Información del hotel actualizada correctamente'
    });

    render(<HotelConfigPanel />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Hotel Riviera')).toBeInTheDocument();
    });

    // Cambiar algunos campos
    const nameInput = screen.getByPlaceholderText('Nombre del hotel');
    const emailInput = screen.getByPlaceholderText('correo@hotel.com');
    
    fireEvent.change(nameInput, { target: { value: 'Hotel Actualizado' } });
    fireEvent.change(emailInput, { target: { value: 'nuevo@hotel.com' } });

    // Enviar el formulario
    const submitButton = screen.getByText('Guardar Cambios');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(updateHotel).toHaveBeenCalledWith({
        name: 'Hotel Actualizado',
        description: '',
        address: '',
        phone: '',
        email: 'nuevo@hotel.com',
        website: ''
      });
    });

    // Verificar mensaje de éxito
    await waitFor(() => {
      expect(screen.getByText('Información del hotel actualizada correctamente')).toBeInTheDocument();
    });
  });

  it('maneja errores al enviar el formulario', async () => {
    // Mock de las respuestas de la API
    getHotel.mockResolvedValue({
      success: true,
      data: {
        name: 'Hotel Riviera',
        description: '',
        address: '',
        phone: '',
        email: '',
        website: ''
      }
    });

    updateHotel.mockRejectedValue(new Error('Error al actualizar la información'));

    render(<HotelConfigPanel />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Hotel Riviera')).toBeInTheDocument();
    });

    // Enviar el formulario
    const submitButton = screen.getByText('Guardar Cambios');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Error al actualizar la información')).toBeInTheDocument();
    });
  });

  it('valida que el nombre del hotel sea obligatorio', async () => {
    // Mock de la respuesta exitosa
    getHotel.mockResolvedValue({
      success: true,
      data: {
        name: 'Hotel Riviera',
        description: '',
        address: '',
        phone: '',
        email: '',
        website: ''
      }
    });

    render(<HotelConfigPanel />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Hotel Riviera')).toBeInTheDocument();
    });

    // Limpiar el campo nombre
    const nameInput = screen.getByPlaceholderText('Nombre del hotel');
    fireEvent.change(nameInput, { target: { value: '' } });

    // Verificar que el campo es requerido
    expect(nameInput).toBeRequired();
  });
}); 