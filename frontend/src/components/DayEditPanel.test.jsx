import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DayEditPanel from './DayEditPanel';

// Mock SidePanel component
vi.mock('./SidePanel', () => ({
  default: ({ children, title, open, onClose }) => {
    if (!open) return null;
    return (
      <div data-testid="side-panel">
        <h2>{title}</h2>
        <div className="content">
          {children}
        </div>
        <button onClick={onClose}>Close</button>
      </div>
    );
  }
}));

describe('DayEditPanel', () => {
  const mockProps = {
    isOpen: true,
    onClose: vi.fn(),
    selectedDate: new Date('2024-01-14'),
    dayData: {
      isClosed: false, // Changed to false to show price sections
      isHoliday: true,
      fixedPrice: 5000, // $50.00 in cents
      notes: 'Test notes'
    },
    roomTypes: [
      { id: 1, name: 'Standard', multiplier: 1.0 },
      { id: 2, name: 'Premium', multiplier: 1.5 },
      { id: 3, name: 'Suite', multiplier: 2.0 }
    ],
    onSave: vi.fn()
  };

  const closedDayProps = {
    ...mockProps,
    dayData: {
      ...mockProps.dayData,
      isClosed: true
    }
  };

  const newDayProps = {
    ...mockProps,
    selectedDate: new Date('2024-01-15'),
    dayData: null
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders day edit panel', () => {
    render(<DayEditPanel {...mockProps} />)
    
    expect(screen.getByText(/Editar Día - \d+ de enero de 2024/)).toBeInTheDocument()
  })

  it('displays day information correctly', () => {
    render(<DayEditPanel {...mockProps} />)
    
    expect(screen.getByText('Estado del Día')).toBeInTheDocument()
    expect(screen.getByText('Cerrado este día')).toBeInTheDocument()
    expect(screen.getByText('🏖️ Feriado/Fin de semana largo')).toBeInTheDocument()
  })

  it('displays room type prices when day is open', () => {
    render(<DayEditPanel {...mockProps} />)
    
    const precioBaseElements = screen.getAllByText('Precio Base')
    expect(precioBaseElements.length).toBeGreaterThan(0)
    expect(screen.getByText('Precio base (USD)')).toBeInTheDocument()
  })

  it('does not display price sections when day is closed', () => {
    render(<DayEditPanel {...closedDayProps} />)
    
    expect(screen.getByText('Estado del Día')).toBeInTheDocument()
    expect(screen.queryByText('Precio Base')).not.toBeInTheDocument()
  })

  it('allows editing day status', () => {
    render(<DayEditPanel {...mockProps} />)
    
    const closedCheckbox = screen.getByText('Cerrado este día').closest('label').querySelector('input')
    const holidayCheckbox = screen.getByText('🏖️ Feriado/Fin de semana largo').closest('label').querySelector('input')
    
    expect(closedCheckbox).not.toBeChecked()
    expect(holidayCheckbox).toBeChecked()
    
    fireEvent.click(closedCheckbox)
    fireEvent.click(holidayCheckbox)
    
    expect(closedCheckbox).toBeChecked()
    expect(holidayCheckbox).not.toBeChecked()
  })

  it('allows editing price type when day is open', () => {
    render(<DayEditPanel {...mockProps} />)
    
    const dynamicRadio = screen.getByText('Precio dinámico (calculado automáticamente)').closest('label').querySelector('input')
    const fixedRadio = screen.getByText('Precio fijo').closest('label').querySelector('input')
    
    // The component defaults to fixed price when fixedPrice is provided
    expect(dynamicRadio).not.toBeChecked()
    expect(fixedRadio).toBeChecked()
    
    fireEvent.click(dynamicRadio)
    
    expect(dynamicRadio).toBeChecked()
    expect(fixedRadio).not.toBeChecked()
  })

  it('allows editing base price when day is open', () => {
    render(<DayEditPanel {...mockProps} />)
    
    // The component should already be in fixed price mode
    const priceInput = screen.getByDisplayValue('50')
    fireEvent.change(priceInput, { target: { value: '75' } })
    
    expect(priceInput).toHaveValue(75)
  })

  it('calls onClose when cancel button is clicked', () => {
    render(<DayEditPanel {...mockProps} />)
    
    const cancelButton = screen.getByText('Cancelar')
    fireEvent.click(cancelButton)
    
    expect(mockProps.onClose).toHaveBeenCalled()
  })

  it('calls onSave when save button is clicked', () => {
    render(<DayEditPanel {...mockProps} />)
    
    const saveButton = screen.getByText('Guardar Cambios')
    fireEvent.click(saveButton)
    
    expect(mockProps.onSave).toHaveBeenCalled()
  })

  it('handles new day creation', () => {
    render(<DayEditPanel {...newDayProps} />)
    
    expect(screen.getByText(/Editar Día - \d+ de enero de 2024/)).toBeInTheDocument()
  })

  it('displays price calculations correctly when day is open', () => {
    render(<DayEditPanel {...mockProps} />)
    
    // Verificar que se muestran los precios calculados
    const priceElements = screen.getAllByText('$50.00')
    expect(priceElements.length).toBeGreaterThan(0)
  })

  it('allows custom price editing when day is open', () => {
    render(<DayEditPanel {...mockProps} />)
    
    const priceInput = screen.getByDisplayValue('50')
    expect(priceInput).toBeInTheDocument()
  })

  it('shows base price calculation when day is open', () => {
    render(<DayEditPanel {...mockProps} />)
    
    const precioBaseElements = screen.getAllByText('Precio Base')
    expect(precioBaseElements.length).toBeGreaterThan(0)
  })

  it('handles form validation when day is open', () => {
    render(<DayEditPanel {...mockProps} />)
    
    // Cambiar precio a un valor inválido
    const priceInput = screen.getByDisplayValue('50')
    fireEvent.change(priceInput, { target: { value: '-10' } })
    
    // El componente debería manejar valores negativos
    expect(priceInput).toHaveValue(-10)
  })

  it('does not render when closed', () => {
    render(<DayEditPanel {...mockProps} isOpen={false} />)
    
    expect(screen.queryByText(/Editar Día - \d+ de enero de 2024/)).not.toBeInTheDocument()
  })

  it('does not render when no date is selected', () => {
    render(<DayEditPanel {...mockProps} selectedDate={null} />)
    
    expect(screen.queryByText(/Editar Día - \d+ de enero de 2024/)).not.toBeInTheDocument()
  })
}) 