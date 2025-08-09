import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import EditPanel from './EditPanel'

describe('EditPanel', () => {
  const mockProps = {
    title: 'Test Panel',
    subtitle: 'Test Subtitle',
    isEditing: false,
    onEditToggle: vi.fn(),
    onSave: vi.fn(),
    onDelete: vi.fn(),
    children: <div data-testid="panel-content">Panel Content</div>,
    saveButtonText: 'Guardar Cambios',
    saveDisabled: false,
    showDeleteButton: false
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders panel with title and subtitle', () => {
    render(<EditPanel {...mockProps} />)
    
    expect(screen.getByText('Test Panel')).toBeInTheDocument()
    expect(screen.getByText('Test Subtitle')).toBeInTheDocument()
  })

  it('renders content when provided', () => {
    render(<EditPanel {...mockProps} />)
    
    expect(screen.getByTestId('panel-content')).toBeInTheDocument()
    expect(screen.getByText('Panel Content')).toBeInTheDocument()
  })

  it('shows edit button when not editing', () => {
    render(<EditPanel {...mockProps} />)
    
    const editButton = screen.getByTitle('Editar')
    expect(editButton).toBeInTheDocument()
  })

  it('shows cancel button when editing', () => {
    render(<EditPanel {...mockProps} isEditing={true} />)
    
    const cancelButton = screen.getByTitle('Cancelar edición')
    expect(cancelButton).toBeInTheDocument()
  })

  it('calls onEditToggle when edit button is clicked', () => {
    render(<EditPanel {...mockProps} />)
    
    const editButton = screen.getByTitle('Editar')
    fireEvent.click(editButton)
    
    expect(mockProps.onEditToggle).toHaveBeenCalled()
  })

  it('calls onEditToggle when cancel button is clicked', () => {
    render(<EditPanel {...mockProps} isEditing={true} />)
    
    const cancelButton = screen.getByTitle('Cancelar edición')
    fireEvent.click(cancelButton)
    
    expect(mockProps.onEditToggle).toHaveBeenCalled()
  })

  it('shows save button when editing', () => {
    render(<EditPanel {...mockProps} isEditing={true} />)
    
    const saveButton = screen.getByText('Guardar Cambios')
    expect(saveButton).toBeInTheDocument()
  })

  it('does not show save button when not editing', () => {
    render(<EditPanel {...mockProps} />)
    
    expect(screen.queryByText('Guardar Cambios')).not.toBeInTheDocument()
  })

  it('calls onSave when save button is clicked', () => {
    render(<EditPanel {...mockProps} isEditing={true} />)
    
    const saveButton = screen.getByText('Guardar Cambios')
    fireEvent.click(saveButton)
    
    expect(mockProps.onSave).toHaveBeenCalled()
  })

  it('disables save button when saveDisabled is true', () => {
    render(<EditPanel {...mockProps} isEditing={true} saveDisabled={true} />)
    
    const saveButton = screen.getByText('Guardar Cambios')
    expect(saveButton).toBeDisabled()
  })

  it('shows delete button when showDeleteButton is true and not editing', () => {
    render(<EditPanel {...mockProps} showDeleteButton={true} />)
    
    const deleteButton = screen.getByTitle('Eliminar')
    expect(deleteButton).toBeInTheDocument()
  })

  it('does not show delete button when showDeleteButton is false', () => {
    render(<EditPanel {...mockProps} showDeleteButton={false} />)
    
    expect(screen.queryByTitle('Eliminar')).not.toBeInTheDocument()
  })

  it('does not show delete button when editing', () => {
    render(<EditPanel {...mockProps} showDeleteButton={true} isEditing={true} />)
    
    expect(screen.queryByTitle('Eliminar')).not.toBeInTheDocument()
  })

  it('calls onDelete when delete button is clicked', () => {
    render(<EditPanel {...mockProps} showDeleteButton={true} />)
    
    const deleteButton = screen.getByTitle('Eliminar')
    fireEvent.click(deleteButton)
    
    expect(mockProps.onDelete).toHaveBeenCalled()
  })

  it('uses custom save button text', () => {
    render(<EditPanel {...mockProps} isEditing={true} saveButtonText="Custom Save" />)
    
    expect(screen.getByText('Custom Save')).toBeInTheDocument()
  })

  it('handles missing subtitle', () => {
    const propsWithoutSubtitle = { ...mockProps }
    delete propsWithoutSubtitle.subtitle
    
    render(<EditPanel {...propsWithoutSubtitle} />)
    
    expect(screen.getByText('Test Panel')).toBeInTheDocument()
    expect(screen.queryByText('Test Subtitle')).not.toBeInTheDocument()
  })

  it('handles missing title', () => {
    const propsWithoutTitle = { ...mockProps }
    delete propsWithoutTitle.title
    
    render(<EditPanel {...propsWithoutTitle} />)
    
    expect(screen.queryByText('Test Panel')).not.toBeInTheDocument()
    expect(screen.getByText('Test Subtitle')).toBeInTheDocument()
  })

  it('handles empty children', () => {
    render(<EditPanel {...mockProps} children={null} />)
    
    expect(screen.queryByTestId('panel-content')).not.toBeInTheDocument()
  })

  it('applies correct CSS classes', () => {
    render(<EditPanel {...mockProps} />)
    
    const panel = screen.getByText('Test Panel').closest('div')
    expect(panel).toBeInTheDocument()
  })

  it('handles multiple children', () => {
    const multipleChildren = (
      <>
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
      </>
    )
    
    render(<EditPanel {...mockProps} children={multipleChildren} />)
    
    expect(screen.getByTestId('child-1')).toBeInTheDocument()
    expect(screen.getByTestId('child-2')).toBeInTheDocument()
  })
}) 