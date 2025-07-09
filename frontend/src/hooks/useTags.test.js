import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useTags } from './useTags'

// Mock de la API
vi.mock('../services/api', () => ({
  fetchTags: vi.fn(),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
}))

describe('useTags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with empty tags array', () => {
    const { result } = renderHook(() => useTags())
    
    expect(result.current.tags).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('loads tags successfully', async () => {
    const mockTags = [
      { id: 1, name: 'VIP', color: '#ff0000' },
      { id: 2, name: 'Regular', color: '#00ff00' }
    ]

    const { fetchTags } = await import('../services/api')
    fetchTags.mockResolvedValue(mockTags)

    const { result } = renderHook(() => useTags())

    await act(async () => {
      await result.current.loadTags()
    })

    expect(result.current.tags).toEqual(mockTags)
    expect(result.current.loading).toBe(false)
  })

  it('creates a new tag', async () => {
    const newTag = { name: 'New Tag', color: '#0000ff' }
    const createdTag = { id: 3, ...newTag }

    const { createTag } = await import('../services/api')
    createTag.mockResolvedValue(createdTag)

    const { result } = renderHook(() => useTags())

    await act(async () => {
      await result.current.createTag(newTag)
    })

    expect(createTag).toHaveBeenCalledWith(newTag)
    expect(result.current.tags).toContainEqual(createdTag)
  })

  it('updates an existing tag', async () => {
    const existingTags = [{ id: 1, name: 'Old Name', color: '#ff0000' }]
    const updatedTag = { id: 1, name: 'New Name', color: '#00ff00' }

    const { updateTag } = await import('../services/api')
    updateTag.mockResolvedValue(updatedTag)

    const { result } = renderHook(() => useTags())
    result.current.tags = existingTags

    await act(async () => {
      await result.current.updateTag(1, { name: 'New Name', color: '#00ff00' })
    })

    expect(updateTag).toHaveBeenCalledWith(1, { name: 'New Name', color: '#00ff00' })
    expect(result.current.tags[0]).toEqual(updatedTag)
  })

  it('deletes a tag', async () => {
    const existingTags = [{ id: 1, name: 'Tag to Delete', color: '#ff0000' }]

    const { deleteTag } = await import('../services/api')
    deleteTag.mockResolvedValue({ success: true })

    const { result } = renderHook(() => useTags())
    result.current.tags = existingTags

    await act(async () => {
      await result.current.deleteTag(1)
    })

    expect(deleteTag).toHaveBeenCalledWith(1)
    expect(result.current.tags).toEqual([])
  })

  it('handles errors during operations', async () => {
    const { fetchTags } = await import('../services/api')
    fetchTags.mockRejectedValue(new Error('API Error'))

    const { result } = renderHook(() => useTags())

    await act(async () => {
      await result.current.loadTags()
    })

    expect(result.current.error).toBeTruthy()
  })
}) 