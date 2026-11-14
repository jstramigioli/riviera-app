/* eslint-env jest */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReservationRequirements from './ReservationRequirements';

vi.mock('../hooks/useTags', () => ({
  useTags: () => ({
    tags: [
      { id: 1, name: 'WiFi', color: '#ff0000' },
      { id: 2, name: 'Aire Acondicionado', color: '#00ff00' },
      { id: 3, name: 'Balcón', color: '#0000ff' }
    ]
  })
}));

vi.mock('../services/api', () => ({
  fetchRooms: vi.fn(async () => [
    {
      id: 1,
      name: '101',
      maxPeople: 2,
      roomType: { name: 'Doble', maxPeople: 2 },
      beds: [{ bedType: 'double' }]
    },
    {
      id: 2,
      name: '201',
      maxPeople: 4,
      roomType: { name: 'Cuádruple', maxPeople: 4 },
      beds: [{ bedType: 'double' }, { bedType: 'double' }]
    },
    {
      id: 3,
      name: '102',
      maxPeople: 2,
      roomType: { name: 'Twin', maxPeople: 2 },
      beds: [{ bedType: 'single' }, { bedType: 'single' }]
    }
  ])
}));

const bedNone = {
  bedPreferenceNone: true,
  preferredDoubleBeds: 0,
  preferredSingleBeds: 0
};

describe('ReservationRequirements', () => {
  const mockRequirements = {
    requiredGuests: 2,
    requiredTags: ['1'],
    requiredRoomId: null
  };

  const mockOnRequirementsChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the component with title', () => {
    render(
      <ReservationRequirements
        requirements={mockRequirements}
        onRequirementsChange={mockOnRequirementsChange}
      />
    );

    expect(screen.getByText('Requerimientos de la Reserva')).toBeInTheDocument();
  });

  it('should render guest count selector', () => {
    render(
      <ReservationRequirements
        requirements={mockRequirements}
        onRequirementsChange={mockOnRequirementsChange}
      />
    );

    expect(screen.getByText('Cantidad de Huéspedes *:')).toBeInTheDocument();
    expect(screen.getByLabelText('Cantidad de huéspedes')).toBeInTheDocument();
  });

  it('should render tags section', () => {
    render(
      <ReservationRequirements
        requirements={mockRequirements}
        onRequirementsChange={mockOnRequirementsChange}
      />
    );

    expect(screen.getByText('Requerimientos:')).toBeInTheDocument();
    expect(screen.getByText('WiFi')).toBeInTheDocument();
    expect(screen.getByText('Aire Acondicionado')).toBeInTheDocument();
    expect(screen.getByText('Balcón')).toBeInTheDocument();
  });

  it('should handle guest count change', async () => {
    render(
      <ReservationRequirements
        requirements={mockRequirements}
        onRequirementsChange={mockOnRequirementsChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Cantidad de huéspedes').querySelectorAll('option').length).toBe(4);
    });

    fireEvent.change(screen.getByLabelText('Cantidad de huéspedes'), { target: { value: '4' } });

    expect(mockOnRequirementsChange).toHaveBeenCalledWith({
      ...mockRequirements,
      requiredGuests: 4,
      requiredRoomId: null,
      ...bedNone
    });
  });

  it('should handle tag toggle - adding tag', () => {
    render(
      <ReservationRequirements
        requirements={mockRequirements}
        onRequirementsChange={mockOnRequirementsChange}
      />
    );

    fireEvent.click(screen.getByText('Aire Acondicionado'));

    expect(mockOnRequirementsChange).toHaveBeenCalledWith({
      ...mockRequirements,
      requiredTags: ['1', '2'],
      requiredRoomId: null
    });
  });

  it('should handle tag toggle - removing tag', () => {
    const requirementsWithTags = {
      ...mockRequirements,
      requiredTags: ['1', '2']
    };

    render(
      <ReservationRequirements
        requirements={requirementsWithTags}
        onRequirementsChange={mockOnRequirementsChange}
      />
    );

    fireEvent.click(screen.getByText('WiFi'));

    expect(mockOnRequirementsChange).toHaveBeenCalledWith({
      ...requirementsWithTags,
      requiredTags: ['2'],
      requiredRoomId: null
    });
  });

  it('should handle invalid guest count gracefully', async () => {
    render(
      <ReservationRequirements
        requirements={mockRequirements}
        onRequirementsChange={mockOnRequirementsChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Cantidad de huéspedes').querySelectorAll('option').length).toBe(4);
    });

    fireEvent.change(screen.getByLabelText('Cantidad de huéspedes'), { target: { value: 'invalid' } });

    expect(mockOnRequirementsChange).toHaveBeenCalledWith({
      ...mockRequirements,
      requiredGuests: 1,
      requiredRoomId: null,
      ...bedNone
    });
  });

  it('should handle empty guest count', async () => {
    render(
      <ReservationRequirements
        requirements={mockRequirements}
        onRequirementsChange={mockOnRequirementsChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Cantidad de huéspedes').querySelectorAll('option').length).toBe(4);
    });

    fireEvent.change(screen.getByLabelText('Cantidad de huéspedes'), { target: { value: '' } });

    expect(mockOnRequirementsChange).toHaveBeenCalledWith({
      ...mockRequirements,
      requiredGuests: 1,
      requiredRoomId: null,
      ...bedNone
    });
  });

  it('should render all guest options from room capacities', async () => {
    render(
      <ReservationRequirements
        requirements={mockRequirements}
        onRequirementsChange={mockOnRequirementsChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Cantidad de huéspedes').querySelectorAll('option').length).toBe(4);
    });

    const options = screen.getByLabelText('Cantidad de huéspedes').querySelectorAll('option');
    expect(options[0].value).toBe('1');
    expect(options[0].textContent).toBe('1 huésped');
    expect(options[3].value).toBe('4');
    expect(options[3].textContent).toBe('4 huéspedes');
  });

  it('should show selected tags with different styling', () => {
    render(
      <ReservationRequirements
        requirements={mockRequirements}
        onRequirementsChange={mockOnRequirementsChange}
      />
    );

    expect(screen.getByText('WiFi')).toBeInTheDocument();
    expect(screen.getByText('Aire Acondicionado')).toBeInTheDocument();
  });

  it('should handle multiple tag selections', () => {
    const requirementsWithMultipleTags = {
      ...mockRequirements,
      requiredTags: ['1', '2']
    };

    render(
      <ReservationRequirements
        requirements={requirementsWithMultipleTags}
        onRequirementsChange={mockOnRequirementsChange}
      />
    );

    fireEvent.click(screen.getByText('Balcón'));

    expect(mockOnRequirementsChange).toHaveBeenCalledWith({
      ...requirementsWithMultipleTags,
      requiredTags: ['1', '2', '3'],
      requiredRoomId: null
    });
  });

  it('should handle empty requirements gracefully', () => {
    const emptyRequirements = {
      requiredGuests: 1,
      requiredTags: [],
      requiredRoomId: null
    };

    render(
      <ReservationRequirements
        requirements={emptyRequirements}
        onRequirementsChange={mockOnRequirementsChange}
      />
    );

    expect(screen.getByLabelText('Cantidad de huéspedes')).toBeInTheDocument();
    expect(screen.getByText('WiFi')).toBeInTheDocument();
  });

  it('should reset requiredRoomId when guests change', async () => {
    const requirementsWithRoom = {
      ...mockRequirements,
      requiredRoomId: 5
    };

    render(
      <ReservationRequirements
        requirements={requirementsWithRoom}
        onRequirementsChange={mockOnRequirementsChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Cantidad de huéspedes').querySelectorAll('option').length).toBe(4);
    });

    fireEvent.change(screen.getByLabelText('Cantidad de huéspedes'), { target: { value: '4' } });

    expect(mockOnRequirementsChange).toHaveBeenCalledWith({
      ...requirementsWithRoom,
      requiredGuests: 4,
      requiredRoomId: null,
      ...bedNone
    });
  });

  it('disables tags when a specific room is selected', () => {
    const requirementsWithRoom = {
      ...mockRequirements,
      requiredRoomId: 5
    };

    render(
      <ReservationRequirements
        requirements={requirementsWithRoom}
        onRequirementsChange={mockOnRequirementsChange}
      />
    );

    expect(screen.getByText('Aire Acondicionado')).toBeDisabled();
    fireEvent.click(screen.getByText('Aire Acondicionado'));
    expect(mockOnRequirementsChange).not.toHaveBeenCalled();
  });
});
