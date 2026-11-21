import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react'
import { useOverlayDismiss } from './useOverlayDismiss'

function fakeEvent({ targetIsCurrent = true } = {}) {
  const el = {}
  return {
    target: targetIsCurrent ? el : {},
    currentTarget: el
  }
}

describe('useOverlayDismiss', () => {
  it('cierra solo si mousedown y mouseup fueron en el overlay', () => {
    const onDismiss = vi.fn()
    const { result } = renderHook(() => useOverlayDismiss(onDismiss))

    act(() => {
      result.current.onMouseDown(fakeEvent({ targetIsCurrent: true }))
      result.current.onMouseUp(fakeEvent({ targetIsCurrent: true }))
    })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('no cierra si el mousedown empezó dentro del diálogo', () => {
    const onDismiss = vi.fn()
    const { result } = renderHook(() => useOverlayDismiss(onDismiss))

    act(() => {
      result.current.onMouseDown(fakeEvent({ targetIsCurrent: false }))
      result.current.onMouseUp(fakeEvent({ targetIsCurrent: true }))
    })
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('no cierra si enabled=false', () => {
    const onDismiss = vi.fn()
    const { result } = renderHook(() =>
      useOverlayDismiss(onDismiss, { enabled: false })
    )

    act(() => {
      result.current.onMouseDown(fakeEvent({ targetIsCurrent: true }))
      result.current.onMouseUp(fakeEvent({ targetIsCurrent: true }))
    })
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
