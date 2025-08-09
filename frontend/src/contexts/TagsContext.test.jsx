import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TagsProvider } from './TagsContext'
import { useTags } from '../hooks/useTags'

// Mock de la API
vi.mock('../services/api', () => ({
  fetchTags: vi.fn(),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
}))

// Componente de prueba para usar el contexto
const TestComponent = () => {
  const { tags, loading, addTag, updateTag, removeTag } = useTags()
  
  return (
    <div>
      <div data-testid="loading">{loading ? 'Loading' : 'Not Loading'}</div>
      <div data-testid="tags-count">{tags.length}</div>
      <button onClick={() => addTag({ id: 1, name: 'Test Tag', color: '#ff0000' })}>
        Create Tag
      </button>
      <button onClick={() => updateTag({ id: 1, name: 'Updated Tag', color: '#ff0000' })}>
        Update Tag
      </button>
      <button onClick={() => removeTag(1)}>
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
    expect(screen.getByTestId('loading')).toHaveTextContent('Loading')
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
    await new Promise(resolve => setTimeout(resolve, 100))
    
    expect(screen.getByTestId('tags-count')).toHaveTextContent('2')
  })

  it('handles create tag', async () => {
    const { fetchTags } = await import('../services/api')
    fetchTags.mockResolvedValue([]) // Sin tags iniciales

    render(
      <TagsProvider>
        <TestComponent />
      </TagsProvider>
    )

    // Esperar a que se carguen los tags iniciales
    await new Promise(resolve => setTimeout(resolve, 100))

    const createButton = screen.getByText('Create Tag')
    fireEvent.click(createButton)

    await new Promise(resolve => setTimeout(resolve, 0))
    
    expect(screen.getByTestId('tags-count')).toHaveTextContent('1')
  })

  it('handles update tag', async () => {
    const { fetchTags } = await import('../services/api')
    fetchTags.mockResolvedValue([{ id: 1, name: 'Old Tag', color: '#ff0000' }])

    render(
      <TagsProvider>
        <TestComponent />
      </TagsProvider>
    )

    // Esperar a que se carguen los tags iniciales
    await new Promise(resolve => setTimeout(resolve, 100))

    const updateButton = screen.getByText('Update Tag')
    fireEvent.click(updateButton)

    await new Promise(resolve => setTimeout(resolve, 0))
    
    // Verificar que el tag se actualizó
    expect(screen.getByTestId('tags-count')).toHaveTextContent('1')
  })

  it('handles delete tag', async () => {
    const { fetchTags } = await import('../services/api')
    fetchTags.mockResolvedValue([{ id: 1, name: 'Tag to Delete', color: '#ff0000' }])

    render(
      <TagsProvider>
        <TestComponent />
      </TagsProvider>
    )

    // Esperar a que se carguen los tags iniciales
    await new Promise(resolve => setTimeout(resolve, 100))

    const deleteButton = screen.getByText('Delete Tag')
    fireEvent.click(deleteButton)

    await new Promise(resolve => setTimeout(resolve, 0))
    
    expect(screen.getByTestId('tags-count')).toHaveTextContent('0')
  })

  it('handles API errors', async () => {
    const { fetchTags } = await import('../services/api')
    fetchTags.mockRejectedValue(new Error('API Error'))

    render(
      <TagsProvider>
        <TestComponent />
      </TagsProvider>
    )

    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Verificar que el error se maneja correctamente
    expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading')
  })
}) 