import { describe, expect, it } from 'vitest'
import {
  filterAndSortClients,
  matchesClientFilters,
  sortClients,
  uniqueCountries,
} from './clientListQuery'

const clients = [
  {
    id: 1,
    firstName: 'Ana',
    lastName: 'Zárate',
    email: 'ana@example.com',
    phone: '111',
    documentNumber: '100',
    country: 'AR',
    province: 'Buenos Aires',
    city: 'La Plata',
    notes: 'Domicilio: Calle 1',
    wantsPromotions: true,
  },
  {
    id: 2,
    firstName: 'Bruno',
    lastName: 'Álvarez',
    email: null,
    phone: '222',
    documentNumber: '200',
    country: 'UY',
    province: 'Montevideo',
    city: 'Montevideo',
    notes: null,
    wantsPromotions: false,
  },
  {
    id: 3,
    firstName: 'Carla',
    lastName: 'Méndez',
    email: 'carla@example.com',
    phone: '333',
    documentNumber: '300',
    country: 'AR',
    province: 'Córdoba',
    city: 'Córdoba',
    notes: 'Domicilio: Av. Siempre Viva',
    wantsPromotions: true,
  },
]

describe('clientListQuery', () => {
  it('filters by search across name, document and address', () => {
    expect(matchesClientFilters(clients[0], { search: 'zárate' })).toBe(true)
    expect(matchesClientFilters(clients[1], { search: 'calle' })).toBe(false)
    expect(matchesClientFilters(clients[0], { search: 'calle 1' })).toBe(true)
    expect(matchesClientFilters(clients[2], { search: '300' })).toBe(true)
  })

  it('applies country, promotions and email filters', () => {
    const result = filterAndSortClients(clients, {
      country: 'AR',
      promotions: 'yes',
      hasEmail: 'yes',
      sortField: 'lastName',
      sortDirection: 'asc',
    })
    expect(result.map((client) => client.id)).toEqual([3, 1])
  })

  it('sorts by column and direction', () => {
    const asc = sortClients(clients, 'lastName', 'asc')
    expect(asc.map((client) => client.lastName)).toEqual(['Álvarez', 'Méndez', 'Zárate'])

    const desc = sortClients(clients, 'lastName', 'desc')
    expect(desc.map((client) => client.lastName)).toEqual(['Zárate', 'Méndez', 'Álvarez'])
  })

  it('lists unique countries sorted', () => {
    expect(uniqueCountries(clients)).toEqual(['AR', 'UY'])
  })
})
