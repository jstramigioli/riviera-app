import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import FloatingNotification from './FloatingNotification'

describe('FloatingNotification', () => {
  const mockProps = {
    message: 'Test notification message',
    type: 'success',
    onClose: vi.fn(),
    isVisible: true
  }

  it('renders notification when visible', () => {
    render(<FloatingNotification {...mockProps} />)
    expect(screen.getByText('Test notification message')).toBeInTheDocument()
  })

  it('does not render when not visible', () => {
    render(<FloatingNotification {...mockProps} isVisible={false} />)
    expect(screen.queryByText('Test notification message')).not.toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const mockOnClose = vi.fn()
    render(<FloatingNotification {...mockProps} onClose={mockOnClose} />)
    
    const closeButton = screen.getByRole('button', { name: /cerrar/i })
    fireEvent.click(closeButton)
    
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('applies correct CSS class based on type', () => {
    render(<FloatingNotification {...mockProps} type="error" />)
    const notification = screen.getByText('Test notification message').closest('div')
    expect(notification).toHaveClass('error')
  })

  it('auto-closes after timeout', () => {
    vi.useFakeTimers()
    const mockOnClose = vi.fn()
    render(<FloatingNotification {...mockProps} onClose={mockOnClose} />)
    
    vi.advanceTimersByTime(5000)
    
    expect(mockOnClose).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
}) 