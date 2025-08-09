/* eslint-env jest */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReservationRequirements from './ReservationRequirements';

// Mock del hook useTags
vi.mock('../hooks/useTags', () => ({
  useTags: () => ({
    tags: [
      { id: 1, name: 'WiFi', color: '#ff0000' },
      { id: 2, name: 'Aire Acondicionado', color: '#00ff00' },
      { id: 3, name: 'Balcón', color: '#0000ff' }
    ]
  })
}));

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
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('should render tags section', () => {
    render(
      <ReservationRequirements 
        requirements={mockRequirements} 
        onRequirementsChange={mockOnRequirementsChange} 
      />
    );

    expect(screen.getByText('Etiquetas Requeridas:')).toBeInTheDocument();
    expect(screen.getByText('WiFi')).toBeInTheDocument();
    expect(screen.getByText('Aire Acondicionado')).toBeInTheDocument();
    expect(screen.getByText('Balcón')).toBeInTheDocument();
  });

  it('should handle guest count change', () => {
    render(
      <ReservationRequirements 
        requirements={mockRequirements} 
        onRequirementsChange={mockOnRequirementsChange} 
      />
    );

    const guestSelect = screen.getByRole('combobox');
    fireEvent.change(guestSelect, { target: { value: '4' } });

    expect(mockOnRequirementsChange).toHaveBeenCalledWith({
      ...mockRequirements,
      requiredGuests: 4,
      requiredRoomId: null
    });
  });

  it('should handle tag toggle - adding tag', () => {
    render(
      <ReservationRequirements 
        requirements={mockRequirements} 
        onRequirementsChange={mockOnRequirementsChange} 
      />
    );

    const tagButton = screen.getByText('Aire Acondicionado');
    fireEvent.click(tagButton);

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

    const tagButton = screen.getByText('WiFi');
    fireEvent.click(tagButton);

    expect(mockOnRequirementsChange).toHaveBeenCalledWith({
      ...requirementsWithTags,
      requiredTags: ['2'],
      requiredRoomId: null
    });
  });

  it('should handle invalid guest count gracefully', () => {
    render(
      <ReservationRequirements 
        requirements={mockRequirements} 
        onRequirementsChange={mockOnRequirementsChange} 
      />
    );

    const guestSelect = screen.getByRole('combobox');
    fireEvent.change(guestSelect, { target: { value: 'invalid' } });

    expect(mockOnRequirementsChange).toHaveBeenCalledWith({
      ...mockRequirements,
      requiredGuests: 1, // Default value when parsing fails
      requiredRoomId: null
    });
  });

  it('should handle empty guest count', () => {
    render(
      <ReservationRequirements 
        requirements={mockRequirements} 
        onRequirementsChange={mockOnRequirementsChange} 
      />
    );

    const guestSelect = screen.getByRole('combobox');
    fireEvent.change(guestSelect, { target: { value: '' } });

    expect(mockOnRequirementsChange).toHaveBeenCalledWith({
      ...mockRequirements,
      requiredGuests: 1, // Default value when parsing fails
      requiredRoomId: null
    });
  });

  it('should render all guest options', () => {
    render(
      <ReservationRequirements 
        requirements={mockRequirements} 
        onRequirementsChange={mockOnRequirementsChange} 
      />
    );

    const guestSelect = screen.getByRole('combobox');
    const options = guestSelect.querySelectorAll('option');

    expect(options).toHaveLength(8); // 1-8 guests
    expect(options[0].value).toBe('1');
    expect(options[0].textContent).toBe('1 huésped');
    expect(options[7].value).toBe('8');
    expect(options[7].textContent).toBe('8 huéspedes');
  });

  it('should show selected tags with different styling', () => {
    render(
      <ReservationRequirements 
        requirements={mockRequirements} 
        onRequirementsChange={mockOnRequirementsChange} 
      />
    );

    const selectedTag = screen.getByText('WiFi');
    const unselectedTag = screen.getByText('Aire Acondicionado');

    // Los tags seleccionados deberían tener un estilo diferente
    expect(selectedTag).toBeInTheDocument();
    expect(unselectedTag).toBeInTheDocument();
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

    const thirdTag = screen.getByText('Balcón');
    fireEvent.click(thirdTag);

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

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('WiFi')).toBeInTheDocument();
  });

  it('should reset requiredRoomId when guests change', () => {
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

    const guestSelect = screen.getByRole('combobox');
    fireEvent.change(guestSelect, { target: { value: '3' } });

    expect(mockOnRequirementsChange).toHaveBeenCalledWith({
      ...requirementsWithRoom,
      requiredGuests: 3,
      requiredRoomId: null
    });
  });

  it('should reset requiredRoomId when tags change', () => {
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

    const tagButton = screen.getByText('Aire Acondicionado');
    fireEvent.click(tagButton);

    expect(mockOnRequirementsChange).toHaveBeenCalledWith({
      ...requirementsWithRoom,
      requiredTags: ['1', '2'],
      requiredRoomId: null
    });
  });
}); 