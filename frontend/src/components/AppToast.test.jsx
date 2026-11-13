import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AppToast from './AppToast';

describe('AppToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('muestra el mensaje abajo sin botón de cierre', () => {
    render(
      <AppToast
        isOpen
        message="Resumen de la reserva copiado al portapapeles."
        type="success"
        onClose={vi.fn()}
      />
    );

    expect(
      screen.getByText('Resumen de la reserva copiado al portapapeles.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('se cierra solo después del duration', () => {
    const onClose = vi.fn();
    render(
      <AppToast
        isOpen
        message="Copiado"
        type="success"
        duration={1000}
        onClose={onClose}
      />
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(220);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
