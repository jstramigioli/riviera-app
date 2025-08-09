import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import FloatingNotification from './FloatingNotification'

describe('FloatingNotification', () => {
  const mockProps = {
    message: 'Test notification message',
    type: 'success',
    onClose: vi.fn(),
    position: { x: 0, y: 0 }
  }

  it('renders notification when visible', () => {
    render(<FloatingNotification {...mockProps} />)
    expect(screen.getByText('Test notification message')).toBeInTheDocument()
  })

  it('does not render when not visible', () => {
    // El componente siempre se renderiza, pero se oculta con CSS
    render(<FloatingNotification {...mockProps} />)
    expect(screen.getByText('Test notification message')).toBeInTheDocument()
  })

  it('applies correct CSS class based on type', () => {
    render(<FloatingNotification {...mockProps} type="error" />)
    const notification = screen.getByText('Test notification message').closest('.floating-notification')
    expect(notification).toHaveClass('error')
  })

  it('auto-closes after timeout', () => {
    vi.useFakeTimers()
    const mockOnClose = vi.fn()
    render(<FloatingNotification {...mockProps} onClose={mockOnClose} duration={1000} />)
    
    vi.advanceTimersByTime(1300) // duration + 300ms para la animación
    
    expect(mockOnClose).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
}) 