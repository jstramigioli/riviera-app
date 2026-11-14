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

  it('lists clients with search, filters, sort and opens profile on row click', async () => {
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
    expect(screen.getByText('Mostrando 2 de 2 clientes')).toBeInTheDocument()

    await userEvent.type(screen.getByPlaceholderText(/Buscar por nombre/i), 'bruno')
    expect(screen.getByText('Álvarez')).toBeInTheDocument()
    expect(screen.queryByText('Zárate')).not.toBeInTheDocument()
    expect(screen.getByText('Mostrando 1 de 2 clientes')).toBeInTheDocument()

    await userEvent.clear(screen.getByPlaceholderText(/Buscar por nombre/i))
    await userEvent.selectOptions(screen.getByLabelText('País'), 'AR')
    expect(screen.getByText('Zárate')).toBeInTheDocument()
    expect(screen.queryByText('Álvarez')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    expect(screen.getByText('Mostrando 2 de 2 clientes')).toBeInTheDocument()

    const apellidoHeader = screen.getByRole('columnheader', { name: /Apellido/i })
    await userEvent.click(apellidoHeader)
    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('Zárate')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Zárate'))
    expect(navigate).toHaveBeenCalledWith('/clients/10')
  })
})
