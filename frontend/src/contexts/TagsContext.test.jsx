import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TagsProvider, useTags } from './TagsContext'

// Mock de la API
vi.mock('../services/api', () => ({
  fetchTags: vi.fn(),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
}))

// Componente de prueba para usar el contexto
const TestComponent = () => {
  const { tags, loading, error, createTag, updateTag, deleteTag } = useTags()
  
  return (
    <div>
      <div data-testid="loading">{loading ? 'Loading' : 'Not Loading'}</div>
      <div data-testid="error">{error || 'No Error'}</div>
      <div data-testid="tags-count">{tags.length}</div>
      <button onClick={() => createTag({ name: 'Test Tag', color: '#ff0000' })}>
        Create Tag
      </button>
      <button onClick={() => updateTag(1, { name: 'Updated Tag' })}>
        Update Tag
      </button>
      <button onClick={() => deleteTag(1)}>
        Delete Tag
      </button>
    </div>
  )
}

describe('TagsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('provides tags context', () => {
    render(
      <TagsProvider>
        <TestComponent />
      </TagsProvider>
    )
    
    expect(screen.getByTestId('tags-count')).toHaveTextContent('0')
    expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
    expect(screen.getByTestId('error')).toHaveTextContent('No Error')
  })

  it('loads tags on mount', async () => {
    const mockTags = [
      { id: 1, name: 'VIP', color: '#ff0000' },
      { id: 2, name: 'Regular', color: '#00ff00' }
    ]

    const { fetchTags } = await import('../services/api')
    fetchTags.mockResolvedValue(mockTags)

    render(
      <TagsProvider>
        <TestComponent />
      </TagsProvider>
    )

    // Wait for tags to load
    await new Promise(resolve => setTimeout(resolve, 0))
    
    expect(screen.getByTestId('tags-count')).toHaveTextContent('2')
  })

  it('handles create tag', async () => {
    const newTag = { name: 'Test Tag', color: '#ff0000' }
    const createdTag = { id: 1, ...newTag }

    const { createTag } = await import('../services/api')
    createTag.mockResolvedValue(createdTag)

    render(
      <TagsProvider>
        <TestComponent />
      </TagsProvider>
    )

    const createButton = screen.getByText('Create Tag')
    fireEvent.click(createButton)

    await new Promise(resolve => setTimeout(resolve, 0))
    
    expect(createTag).toHaveBeenCalledWith(newTag)
  })

  it('handles update tag', async () => {
    const { updateTag } = await import('../services/api')
    updateTag.mockResolvedValue({ id: 1, name: 'Updated Tag', color: '#ff0000' })

    render(
      <TagsProvider>
        <TestComponent />
      </TagsProvider>
    )

    const updateButton = screen.getByText('Update Tag')
    fireEvent.click(updateButton)

    await new Promise(resolve => setTimeout(resolve, 0))
    
    expect(updateTag).toHaveBeenCalledWith(1, { name: 'Updated Tag' })
  })

  it('handles delete tag', async () => {
    const { deleteTag } = await import('../services/api')
    deleteTag.mockResolvedValue({ success: true })

    render(
      <TagsProvider>
        <TestComponent />
      </TagsProvider>
    )

    const deleteButton = screen.getByText('Delete Tag')
    fireEvent.click(deleteButton)

    await new Promise(resolve => setTimeout(resolve, 0))
    
    expect(deleteTag).toHaveBeenCalledWith(1)
  })

  it('handles API errors', async () => {
    const { fetchTags } = await import('../services/api')
    fetchTags.mockRejectedValue(new Error('API Error'))

    render(
      <TagsProvider>
        <TestComponent />
      </TagsProvider>
    )

    await new Promise(resolve => setTimeout(resolve, 0))
    
    expect(screen.getByTestId('error')).toHaveTextContent('Error')
  })
}) 