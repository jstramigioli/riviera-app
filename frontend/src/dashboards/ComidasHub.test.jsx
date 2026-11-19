import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ComidasHub from './ComidasHub'

vi.mock('../services/gastronomiaApi', () => ({
  getDailyMenuByDate: vi.fn()
}))

import { getDailyMenuByDate } from '../services/gastronomiaApi'

const meals = {
  breakfastGuests: 7,
  dinnerGuests: 5,
  breakfastItems: [
    { reservationId: 1, guestName: 'Ana Pérez', roomLabel: '101', guests: 2 },
    { reservationId: 2, guestName: 'Luis Gómez', roomLabel: '102', guests: 5 }
  ],
  dinnerItems: [
    { reservationId: 3, guestName: 'María Soto', roomLabel: '201', guests: 5 }
  ]
}

describe('ComidasHub', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDailyMenuByDate.mockRejectedValue(
      Object.assign(new Error('No hay menú'), { status: 404 })
    )
  })

  it('muestra totales y abre el detalle al click', async () => {
    render(
      <MemoryRouter>
        <ComidasHub
          mealsDateIso="2026-11-18"
          onMealsDateChange={vi.fn()}
          meals={meals}
          onOpenReservation={vi.fn()}
        />
      </MemoryRouter>
    )

    await waitFor(() =>
      expect(getDailyMenuByDate).toHaveBeenCalledWith('2026-11-18')
    )

    expect(screen.getByTestId('comidas-total-breakfast')).toHaveTextContent('7')
    fireEvent.click(screen.getByTestId('comidas-total-breakfast'))
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
  })

  it('enlaza a Gastronomía y muestra preview si hay menú', async () => {
    getDailyMenuByDate.mockResolvedValue({
      id: 9,
      kind: 'CONVENTIONAL',
      status: 'PUBLISHED',
      items: [
        { nameSnapshot: 'Sopa', sortOrder: 0 },
        { nameSnapshot: 'Milanesa', sortOrder: 1 }
      ]
    })

    render(
      <MemoryRouter>
        <ComidasHub
          mealsDateIso="2026-11-18"
          onMealsDateChange={vi.fn()}
          meals={meals}
          onOpenReservation={vi.fn()}
        />
      </MemoryRouter>
    )

    expect(await screen.findByTestId('comidas-menu-preview')).toHaveTextContent(
      /Sopa/
    )
    const link = screen.getByTestId('comidas-menu-edit-link')
    expect(link).toHaveAttribute('href', '/gastronomia?tab=week&id=9')
  })
})
