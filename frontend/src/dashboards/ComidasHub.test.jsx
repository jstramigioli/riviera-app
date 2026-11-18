import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ComidasHub from './ComidasHub'

vi.mock('../utils/mediaPensionMenuStore', () => ({
  loadMediaPensionMenu: vi.fn().mockResolvedValue(''),
  saveMediaPensionMenu: vi.fn().mockResolvedValue({ ok: true, source: 'config' })
}))

import {
  loadMediaPensionMenu,
  saveMediaPensionMenu
} from '../utils/mediaPensionMenuStore'

const meals = {
  breakfastGuests: 7,
  dinnerGuests: 5,
  breakfastItems: [
    {
      reservationId: 1,
      guestName: 'Ana Pérez',
      roomLabel: '101',
      guests: 2
    },
    {
      reservationId: 2,
      guestName: 'Luis Gómez',
      roomLabel: '102',
      guests: 5
    }
  ],
  dinnerItems: [
    {
      reservationId: 3,
      guestName: 'María Soto',
      roomLabel: '201',
      guests: 5
    }
  ]
}

describe('ComidasHub', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadMediaPensionMenu.mockResolvedValue('')
    saveMediaPensionMenu.mockResolvedValue({ ok: true, source: 'config' })
  })

  it('muestra totales y abre el detalle al click', async () => {
    render(
      <ComidasHub
        mealsDateIso="2026-11-18"
        onMealsDateChange={vi.fn()}
        meals={meals}
        onOpenReservation={vi.fn()}
      />
    )

    await waitFor(() => expect(loadMediaPensionMenu).toHaveBeenCalledWith('2026-11-18'))

    expect(screen.getByTestId('comidas-hub')).toBeInTheDocument()
    expect(screen.getByTestId('comidas-total-breakfast')).toHaveTextContent('7')
    expect(screen.getByTestId('comidas-total-dinner')).toHaveTextContent('5')
    expect(screen.queryByText('Ana Pérez')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('comidas-total-breakfast'))
    expect(screen.getByTestId('comidas-detail-breakfast')).toBeInTheDocument()
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.getByText('Luis Gómez')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('comidas-detail-back'))
    expect(screen.queryByTestId('comidas-detail-breakfast')).not.toBeInTheDocument()
    expect(screen.getByTestId('comidas-menu-input')).toBeInTheDocument()
  })

  it('guarda el menú diario de media pensión', async () => {
    render(
      <ComidasHub
        mealsDateIso="2026-11-18"
        onMealsDateChange={vi.fn()}
        meals={meals}
        onOpenReservation={vi.fn()}
      />
    )
    await waitFor(() => expect(loadMediaPensionMenu).toHaveBeenCalled())

    const input = screen.getByTestId('comidas-menu-input')
    fireEvent.change(input, { target: { value: 'Guiso de lentejas' } })
    fireEvent.click(screen.getByTestId('comidas-menu-save'))

    await waitFor(() =>
      expect(saveMediaPensionMenu).toHaveBeenCalledWith(
        '2026-11-18',
        'Guiso de lentejas'
      )
    )
    expect(await screen.findByTestId('comidas-menu-status')).toHaveTextContent(
      /Menú guardado/
    )
  })
})
