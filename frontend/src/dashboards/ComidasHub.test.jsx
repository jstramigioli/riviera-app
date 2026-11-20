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

  it('muestra mini menú con títulos de sección y todos los ítems', async () => {
    getDailyMenuByDate.mockResolvedValue({
      id: 9,
      date: '2026-11-18',
      kind: 'CONVENTIONAL',
      status: 'PUBLISHED',
      items: [
        { section: 'ENTRADA', nameSnapshot: 'Empanadas', sortOrder: 0 },
        { section: 'SOPA', nameSnapshot: 'Sopa de verduras', sortOrder: 0 },
        { section: 'PRIMER_PLATO', nameSnapshot: 'Milanesa', sortOrder: 0 },
        { section: 'POSTRE', nameSnapshot: 'Flan', sortOrder: 0 },
        { section: 'POSTRE', nameSnapshot: 'Helado', sortOrder: 1 }
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

    const preview = await screen.findByTestId('comidas-menu-preview')
    expect(preview).toHaveTextContent(/^Menú/)
    expect(preview).toHaveTextContent(/Empanadas/)
    expect(preview).toHaveTextContent(/Sopa de verduras/)
    expect(preview).toHaveTextContent(/Milanesa/)
    expect(preview).toHaveTextContent(/Flan/)
    expect(preview).toHaveTextContent(/Helado/)
    expect(preview).toHaveTextContent(/mesa de ensaladas/)
    expect(screen.getByTestId('comidas-menu-section-ENTRADA')).toHaveTextContent(
      /Entrada/
    )
    expect(screen.getByTestId('comidas-menu-section-SOPA')).toHaveTextContent(
      /Sopa/
    )
    expect(preview).not.toHaveTextContent(/Convencional/i)
    expect(preview).not.toHaveTextContent(/Gestionado en Gastronomía/)
    const link = screen.getByTestId('comidas-menu-edit-link')
    expect(link).toHaveAttribute('href', '/gastronomia?tab=week&id=9')
    expect(link).toHaveTextContent('Editar menú')
  })

  it('sin menú muestra Crear menú', async () => {
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
    expect(screen.getByTestId('comidas-menu-edit-link')).toHaveTextContent(
      'Crear menú'
    )
  })
})
