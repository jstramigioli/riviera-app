import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RoomDetails from './RoomDetails'

const navigate = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useParams: () => ({ roomId: '3' }),
}))

vi.mock('../services/api', () => ({
  fetchRooms: vi.fn(),
  fetchReservations: vi.fn(),
}))

describe('RoomDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows profile tabs without cleaning status', async () => {
    const { fetchRooms, fetchReservations } = await import('../services/api')
    fetchRooms.mockResolvedValue([
      {
        id: 3,
        name: '101',
        maxPeople: 2,
        description: 'Vista al jardín',
        roomType: { name: 'Doble' },
        tags: [],
      },
    ])
    fetchReservations.mockResolvedValue([
      {
        id: 9,
        status: 'CONFIRMADA',
        mainClient: { firstName: 'Ana', lastName: 'Pérez' },
        segments: [{ roomId: 3, startDate: '2026-12-01', endDate: '2026-12-05' }],
      },
    ])

    render(<RoomDetails />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '101' })).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Resumen general' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Calendario ocupación' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Historial reservas' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Notificaciones / observaciones' })
    ).toBeInTheDocument()
    expect(screen.queryByText(/Estado de [Ll]impieza/i)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Historial reservas' }))
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '← Volver al listado' }))
    expect(navigate).toHaveBeenCalledWith('/habitaciones')
  })
})
