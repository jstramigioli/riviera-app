import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import RoomList from './RoomList'

describe('RoomList', () => {
  const mockRooms = [
    { id: 1, name: 'Habitación 101', type: 'Individual', status: 'available' },
    { id: 2, name: 'Habitación 102', type: 'Doble', status: 'occupied' }
  ]

  const mockProps = {
    rooms: mockRooms,
    onRoomClick: vi.fn(),
    selectedRoomId: null
  }

  it('renders room list with rooms', () => {
    render(<RoomList {...mockProps} />)
    expect(screen.getByText('Habitación 101')).toBeInTheDocument()
    expect(screen.getByText('Habitación 102')).toBeInTheDocument()
  })

  it('calls onRoomClick when room is clicked', () => {
    const mockOnRoomClick = vi.fn()
    render(<RoomList {...mockProps} onRoomClick={mockOnRoomClick} />)
    
    const firstRoom = screen.getByText('Habitación 101')
    fireEvent.click(firstRoom)
    
    expect(mockOnRoomClick).toHaveBeenCalledWith(1)
  })

  it('renders empty state when no rooms', () => {
    render(<RoomList {...mockProps} rooms={[]} />)
    expect(screen.getByText(/no hay habitaciones/i)).toBeInTheDocument()
  })

  it('highlights selected room', () => {
    render(<RoomList {...mockProps} selectedRoomId={1} />)
    const selectedRoom = screen.getByText('Habitación 101').closest('div')
    expect(selectedRoom).toHaveClass('selected')
  })
}) 