import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Clientes from './Clientes'

const navigate = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}))

vi.mock('../services/api', () => ({
  fetchClients: vi.fn(),
}))

describe('Clientes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps the sidebar shell while loading', async () => {
    const { fetchClients } = await import('../services/api')
    let resolveClients
    fetchClients.mockReturnValue(
      new Promise((resolve) => {
        resolveClients = resolve
      })
    )

    render(<Clientes />)

    expect(screen.getByRole('button', { name: 'Listado' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/Cargando clientes/i)

    resolveClients([])
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Listado de clientes' })).toBeInTheDocument()
    })
  })

  it('lists clients with search, wantsPromotions column, sort and opens profile on row click', async () => {
    const { fetchClients } = await import('../services/api')
    fetchClients.mockResolvedValue([
      {
        id: 10,
        firstName: 'Ana',
        lastName: 'Zárate',
        email: 'ana@example.com',
        phone: '111',
        documentType: 'DNI',
        documentNumber: '100',
        country: 'AR',
        province: 'Buenos Aires',
        city: 'La Plata',
        notes: 'Domicilio: Calle 1',
        wantsPromotions: true,
      },
      {
        id: 11,
        firstName: 'Bruno',
        lastName: 'Álvarez',
        email: null,
        phone: '222',
        documentType: 'DNI',
        documentNumber: '200',
        country: 'UY',
        province: 'Montevideo',
        city: 'Montevideo',
        notes: null,
        wantsPromotions: false,
      },
    ])

    render(<Clientes />)

    await waitFor(() => {
      expect(screen.getByText('Zárate')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Listado' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Listado de clientes' })).toBeInTheDocument()
    expect(screen.queryByText(/Buscá y filtrá la agenda/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('País')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Promociones')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Promociones/i })).toBeInTheDocument()
    expect(screen.getByText('Mostrando 2 de 2 clientes')).toBeInTheDocument()

    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('Álvarez')).toBeInTheDocument()
    expect(within(rows[0]).getByText('No')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Zárate')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Sí')).toBeInTheDocument()

    await userEvent.type(screen.getByPlaceholderText(/Buscar por nombre/i), 'bruno')
    expect(screen.getByText('Álvarez')).toBeInTheDocument()
    expect(screen.queryByText('Zárate')).not.toBeInTheDocument()
    expect(screen.getByText('Mostrando 1 de 2 clientes')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }))
    expect(screen.getByText('Mostrando 2 de 2 clientes')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Apellido/i }))
    const sortedRows = screen.getAllByRole('row').slice(1)
    expect(within(sortedRows[0]).getByText('Zárate')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Zárate'))
    expect(navigate).toHaveBeenCalledWith('/clients/10')
  })
})
