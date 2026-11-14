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

  it('coloca la lupa entre Hoy y + y abre la barra opaca al click', () => {
    const reservations = [
      {
        id: 12,
        status: 'CONFIRMADA',
        checkIn: '2026-03-10',
        checkOut: '2026-03-12',
        mainClient: { firstName: 'Ana', lastName: 'Pérez' }
      }
    ]

    const { container } = render(
      <FloatingActionButton
        onToday={vi.fn()}
        onCreateQuery={vi.fn()}
        onCreateReservation={vi.fn()}
        onCreateConsumption={vi.fn()}
        onCreatePayment={vi.fn()}
        showSearch
        searchReservations={reservations}
        searchClients={[]}
        searchQueries={[]}
        onSearchSelectReservation={vi.fn()}
      />
    )

    const today = screen.getByRole('button', { name: 'Ir a hoy' })
    const search = screen.getByRole('button', { name: 'Buscar en el Libro' })
    const plus = screen.getByRole('button', { name: 'Abrir menú de altas' })
    const buttons = Array.from(container.querySelectorAll('button'))
    expect(buttons.indexOf(today)).toBeLessThan(buttons.indexOf(search))
    expect(buttons.indexOf(search)).toBeLessThan(buttons.indexOf(plus))

    fireEvent.click(search)
    expect(
      screen.getByRole('dialog', { name: 'Buscar en el Libro' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('searchbox', {
        name: 'Buscar reservas, clientes o consultas'
      })
    ).toBeInTheDocument()
  })
})

