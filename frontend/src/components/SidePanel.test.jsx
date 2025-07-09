import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SidePanel from './SidePanel'

describe('SidePanel', () => {
  const mockProps = {
    isOpen: true,
    onClose: vi.fn(),
    children: <div>Test content</div>
  }

  it('renders when open', () => {
    render(<SidePanel {...mockProps} />)
    expect(screen.getByText('Test content')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<SidePanel {...mockProps} isOpen={false} />)
    expect(screen.queryByText('Test content')).not.toBeInTheDocument()
  })

  it('renders close button when open', () => {
    render(<SidePanel {...mockProps} />)
    const closeButton = screen.getByRole('button', { name: /cerrar/i })
    expect(closeButton).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const mockOnClose = vi.fn()
    render(<SidePanel {...mockProps} onClose={mockOnClose} />)
    
    const closeButton = screen.getByRole('button', { name: /cerrar/i })
    closeButton.click()
    
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })
}) 