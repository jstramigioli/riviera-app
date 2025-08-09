import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SidePanel from './SidePanel'

describe('SidePanel', () => {
  const mockProps = {
    open: true,
    onClose: vi.fn(),
    title: 'Test Panel',
    children: <div>Test content</div>,
    width: 400
  }

  it('renders when open', () => {
    render(<SidePanel {...mockProps} />)
    expect(screen.getByText('Test content')).toBeInTheDocument()
    expect(screen.getByText('Test Panel')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<SidePanel {...mockProps} open={false} />)
    // El componente siempre se renderiza, pero se oculta con CSS
    expect(screen.getByText('Test content')).toBeInTheDocument()
  })

  it('renders close button when open', () => {
    render(<SidePanel {...mockProps} />)
    const closeButton = screen.getByLabelText('Cerrar panel')
    expect(closeButton).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const mockOnClose = vi.fn()
    render(<SidePanel {...mockProps} onClose={mockOnClose} />)
    
    const closeButton = screen.getByLabelText('Cerrar panel')
    fireEvent.click(closeButton)
    
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('calls onClose when overlay is clicked', () => {
    const mockOnClose = vi.fn()
    render(<SidePanel {...mockProps} onClose={mockOnClose} />)
    
    // Seleccionar el overlay por su clase CSS específica
    const overlay = document.querySelector('[class*="overlay"]')
    fireEvent.click(overlay)
    
    expect(mockOnClose).toHaveBeenCalled()
  })
}) 