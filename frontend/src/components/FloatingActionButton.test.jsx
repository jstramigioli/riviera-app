import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import FloatingActionButton from './FloatingActionButton'

describe('FloatingActionButton hub', () => {
  it('muestra Hoy arriba y abre el menú del +', () => {
    const onToday = vi.fn()
    const onCreateQuery = vi.fn()
    const onCreateReservation = vi.fn()
    const onCreateConsumption = vi.fn()
    const onCreatePayment = vi.fn()

    render(
      <FloatingActionButton
        onToday={onToday}
        onCreateQuery={onCreateQuery}
        onCreateReservation={onCreateReservation}
        onCreateConsumption={onCreateConsumption}
        onCreatePayment={onCreatePayment}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ir a hoy' }))
    expect(onToday).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú de altas' }))

    const consulta = screen.getByRole('menuitem', { name: '+ Consulta' })
    const reserva = screen.getByRole('menuitem', { name: '+ Reserva' })
    const consumo = screen.getByRole('menuitem', { name: '+ Consumo' })
    const pago = screen.getByRole('menuitem', { name: '+ Pago' })

    expect(consulta).toHaveTextContent('+ Consulta')
    expect(reserva).toHaveTextContent('+ Reserva')
    expect(consumo).toHaveTextContent('+ Consumo')
    expect(pago).toHaveTextContent('+ Pago')
    expect(consulta.querySelector('svg')).toBeNull()
    expect(reserva.querySelector('svg')).toBeNull()
    expect(consumo.querySelector('svg')).toBeNull()
    expect(pago.querySelector('svg')).toBeNull()

    fireEvent.click(consulta)
    expect(onCreateQuery).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú de altas' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '+ Reserva' }))
    expect(onCreateReservation).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú de altas' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '+ Consumo' }))
    expect(onCreateConsumption).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú de altas' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '+ Pago' }))
    expect(onCreatePayment).toHaveBeenCalledTimes(1)
  })
})
