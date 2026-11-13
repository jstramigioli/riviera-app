import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Habitaciones from './Habitaciones'

const navigate = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}))

vi.mock('../services/api', () => ({
  fetchRooms: vi.fn(),
  fetchReservations: vi.fn(),
}))

describe('Habitaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists rooms and opens profile on row click', async () => {
    const { fetchRooms, fetchReservations } = await import('../services/api')
    fetchRooms.mockResolvedValue([
      {
        id: 3,
        name: '101',
        maxPeople: 2,
        orderIndex: 0,
        roomType: { name: 'Doble' },
        tags: [{ name: 'jardín' }],
      },
    ])
    fetchReservations.mockResolvedValue([])

    render(<Habitaciones />)

    await waitFor(() => {
      expect(screen.getByText('101')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Listado' })).toBeInTheDocument()
    expect(screen.getByText('Doble')).toBeInTheDocument()

    await userEvent.click(screen.getByText('101'))
    expect(navigate).toHaveBeenCalledWith('/habitaciones/3')
  })
})
