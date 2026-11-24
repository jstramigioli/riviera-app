import { describe, it, expect } from 'vitest'
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  clampPage,
  normalizePageSize,
  pageRange,
  pageSlice,
  totalPagesFor,
} from './tablePagination'

describe('tablePagination', () => {
  it('default y opciones son 50 / 20-50-100', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(50)
    expect(PAGE_SIZE_OPTIONS).toEqual([20, 50, 100])
  })

  it('normalizePageSize cae al default si es inválido', () => {
    expect(normalizePageSize(20)).toBe(20)
    expect(normalizePageSize('50')).toBe(50)
    expect(normalizePageSize(33)).toBe(DEFAULT_PAGE_SIZE)
  })

  it('pageSlice pagina el dataset', () => {
    const items = Array.from({ length: 55 }, (_, i) => i + 1)
    expect(pageSlice(items, 1, 50)).toEqual(items.slice(0, 50))
    expect(pageSlice(items, 2, 50)).toEqual(items.slice(50))
    expect(pageSlice(items, 99, 50)).toEqual(items.slice(50))
  })

  it('pageRange y totalPagesFor', () => {
    expect(totalPagesFor(55, 50)).toBe(2)
    expect(pageRange(55, 1, 50)).toEqual({ from: 1, to: 50 })
    expect(pageRange(55, 2, 50)).toEqual({ from: 51, to: 55 })
    expect(pageRange(0, 1, 50)).toEqual({ from: 0, to: 0 })
    expect(clampPage(0, 3)).toBe(1)
    expect(clampPage(9, 3)).toBe(3)
  })
})
