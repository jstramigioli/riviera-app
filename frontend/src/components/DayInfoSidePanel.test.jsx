/* eslint-env jest */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DayInfoSidePanel from './DayInfoSidePanel';

// Mock del componente SidePanel
vi.mock('./SidePanel', () => ({
  default: ({ children, title, open, onClose }) => {
    if (!open) return null;
    return (
      <div data-testid="side-panel">
        <h2>{title}</h2>
        <button onClick={onClose}>Cerrar</button>
        {children}
      </div>
    );
  }
}));

describe('DayInfoSidePanel', () => {
  const mockRooms = [
    { id: 1, name: 'Habitación 1' },
    { id: 2, name: 'Habitación 2' },
    { id: 3, name: 'Departamento A' }
  ];

  const mockReservations = [
    {
      id: 1,
      checkIn: '2024-01-01T10:00:00Z',
      checkOut: '2024-01-03T10:00:00Z',
      mainClient: { firstName: 'Juan', lastName: 'Pérez' }
    },
    {
      id: 2,
      checkIn: '2024-01-02T10:00:00Z',
      checkOut: '2024-01-04T10:00:00Z',
      mainClient: { firstName: 'María', lastName: 'García' }
    },
    {
      id: 3,
      checkIn: '2024-01-01T10:00:00Z',
      checkOut: '2024-01-02T10:00:00Z', // Checkout en el día seleccionado
      mainClient: { firstName: 'Carlos', lastName: 'López' }
    }
  ];

  const mockSelectedDate = new Date('2024-01-02T12:00:00Z');

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock de console.log para evitar ruido en los tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return null when no selectedDate is provided', () => {
    const { container } = render(
      <DayInfoSidePanel 
        selectedDate={null}
        rooms={mockRooms}
        reservations={mockReservations}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render side panel when selectedDate is provided', () => {
    render(
      <DayInfoSidePanel 
        selectedDate={mockSelectedDate}
        rooms={mockRooms}
        reservations={mockReservations}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId('side-panel')).toBeInTheDocument();
  });

  it('should display correct date format in title', () => {
    render(
      <DayInfoSidePanel 
        selectedDate={mockSelectedDate}
        rooms={mockRooms}
        reservations={mockReservations}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Información del 2 de enero')).toBeInTheDocument();
  });

  it('should display full date format in content', () => {
    render(
      <DayInfoSidePanel 
        selectedDate={mockSelectedDate}
        rooms={mockRooms}
        reservations={mockReservations}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('martes, 2 de enero de 2024')).toBeInTheDocument();
  });

  it('should calculate correct statistics for active reservations', () => {
    render(
      <DayInfoSidePanel 
        selectedDate={mockSelectedDate}
        rooms={mockRooms}
        reservations={mockReservations}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Debería mostrar estadísticas calculadas
    // Las reservas activas son las que están ocupando habitación en el día seleccionado
    // (checkIn <= dayEnd && checkOut > dayEnd)
    expect(screen.getAllByText('2')).toHaveLength(2); // 2 habitaciones ocupadas
    expect(screen.getByText('3')).toBeInTheDocument(); // 3 habitaciones totales
  });

  it('should calculate check-ins correctly', () => {
    render(
      <DayInfoSidePanel 
        selectedDate={mockSelectedDate}
        rooms={mockRooms}
        reservations={mockReservations}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Debería mostrar 1 check-in (reserva 2)
    expect(screen.getAllByText('1')).toHaveLength(3);
  });

  it('should calculate check-outs correctly', () => {
    render(
      <DayInfoSidePanel 
        selectedDate={mockSelectedDate}
        rooms={mockRooms}
        reservations={mockReservations}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Debería mostrar 1 check-out (reserva 3)
    expect(screen.getAllByText('1')).toHaveLength(3);
  });

  it('should handle empty reservations', () => {
    render(
      <DayInfoSidePanel 
        selectedDate={mockSelectedDate}
        rooms={mockRooms}
        reservations={[]}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getAllByText('0')).toHaveLength(4); // Sin habitaciones ocupadas
    expect(screen.getAllByText('3')).toHaveLength(2); // 3 habitaciones totales
  });

  it('should handle empty rooms', () => {
    render(
      <DayInfoSidePanel 
        selectedDate={mockSelectedDate}
        rooms={[]}
        reservations={mockReservations}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('0')).toBeInTheDocument(); // Sin habitaciones totales
  });

  it('should calculate occupancy percentage correctly', () => {
    render(
      <DayInfoSidePanel 
        selectedDate={mockSelectedDate}
        rooms={mockRooms}
        reservations={mockReservations}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // 2 habitaciones ocupadas de 3 totales = 66.67%
    expect(screen.getAllByText('66.7%')).toHaveLength(4);
  });

  it('should handle reservations with same check-in and check-out date', () => {
    const sameDayReservations = [
      {
        id: 1,
        checkIn: '2024-01-02T10:00:00Z',
        checkOut: '2024-01-02T10:00:00Z',
        mainClient: { firstName: 'Juan', lastName: 'Pérez' }
      }
    ];

    render(
      <DayInfoSidePanel 
        selectedDate={mockSelectedDate}
        rooms={mockRooms}
        reservations={sameDayReservations}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // No debería contar como habitación ocupada (checkOut no es > dayEnd)
    expect(screen.getAllByText('0')).toHaveLength(2); // Sin habitaciones ocupadas
  });

  it('should handle reservations spanning multiple days', () => {
    const multiDayReservations = [
      {
        id: 1,
        checkIn: '2024-01-01T10:00:00Z',
        checkOut: '2024-01-05T10:00:00Z',
        mainClient: { firstName: 'Juan', lastName: 'Pérez' }
      }
    ];

    render(
      <DayInfoSidePanel 
        selectedDate={mockSelectedDate}
        rooms={mockRooms}
        reservations={multiDayReservations}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Debería contar como habitación ocupada
    expect(screen.getAllByText('1')).toHaveLength(2); // 1 habitación ocupada
  });

  it('should call onClose when close button is clicked', () => {
    const mockOnClose = vi.fn();

    render(
      <DayInfoSidePanel 
        selectedDate={mockSelectedDate}
        rooms={mockRooms}
        reservations={mockReservations}
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    const closeButton = screen.getByText('Cerrar');
    closeButton.click();

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should not render when isOpen is false', () => {
    const { container } = render(
      <DayInfoSidePanel 
        selectedDate={mockSelectedDate}
        rooms={mockRooms}
        reservations={mockReservations}
        isOpen={false}
        onClose={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should handle edge case with reservations at midnight', () => {
    const midnightReservations = [
      {
        id: 1,
        checkIn: '2024-01-02T00:00:00Z',
        checkOut: '2024-01-03T00:00:00Z',
        mainClient: { firstName: 'Juan', lastName: 'Pérez' }
      }
    ];

    render(
      <DayInfoSidePanel 
        selectedDate={mockSelectedDate}
        rooms={mockRooms}
        reservations={midnightReservations}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Debería contar como habitación ocupada
    expect(screen.getAllByText('1')).toHaveLength(1); // 1 habitación ocupada
  });
}); 