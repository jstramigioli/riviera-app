import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BedPreferenceFields from './BedPreferenceFields';

describe('BedPreferenceFields', () => {
  it('muestra toggles de camas y cuna sin Mat/Ind si no hay preferencia', () => {
    const onChange = vi.fn();
    const onCuna = vi.fn();
    render(
      <BedPreferenceFields
        value={{ bedPreferenceNone: true }}
        maxDoubleBeds={2}
        maxSingleBeds={2}
        guests={4}
        onChange={onChange}
        requiereCuna={false}
        onRequiereCunaChange={onCuna}
      />
    );

    expect(screen.getByRole('button', { name: 'Preferencia de camas' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByRole('button', { name: 'Cuna' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByLabelText('Camas matrimoniales')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Camas individuales')).not.toBeInTheDocument();
  });

  it('al activar preferencia de camas muestra Mat/Ind y emite bedPreferenceNone false', () => {
    const onChange = vi.fn();
    render(
      <BedPreferenceFields
        value={{ bedPreferenceNone: true }}
        maxDoubleBeds={2}
        maxSingleBeds={2}
        guests={4}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Preferencia de camas' }));

    expect(onChange).toHaveBeenCalledWith({
      bedPreferenceNone: false,
      preferredDoubleBeds: 0,
      preferredSingleBeds: 0
    });
  });

  it('toggle cuna emite onRequiereCunaChange', () => {
    const onCuna = vi.fn();
    render(
      <BedPreferenceFields
        value={{ bedPreferenceNone: true }}
        maxDoubleBeds={1}
        maxSingleBeds={1}
        guests={2}
        onChange={vi.fn()}
        requiereCuna={false}
        onRequiereCunaChange={onCuna}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cuna' }));
    expect(onCuna).toHaveBeenCalledWith(true);
  });

  it('opciones Mat/Ind limitadas por maxDoubleBeds y maxSingleBeds', () => {
    render(
      <BedPreferenceFields
        value={{
          bedPreferenceNone: false,
          preferredDoubleBeds: 0,
          preferredSingleBeds: 0
        }}
        maxDoubleBeds={1}
        maxSingleBeds={3}
        guests={4}
        onChange={vi.fn()}
      />
    );

    const matOptions = screen.getByLabelText('Camas matrimoniales').querySelectorAll('option');
    const indOptions = screen.getByLabelText('Camas individuales').querySelectorAll('option');
    expect(matOptions).toHaveLength(2); // 0..1
    expect(indOptions).toHaveLength(4); // 0..3
  });

  it('con preferencia activa muestra selects y permite cambiar cantidades', () => {
    const onChange = vi.fn();
    render(
      <BedPreferenceFields
        value={{
          bedPreferenceNone: false,
          preferredDoubleBeds: 1,
          preferredSingleBeds: 0
        }}
        maxDoubleBeds={2}
        maxSingleBeds={2}
        guests={4}
        onChange={onChange}
      />
    );

    expect(screen.getByRole('button', { name: 'Preferencia de camas' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    const mat = screen.getByLabelText('Camas matrimoniales');
    expect(mat).toHaveValue('1');
    fireEvent.change(mat, { target: { value: '2' } });
    expect(onChange).toHaveBeenCalledWith({
      bedPreferenceNone: false,
      preferredDoubleBeds: 2,
      preferredSingleBeds: 0
    });
  });

  it('al desactivar preferencia limpia cantidades', () => {
    const onChange = vi.fn();
    render(
      <BedPreferenceFields
        value={{
          bedPreferenceNone: false,
          preferredDoubleBeds: 1,
          preferredSingleBeds: 1
        }}
        maxDoubleBeds={2}
        maxSingleBeds={2}
        guests={4}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Preferencia de camas' }));
    expect(onChange).toHaveBeenCalledWith({
      bedPreferenceNone: true,
      preferredDoubleBeds: 0,
      preferredSingleBeds: 0
    });
  });

  it('con 2 individuales, matrimonial ≥1 queda disabled (grisado)', () => {
    render(
      <BedPreferenceFields
        value={{
          bedPreferenceNone: false,
          preferredDoubleBeds: 0,
          preferredSingleBeds: 2
        }}
        maxDoubleBeds={1}
        maxSingleBeds={2}
        guests={2}
        onChange={vi.fn()}
      />
    );

    const mat = screen.getByLabelText('Camas matrimoniales');
    const matOptions = [...mat.querySelectorAll('option')];
    expect(matOptions.find((o) => o.value === '0')).not.toBeDisabled();
    expect(matOptions.find((o) => o.value === '1')).toBeDisabled();
  });

  it('emit con mat=1 e ind=1 se clampea a plazas ≤ huéspedes', () => {
    const onChange = vi.fn();
    render(
      <BedPreferenceFields
        value={{
          bedPreferenceNone: false,
          preferredDoubleBeds: 1,
          preferredSingleBeds: 0
        }}
        maxDoubleBeds={1}
        maxSingleBeds={2}
        guests={2}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText('Camas individuales'), {
      target: { value: '1' }
    });
    expect(onChange).toHaveBeenCalledWith({
      bedPreferenceNone: false,
      preferredDoubleBeds: 1,
      preferredSingleBeds: 0
    });
  });
});
