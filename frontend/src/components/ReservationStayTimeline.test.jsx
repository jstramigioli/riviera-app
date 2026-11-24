import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ReservationStayTimeline from './ReservationStayTimeline';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderTimeline(reservation, props = {}) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <ReservationStayTimeline
                reservation={reservation}
                orientation="horizontal"
                {...props}
              />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

const baseReservation = {
  id: 1,
  clientId: 9,
  client: { id: 9, firstName: 'Ana', lastName: 'Pérez' },
  checkIn: '2026-11-20',
  checkOut: '2026-11-22',
  totalAmount: 10000,
  segments: [
    {
      id: 1,
      isActive: true,
      startDate: '2026-11-20',
      endDate: '2026-11-22',
      guestCount: 2,
      serviceType: 'con_desayuno',
      roomId: 18,
      room: {
        id: 18,
        name: '18',
        roomType: { name: 'Cuádruple' }
      }
    }
  ]
};

describe('ReservationStayTimeline · chip habitación', () => {
  it('muestra el texto completo en el chip (Habitación: N - Tipo)', () => {
    renderTimeline(baseReservation);
    const chip = screen.getByTestId('timeline-room-link');
    expect(chip).toHaveTextContent('Habitación: 18 - Cuádruple');
    expect(chip.tagName).toBe('BUTTON');
  });

  it('navega al perfil de habitación al hacer click en el chip', () => {
    renderTimeline(baseReservation);
    fireEvent.click(screen.getByTestId('timeline-room-link'));
    expect(screen.getByTestId('location')).toHaveTextContent('/habitaciones/18');
  });

  it('con hideRoomNumber solo muestra el tipo, sin chip de nº', () => {
    renderTimeline(baseReservation, { hideRoomNumber: true });
    expect(screen.queryByTestId('timeline-room-link')).toBeNull();
    expect(screen.queryByTestId('timeline-room-chip')).toBeNull();
    expect(screen.getByTestId('timeline-segment-card')).toHaveTextContent(
      'Cuádruple'
    );
  });
});
