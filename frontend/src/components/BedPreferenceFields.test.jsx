import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BedPreferenceFields from './BedPreferenceFields';

describe('BedPreferenceFields', () => {
  it('muestra checkbox Preferencia de camas sin campos Mat/Ind si no hay preferencia', () => {
    const onChange = vi.fn();
    render(
      <BedPreferenceFields
        value={{ bedPreferenceNone: true }}
        maxDoubleBeds={2}
        maxSingleBeds={2}
        onChange={onChange}
      />
    );

    expect(screen.getByRole('checkbox', { name: 'Preferencia de camas' })).not.toBeChecked();
    expect(screen.queryByLabelText('Camas matrimoniales')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Camas individuales')).not.toBeInTheDocument();
  });

  it('al tildar muestra Mat/Ind y emite bedPreferenceNone false', () => {
    const onChange = vi.fn();
    render(
      <BedPreferenceFields
        value={{ bedPreferenceNone: true }}
        maxDoubleBeds={2}
        maxSingleBeds={2}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Preferencia de camas' }));

    expect(onChange).toHaveBeenCalledWith({
      bedPreferenceNone: false,
      preferredDoubleBeds: 0,
      preferredSingleBeds: 0
    });
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
        onChange={onChange}
      />
    );

    expect(screen.getByRole('checkbox', { name: 'Preferencia de camas' })).toBeChecked();
    const mat = screen.getByLabelText('Camas matrimoniales');
    expect(mat).toHaveValue('1');
    fireEvent.change(mat, { target: { value: '2' } });
    expect(onChange).toHaveBeenCalledWith({
      bedPreferenceNone: false,
      preferredDoubleBeds: 2,
      preferredSingleBeds: 0
    });
  });

  it('al destildar limpia cantidades', () => {
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
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Preferencia de camas' }));
    expect(onChange).toHaveBeenCalledWith({
      bedPreferenceNone: true,
      preferredDoubleBeds: 0,
      preferredSingleBeds: 0
    });
  });
});
