import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ComidasHub from './ComidasHub'

vi.mock('../services/gastronomiaApi', () => ({
  getDailyMenuByDate: vi.fn(),
  fetchDailyMenuPdfBlob: vi.fn()
}))

import {
  fetchDailyMenuPdfBlob,
  getDailyMenuByDate
} from '../services/gastronomiaApi'

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

  it('muestra mini menú con iconos editar / PDF / imprimir', async () => {
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
    fetchDailyMenuPdfBlob.mockResolvedValue(new Blob(['%PDF'], { type: 'application/pdf' }))

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
    expect(preview).toHaveTextContent(/mesa de ensaladas/)
    expect(preview).not.toHaveTextContent(/Convencional/i)
    const ensalada = screen.getByTestId('comidas-menu-section-ENSALADA')
    expect(ensalada).toHaveTextContent(/^mesa de ensaladas$/)
    expect(ensalada.querySelector('ul')).toBeNull()
    expect(ensalada.querySelector('h4')).toBeNull()

    const edit = screen.getByTestId('comidas-menu-edit-link')
    expect(edit).toHaveAttribute('href', '/comedor?tab=week&id=9')
    expect(edit).toHaveAttribute('aria-label', 'Editar menú')
    expect(edit).not.toHaveTextContent(/Editar|Crear/)

    expect(screen.getByTestId('comidas-menu-download-pdf')).toHaveAttribute(
      'aria-label',
      'Descargar PDF'
    )
    expect(screen.getByTestId('comidas-menu-print-pdf')).toHaveAttribute(
      'aria-label',
      'Imprimir menú'
    )

    fireEvent.click(screen.getByTestId('comidas-menu-download-pdf'))
    await waitFor(() =>
      expect(fetchDailyMenuPdfBlob).toHaveBeenCalledWith(9)
    )
  })

  it('sin menú muestra crear (plus) y no PDF', async () => {
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
    const edit = screen.getByTestId('comidas-menu-edit-link')
    expect(edit).toHaveAttribute('aria-label', 'Crear menú')
    expect(screen.queryByTestId('comidas-menu-download-pdf')).not.toBeInTheDocument()
    expect(screen.queryByTestId('comidas-menu-print-pdf')).not.toBeInTheDocument()
  })
})
