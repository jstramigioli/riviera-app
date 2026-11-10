import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import FloatingActionButton from './FloatingActionButton'

describe('FloatingActionButton hub', () => {
  it('muestra Hoy arriba y abre el menú del +', () => {
    const onToday = vi.fn()
    const onCreateQuery = vi.fn()
    const onCreateReservation = vi.fn()
    const onCreateConsumption = vi.fn()

    render(
      <FloatingActionButton
        onToday={onToday}
        onCreateQuery={onCreateQuery}
        onCreateReservation={onCreateReservation}
        onCreateConsumption={onCreateConsumption}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ir a hoy' }))
    expect(onToday).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú de altas' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Nueva consulta' }))
    expect(onCreateQuery).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú de altas' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Nueva reserva' }))
    expect(onCreateReservation).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú de altas' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Nuevo consumo' }))
    expect(onCreateConsumption).toHaveBeenCalledTimes(1)
  })
})
