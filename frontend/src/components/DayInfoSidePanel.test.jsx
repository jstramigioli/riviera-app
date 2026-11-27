/* eslint-env jest */
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DayInfoSidePanel from './DayInfoSidePanel';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock
  };
});

// Desayunos / cenas vienen del backend (/api/comidas).
vi.mock('../services/api', () => ({
  fetchComidasDelDia: vi.fn()
}));
import { fetchComidasDelDia } from '../services/api';

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

function renderPanel(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('DayInfoSidePanel', () => {
  const mockRooms = [
    { id: 1, name: '12', maxPeople: 2 },
    { id: 2, name: '15', maxPeople: 2 },
    { id: 3, name: '8', maxPeople: 4 }
  ]; // capacidad = 8

  const mockReservations = [
    {
      id: 1,
      checkIn: '2024-01-01T10:00:00Z',
      checkOut: '2024-01-03T10:00:00Z',
      roomId: 1,
      requiredGuests: 2,
      reservationType: 'media_pension',
      mainClient: { firstName: 'Juan', lastName: 'Pérez' }
    },
    {
      id: 2,
      checkIn: '2024-01-02T10:00:00Z',
      checkOut: '2024-01-04T10:00:00Z',
      roomId: 2,
      requiredGuests: 1,
      reservationType: 'media_pension',
      mainClient: { firstName: 'María', lastName: 'García' }
    },
    {
      id: 3,
      checkIn: '2024-01-01T10:00:00Z',
      checkOut: '2024-01-02T10:00:00Z',
      roomId: 3,
      requiredGuests: 3,
      reservationType: 'media_pension',
      mainClient: { firstName: 'Carlos', lastName: 'López' }
    }
  ];

  // ISO civil (evita desfases TZ con Date UTC en Argentina)
  const mockSelectedDate = '2024-01-02';

  beforeEach(() => {
    vi.clearAllMocks();
    fetchComidasDelDia.mockResolvedValue({
      data: {
        fecha: '2024-01-02',
        desayunos: { total: 5, items: [] },
        cenas: { total: 3, items: [] }
      }
    });
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return null when no selectedDate is provided', () => {
    const { container } = renderPanel(
      <DayInfoSidePanel
        selectedDate={null}
        rooms={mockRooms}
        reservations={mockReservations}
        serviceTypes={[]}
        isOpen
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should render side panel when selectedDate is provided', () => {
    renderPanel(
      <DayInfoSidePanel
        selectedDate={mockSelectedDate}
        rooms={mockRooms}
        reservations={mockReservations}
        serviceTypes={[]}
        isOpen
        onClose={vi.fn()}
      />
    );
    expect(screen.getByTestId('side-panel')).toBeInTheDocument();
  });

  it('should display correct date format in title', () => {
    renderPanel(
      <DayInfoSidePanel
        selectedDate={mockSelectedDate}
        rooms={mockRooms}
        reservations={mockReservations}
        serviceTypes={[]}
        isOpen
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText(/2 de enero de 2024/i)).toBeInTheDocument();
    expect(screen.queryByText(/Información del/i)).not.toBeInTheDocument();
  });

  it('muestra ingresos/egresos en columnas con habitación - huésped y ocupación', async () => {
    const onClose = vi.fn();
    renderPanel(
      <DayInfoSidePanel
        selectedDate={mockSelectedDate}
        rooms={mockRooms}
        reservations={mockReservations}
        serviceTypes={[]}
        isOpen
        onClose={onClose}
      />
    );

    // Día 2: ingreso María hab 15, egreso Carlos hab 8
    expect(screen.getByText('Ingresos')).toBeInTheDocument();
    expect(screen.getByText('Egresos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '15 - María García' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '8 - Carlos López' })).toBeInTheDocument();

    // Totales: el total de ingresos es 1, egresos 3
    const ingresos = screen.getByText('Ingresos').closest('section');
    const egresos = screen.getByText('Egresos').closest('section');
    expect(ingresos).toHaveTextContent('1');
    expect(egresos).toHaveTextContent('3');

    screen.getByRole('button', { name: '15 - María García' }).click();
    expect(onClose).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith('/reservations/2');

    // Conteos del día (sin palabra «Total»)
    // Día 2: noche Juan(2)+María(1)=3; habs 2; desayuno 5 y cena 3 según el backend
    expect(screen.getByText('Pasajeros')).toBeInTheDocument();
    expect(screen.getByText('Habitaciones ocupadas')).toBeInTheDocument();
    expect(screen.getByText('Desayuno')).toBeInTheDocument();
    expect(screen.getByText('Cena')).toBeInTheDocument();
    expect(screen.queryByText(/Total/i)).not.toBeInTheDocument();

    expect(screen.getByText('Pasajeros').parentElement).toHaveTextContent(/^Pasajeros\s*3$/);
    expect(screen.getByText('Habitaciones ocupadas').parentElement).toHaveTextContent(
      /^Habitaciones ocupadas\s*2$/
    );
    await waitFor(() =>
      expect(screen.getByText('Desayuno').parentElement).toHaveTextContent(/^Desayuno\s*5$/)
    );
    expect(screen.getByText('Cena').parentElement).toHaveTextContent(/^Cena\s*3$/);
    expect(fetchComidasDelDia).toHaveBeenCalledWith('2024-01-02');

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
    renderPanel(
      <DayInfoSidePanel
        selectedDate={mockSelectedDate}
        rooms={mockRooms}
        reservations={[]}
        serviceTypes={[]}
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
    renderPanel(
      <DayInfoSidePanel
        selectedDate={mockSelectedDate}
        rooms={mockRooms}
        reservations={mockReservations}
        serviceTypes={[]}
        isOpen
        onClose={mockOnClose}
      />
    );
    screen.getByText('Cerrar').click();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should not render when isOpen is false', () => {
    const { container } = renderPanel(
      <DayInfoSidePanel
        selectedDate={mockSelectedDate}
        rooms={mockRooms}
        reservations={mockReservations}
        serviceTypes={[]}
        isOpen={false}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
