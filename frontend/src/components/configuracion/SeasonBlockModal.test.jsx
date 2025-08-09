import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SeasonBlockModal from './SeasonBlockModal';

// Mock del hook useSeasonBlock
vi.mock('../../hooks/useSeasonBlock', () => ({
  useSeasonBlock: vi.fn()
}));

// Mock de fetch
global.fetch = vi.fn();

// Mock de react-icons
vi.mock('react-icons/fi', () => ({
  FiX: () => <span data-testid="close-icon">×</span>,
  FiSave: () => <span data-testid="save-icon">💾</span>,
  FiTrash2: () => <span data-testid="trash-icon">🗑️</span>,
  FiCopy: () => <span data-testid="copy-icon">📋</span>,
  FiCalendar: () => <span data-testid="calendar-icon">📅</span>,
  FiDollarSign: () => <span data-testid="dollar-icon">💲</span>,
  FiSettings: () => <span data-testid="settings-icon">⚙️</span>
}));

// Mock del componente ConfirmationModal
vi.mock('../ConfirmationModal', () => ({
  default: ({ isOpen, onConfirm, onClose, title, message }) => 
    isOpen ? (
      <div data-testid="confirmation-modal">
        <h3>{title}</h3>
        <p>{message}</p>
        <button onClick={onConfirm}>Confirmar</button>
        <button onClick={onClose}>Cancelar</button>
      </div>
    ) : null
}));

describe('SeasonBlockModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    hotelId: 'test-hotel',
    onSaved: vi.fn(),
    onDeleted: vi.fn()
  };

  const mockRoomTypes = [
    { id: 1, name: 'Habitación Simple' },
    { id: 2, name: 'Habitación Doble' }
  ];

  const mockServiceTypes = [
    { id: 'service-1', name: 'Desayuno' },
    { id: 'service-2', name: 'Media Pensión' }
  ];

  const mockFormData = {
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    seasonPrices: [
      { roomTypeId: 1, basePrice: '' },
      { roomTypeId: 2, basePrice: '' }
    ],
    serviceAdjustments: [
      { roomTypeId: 1, serviceTypeId: 'service-1', mode: 'PERCENTAGE', value: '' },
      { roomTypeId: 1, serviceTypeId: 'service-2', mode: 'PERCENTAGE', value: '' },
      { roomTypeId: 2, serviceTypeId: 'service-1', mode: 'PERCENTAGE', value: '' },
      { roomTypeId: 2, serviceTypeId: 'service-2', mode: 'PERCENTAGE', value: '' }
    ]
  };

  const mockUseSeasonBlock = {
    loading: false,
    saving: false,
    error: null,
    formData: mockFormData,
    roomTypes: mockRoomTypes,
    serviceTypes: mockServiceTypes,
    validationErrors: {},
    updateFormData: vi.fn(),
    updateSeasonPrice: vi.fn(),
    updateServiceAdjustment: vi.fn(),
    copyValueToRow: vi.fn(),
    copyValueToColumn: vi.fn(),
    copyValueToAll: vi.fn(),
    saveSeasonBlock: vi.fn(),
    deleteSeasonBlock: vi.fn(),
    cloneSeasonBlock: vi.fn(),
    setError: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    const { useSeasonBlock } = require('../../hooks/useSeasonBlock');
    useSeasonBlock.mockReturnValue(mockUseSeasonBlock);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal when isOpen is true', () => {
    render(<SeasonBlockModal {...defaultProps} />);
    
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Nuevo Bloque de Temporada')).toBeInTheDocument();
  });

  it('should not render modal when isOpen is false', () => {
    render(<SeasonBlockModal {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should show edit title when blockId is provided', () => {
    render(<SeasonBlockModal {...defaultProps} blockId="test-block-id" />);
    
    expect(screen.getByText('Editar Bloque de Temporada')).toBeInTheDocument();
  });

  it('should display loading state', () => {
    const { useSeasonBlock } = require('../../hooks/useSeasonBlock');
    useSeasonBlock.mockReturnValue({
      ...mockUseSeasonBlock,
      loading: true
    });

    render(<SeasonBlockModal {...defaultProps} />);
    
    expect(screen.getByText('Cargando datos...')).toBeInTheDocument();
  });

  it('should display error state', () => {
    const { useSeasonBlock } = require('../../hooks/useSeasonBlock');
    useSeasonBlock.mockReturnValue({
      ...mockUseSeasonBlock,
      error: 'Error de prueba'
    });

    render(<SeasonBlockModal {...defaultProps} />);
    
    expect(screen.getByText('Error al cargar los datos')).toBeInTheDocument();
    expect(screen.getByText('Error de prueba')).toBeInTheDocument();
  });

  it('should render form fields correctly', () => {
    render(<SeasonBlockModal {...defaultProps} />);
    
    expect(screen.getByLabelText('Nombre del Bloque')).toBeInTheDocument();
    expect(screen.getByLabelText('Descripción')).toBeInTheDocument();
    expect(screen.getByLabelText('Fecha de Inicio')).toBeInTheDocument();
    expect(screen.getByLabelText('Fecha de Fin')).toBeInTheDocument();
  });

  it('should render room types and service types tables', () => {
    render(<SeasonBlockModal {...defaultProps} />);
    
    // Tabla de tarifas base
    expect(screen.getByText('Tarifas Base por Habitación')).toBeInTheDocument();
    expect(screen.getByText('Habitación Simple')).toBeInTheDocument();
    expect(screen.getByText('Habitación Doble')).toBeInTheDocument();
    
    // Tabla de ajustes por servicio
    expect(screen.getByText('Ajustes por Servicio')).toBeInTheDocument();
    expect(screen.getByText('Desayuno')).toBeInTheDocument();
    expect(screen.getByText('Media Pensión')).toBeInTheDocument();
  });

  it('should call updateFormData when form fields change', async () => {
    const user = userEvent.setup();
    render(<SeasonBlockModal {...defaultProps} />);
    
    const nameInput = screen.getByLabelText('Nombre del Bloque');
    await user.type(nameInput, 'Temporada Alta');
    
    expect(mockUseSeasonBlock.updateFormData).toHaveBeenCalledWith('name', 'Temporada Alta');
  });

  it('should call updateSeasonPrice when price input changes', async () => {
    const user = userEvent.setup();
    render(<SeasonBlockModal {...defaultProps} />);
    
    const priceInput = screen.getByLabelText('Tarifa base para Habitación Simple');
    await user.type(priceInput, '50000');
    
    expect(mockUseSeasonBlock.updateSeasonPrice).toHaveBeenCalledWith(1, '50000');
  });

  it('should call updateServiceAdjustment when adjustment input changes', async () => {
    const user = userEvent.setup();
    render(<SeasonBlockModal {...defaultProps} />);
    
    const adjustmentInputs = screen.getAllByLabelText(/Valor de ajuste para/);
    await user.type(adjustmentInputs[0], '10');
    
    expect(mockUseSeasonBlock.updateServiceAdjustment).toHaveBeenCalledWith(1, 'service-1', 'value', '10');
  });

  it('should handle save action', async () => {
    mockUseSeasonBlock.saveSeasonBlock.mockResolvedValue({ success: true, data: { id: 'new-block' } });
    
    const user = userEvent.setup();
    render(<SeasonBlockModal {...defaultProps} />);
    
    const saveButton = screen.getByText('Crear');
    await user.click(saveButton);
    
    expect(mockUseSeasonBlock.saveSeasonBlock).toHaveBeenCalledWith(false);
  });

  it('should handle save with conflict', async () => {
    mockUseSeasonBlock.saveSeasonBlock.mockResolvedValue({ 
      success: false, 
      hasConflict: true, 
      conflictData: { message: 'Conflicto detectado' } 
    });
    
    const user = userEvent.setup();
    render(<SeasonBlockModal {...defaultProps} />);
    
    const saveButton = screen.getByText('Crear');
    await user.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText('Conflicto de Fechas Detectado')).toBeInTheDocument();
    });
  });

  it('should handle delete action', async () => {
    mockUseSeasonBlock.deleteSeasonBlock.mockResolvedValue({ success: true });
    
    const user = userEvent.setup();
    render(<SeasonBlockModal {...defaultProps} blockId="test-block-id" />);
    
    const deleteButton = screen.getByText('Eliminar');
    await user.click(deleteButton);
    
    // Confirmar en el modal de confirmación
    const confirmButton = screen.getByText('Confirmar');
    await user.click(confirmButton);
    
    expect(mockUseSeasonBlock.deleteSeasonBlock).toHaveBeenCalled();
  });

  it('should handle clone action', async () => {
    const user = userEvent.setup();
    render(<SeasonBlockModal {...defaultProps} blockId="test-block-id" />);
    
    const cloneButton = screen.getByText('Clonar');
    await user.click(cloneButton);
    
    expect(mockUseSeasonBlock.cloneSeasonBlock).toHaveBeenCalled();
  });

  it('should handle quick copy actions', async () => {
    const user = userEvent.setup();
    render(<SeasonBlockModal {...defaultProps} />);
    
    const copyAllButton = screen.getByText('Copiar Todo');
    await user.click(copyAllButton);
    
    expect(mockUseSeasonBlock.copyValueToAll).toHaveBeenCalled();
  });

  it('should close modal when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<SeasonBlockModal {...defaultProps} />);
    
    const closeButton = screen.getByLabelText('Cerrar modal');
    await user.click(closeButton);
    
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should close modal when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<SeasonBlockModal {...defaultProps} />);
    
    const cancelButton = screen.getByText('Cancelar');
    await user.click(cancelButton);
    
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should handle keyboard navigation (Escape key)', () => {
    render(<SeasonBlockModal {...defaultProps} />);
    
    fireEvent.keyDown(document, { key: 'Escape' });
    
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should show validation errors', () => {
    const { useSeasonBlock } = require('../../hooks/useSeasonBlock');
    useSeasonBlock.mockReturnValue({
      ...mockUseSeasonBlock,
      validationErrors: {
        name: 'El nombre es requerido',
        startDate: 'La fecha de inicio es requerida'
      }
    });

    render(<SeasonBlockModal {...defaultProps} />);
    
    expect(screen.getByText('El nombre es requerido')).toBeInTheDocument();
    expect(screen.getByText('La fecha de inicio es requerida')).toBeInTheDocument();
  });

  it('should disable save button when saving', () => {
    const { useSeasonBlock } = require('../../hooks/useSeasonBlock');
    useSeasonBlock.mockReturnValue({
      ...mockUseSeasonBlock,
      saving: true
    });

    render(<SeasonBlockModal {...defaultProps} />);
    
    const saveButton = screen.getByText('Guardando...');
    expect(saveButton).toBeDisabled();
  });

  it('should show saving state in button', () => {
    const { useSeasonBlock } = require('../../hooks/useSeasonBlock');
    useSeasonBlock.mockReturnValue({
      ...mockUseSeasonBlock,
      saving: true
    });

    render(<SeasonBlockModal {...defaultProps} />);
    
    expect(screen.getByText('Guardando...')).toBeInTheDocument();
  });
}); 