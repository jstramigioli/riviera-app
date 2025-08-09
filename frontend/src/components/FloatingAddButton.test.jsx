import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import FloatingAddButton from './FloatingAddButton'

describe('FloatingAddButton', () => {
  it('renders the floating add button', () => {
    const mockOnClick = vi.fn()
    render(<FloatingAddButton onClick={mockOnClick} />)
    
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const mockOnClick = vi.fn()
    render(<FloatingAddButton onClick={mockOnClick} />)
    
    const button = screen.getByRole('button')
    fireEvent.click(button)
    
    expect(mockOnClick).toHaveBeenCalledTimes(1)
  })

  it('has correct accessibility attributes', () => {
    const mockOnClick = vi.fn()
    render(<FloatingAddButton onClick={mockOnClick} />)
    
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-label')
  })
}) 