import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import RoomNameChip from './RoomNameChip';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderWithRouter(ui, { initialPath = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              {ui}
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe('RoomNameChip', () => {
  it('muestra — si no hay nombre', () => {
    const { container } = renderWithRouter(<RoomNameChip name={null} />);
    expect(container.textContent).toContain('—');
  });

  it('navega al perfil al hacer click', () => {
    renderWithRouter(
      <RoomNameChip name="101" roomId={42} data-testid="room-chip" />
    );
    const chip = screen.getByTestId('room-chip');
    expect(chip.tagName).toBe('BUTTON');
    fireEvent.click(chip);
    expect(screen.getByTestId('location')).toHaveTextContent('/habitaciones/42');
  });

  it('parte labels unidos por / en varios chips clickeables', () => {
    renderWithRouter(
      <RoomNameChip
        name="101/102"
        roomIds={[7, 8]}
        data-testid="room-group"
      />
    );
    const group = screen.getByTestId('room-group');
    const buttons = group.querySelectorAll('button');
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]);
    expect(screen.getByTestId('location')).toHaveTextContent('/habitaciones/8');
  });

  it('usa rooms=[{id,name}] para navegar', () => {
    renderWithRouter(
      <RoomNameChip
        rooms={[{ id: 15, name: '201' }]}
        data-testid="room-from-rooms"
      />
    );
    fireEvent.click(screen.getByTestId('room-from-rooms'));
    expect(screen.getByTestId('location')).toHaveTextContent('/habitaciones/15');
  });
});
