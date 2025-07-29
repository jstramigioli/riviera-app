import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TagsProvider } from '../contexts/TagsContext'
import { useTags } from './useTags'

// Mock de la API
vi.mock('../services/api', () => ({
  fetchTags: vi.fn(),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
}))

// Wrapper para renderHook con TagsProvider
const wrapper = ({ children }) => <TagsProvider>{children}</TagsProvider>

describe('useTags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with empty tags array', () => {
    const { result } = renderHook(() => useTags(), { wrapper })
    
    expect(result.current.tags).toEqual([])
    expect(result.current.loading).toBe(true) // El contexto inicia en loading
  })

  it('loads tags successfully', async () => {
    const mockTags = [
      { id: 1, name: 'VIP', color: '#ff0000' },
      { id: 2, name: 'Regular', color: '#00ff00' }
    ]

    const { fetchTags } = await import('../services/api')
    fetchTags.mockResolvedValue(mockTags)

    const { result } = renderHook(() => useTags(), { wrapper })

    await act(async () => {
      await result.current.loadTags()
    })

    expect(result.current.tags).toEqual(mockTags)
    expect(result.current.loading).toBe(false)
  })

  it('creates a new tag', async () => {
    const { fetchTags } = await import('../services/api')
    fetchTags.mockResolvedValue([]) // Sin tags iniciales

    const { result } = renderHook(() => useTags(), { wrapper })

    // Esperar a que se carguen los tags iniciales
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    const newTag = { id: 3, name: 'New Tag', color: '#0000ff' }

    await act(async () => {
      result.current.addTag(newTag)
    })

    expect(result.current.tags).toContainEqual(newTag)
  })

  it('updates an existing tag', async () => {
    const { fetchTags } = await import('../services/api')
    fetchTags.mockResolvedValue([{ id: 1, name: 'Old Name', color: '#ff0000' }])

    const { result } = renderHook(() => useTags(), { wrapper })

    // Esperar a que se carguen los tags iniciales
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    const updatedTag = { id: 1, name: 'New Name', color: '#00ff00' }

    await act(async () => {
      result.current.updateTag(updatedTag)
    })

    expect(result.current.tags[0]).toEqual(updatedTag)
  })

  it('deletes a tag', async () => {
    const { fetchTags } = await import('../services/api')
    fetchTags.mockResolvedValue([{ id: 1, name: 'Tag to Delete', color: '#ff0000' }])

    const { result } = renderHook(() => useTags(), { wrapper })

    // Esperar a que se carguen los tags iniciales
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
    })

    await act(async () => {
      result.current.removeTag(1)
    })

    expect(result.current.tags).toEqual([])
  })

  it('handles errors during operations', async () => {
    const { fetchTags } = await import('../services/api')
    fetchTags.mockRejectedValue(new Error('API Error'))

    const { result } = renderHook(() => useTags(), { wrapper })

    await act(async () => {
      await result.current.loadTags()
    })

    // El contexto no maneja errores explícitamente, solo los registra en consola
    expect(result.current.loading).toBe(false)
  })
}) 