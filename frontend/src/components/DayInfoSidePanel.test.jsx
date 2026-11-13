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
    expect(screen.getByText(/2 de enero de 2024/i)).toBeInTheDocument();
    expect(screen.queryByText(/Información del/i)).not.toBeInTheDocument();
  });

  it('muestra ingresos/salidas en columnas con nombres y ocupación en barras', () => {
    render(
      <DayInfoSidePanel
        selectedDate={mockSelectedDate}
        rooms={mockRooms}
        reservations={mockReservations}
        isOpen
        onClose={vi.fn()}
      />
    );

    // Día 2: ingreso María (1), salida Carlos (3)
    expect(screen.getByText('Ingresos')).toBeInTheDocument();
    expect(screen.getByText('Salidas')).toBeInTheDocument();
    expect(screen.getByText('María García')).toBeInTheDocument();
    expect(screen.getByText('Carlos López')).toBeInTheDocument();

    // Totales: el total de ingresos es 1, salidas 3
    const ingresos = screen.getByText('Ingresos').closest('section');
    const salidas = screen.getByText('Salidas').closest('section');
    expect(ingresos).toHaveTextContent('1');
    expect(salidas).toHaveTextContent('3');

    // Conteos del día (sin palabra «Total»)
    // Día 2: noche Juan(2)+María(1)=3; habs 2; desayuno Juan(2)+Carlos(3)=5; cena=3
    expect(screen.getByText('Pasajeros')).toBeInTheDocument();
    expect(screen.getByText('Habitaciones ocupadas')).toBeInTheDocument();
    expect(screen.getByText('Desayuno')).toBeInTheDocument();
    expect(screen.getByText('Cena')).toBeInTheDocument();
    expect(screen.queryByText(/Total/i)).not.toBeInTheDocument();

    expect(screen.getByText('Pasajeros').parentElement).toHaveTextContent(/^Pasajeros\s*3$/);
    expect(screen.getByText('Habitaciones ocupadas').parentElement).toHaveTextContent(
      /^Habitaciones ocupadas\s*2$/
    );
    expect(screen.getByText('Desayuno').parentElement).toHaveTextContent(/^Desayuno\s*5$/);
    expect(screen.getByText('Cena').parentElement).toHaveTextContent(/^Cena\s*3$/);

    // Barras de ocupación con %
    expect(screen.getByText('Ocupación habitaciones')).toBeInTheDocument();
    expect(screen.getByText('Ocupación pasajeros')).toBeInTheDocument();
    expect(screen.getByText('66.7%')).toBeInTheDocument();
    expect(screen.getByText('37.5%')).toBeInTheDocument();
    expect(screen.queryByText(/de \d+ habitaciones/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/de \d+ plazas/i)).not.toBeInTheDocument();

    const roomBar = screen.getByRole('progressbar', { name: 'Ocupación habitaciones' });
    const guestBar = screen.getByRole('progressbar', { name: 'Ocupación pasajeros' });
    expect(roomBar).toHaveAttribute('aria-valuenow', '66.7');
    expect(guestBar).toHaveAttribute('aria-valuenow', '37.5');
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
    expect(screen.queryByText('Sin movimientos')).not.toBeInTheDocument();
    expect(screen.getAllByText('0.0%').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/de \d+ plazas/i)).not.toBeInTheDocument();
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
