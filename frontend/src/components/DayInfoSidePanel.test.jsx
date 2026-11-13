/* eslint-env jest */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DayInfoSidePanel from './DayInfoSidePanel';

vi.mock('./SidePanel', () => ({
  default: ({ children, title, open, onClose }) => {
    if (!open) return null;
    return (
      <div data-testid="side-panel">
        <h2>{title}</h2>
        <button type="button" onClick={onClose}>Cerrar</button>
        {children}
      </div>
    );
  }
}));

function valueForLabel(label) {
  return screen.getByText(label).previousSibling;
}

describe('DayInfoSidePanel', () => {
  const mockRooms = [
    { id: 1, name: 'Habitación 1', maxPeople: 2 },
    { id: 2, name: 'Habitación 2', maxPeople: 2 },
    { id: 3, name: 'Departamento A', maxPeople: 4 }
  ]; // capacidad = 8

  const mockReservations = [
    {
      id: 1,
      checkIn: '2024-01-01T10:00:00Z',
      checkOut: '2024-01-03T10:00:00Z',
      roomId: 1,
      requiredGuests: 2,
      mainClient: { firstName: 'Juan', lastName: 'Pérez' }
    },
    {
      id: 2,
      checkIn: '2024-01-02T10:00:00Z',
      checkOut: '2024-01-04T10:00:00Z',
      roomId: 2,
      requiredGuests: 1,
      mainClient: { firstName: 'María', lastName: 'García' }
    },
    {
      id: 3,
      checkIn: '2024-01-01T10:00:00Z',
      checkOut: '2024-01-02T10:00:00Z',
      roomId: 3,
      requiredGuests: 3,
      mainClient: { firstName: 'Carlos', lastName: 'López' }
    }
  ];

  // ISO civil (evita desfases TZ con Date UTC en Argentina)
  const mockSelectedDate = '2024-01-02';

  beforeEach(() => {
    vi.clearAllMocks();
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
        isOpen
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
        isOpen
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
        isOpen
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('Información del 2 de enero')).toBeInTheDocument();
  });

  it('should calculate room and guest occupancy with correct denominators', () => {
    render(
      <DayInfoSidePanel
        selectedDate={mockSelectedDate}
        rooms={mockRooms}
        reservations={mockReservations}
        isOpen
        onClose={vi.fn()}
      />
    );

    // Día 2: reservas 1 y 2 ocupan (2 hab / 3 = 66.7%)
    // Pasajeros: 2+1=3 de 8 plazas = 37.5%
    expect(valueForLabel('Habitaciones Ocupadas')).toHaveTextContent('2');
    expect(valueForLabel('Pasajeros Alojados')).toHaveTextContent('3');
    expect(valueForLabel('Ocupación (Habitaciones)')).toHaveTextContent('66.7%');
    expect(valueForLabel('Ocupación (Pasajeros)')).toHaveTextContent('37.5%');
    expect(valueForLabel('Ingresos de Pasajeros')).toHaveTextContent('1');
    expect(valueForLabel('Salidas de Pasajeros')).toHaveTextContent('3');
    expect(screen.getByText('Capacidad de pasajeros:').nextSibling).toHaveTextContent('8');
  });

  it('should handle empty reservations', () => {
    render(
      <DayInfoSidePanel
        selectedDate={mockSelectedDate}
        rooms={mockRooms}
        reservations={[]}
        isOpen
        onClose={vi.fn()}
      />
    );
    expect(valueForLabel('Habitaciones Ocupadas')).toHaveTextContent('0');
    expect(valueForLabel('Pasajeros Alojados')).toHaveTextContent('0');
    expect(valueForLabel('Ocupación (Pasajeros)')).toHaveTextContent('0.0%');
  });

  it('should call onClose when close button is clicked', () => {
    const mockOnClose = vi.fn();
    render(
      <DayInfoSidePanel
        selectedDate={mockSelectedDate}
        rooms={mockRooms}
        reservations={mockReservations}
        isOpen
        onClose={mockOnClose}
      />
    );
    screen.getByText('Cerrar').click();
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
});
