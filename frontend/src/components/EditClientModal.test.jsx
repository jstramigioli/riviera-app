/* eslint-env jest */
import { render, screen, fireEvent } from '@testing-library/react';
import EditClientModal from './EditClientModal';
import '@testing-library/jest-dom';

const mockClient = {
  id: 1,
  firstName: 'Juan',
  lastName: 'Pérez',
  email: 'juan@example.com',
  phone: '123456789',
  documentType: 'DNI',
  documentNumber: '12345678'
};

describe('EditClientModal', () => {
  it('renders the modal with client data', () => {
    render(<EditClientModal isOpen={true} client={mockClient} onClose={() => {}} onClientUpdated={() => {}} />);
    expect(screen.getByDisplayValue('Juan')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Pérez')).toBeInTheDocument();
  });

  it('allows editing the first name', () => {
    render(<EditClientModal isOpen={true} client={mockClient} onClose={() => {}} onClientUpdated={() => {}} />);
    const input = screen.getByLabelText('Nombre *');
    fireEvent.change(input, { target: { value: 'Carlos' } });
    expect(input.value).toBe('Carlos');
  });

  it('muestra y edita la patente igual que el check-in', () => {
    render(
      <EditClientModal
        isOpen={true}
        client={{ ...mockClient, vehiclePlate: 'AB123CD' }}
        onClose={() => {}}
        onClientUpdated={() => {}}
      />
    );
    const input = screen.getByLabelText('Patente (opcional)');
    expect(input.value).toBe('AB123CD');
    fireEvent.change(input, { target: { value: 'XY987ZW' } });
    expect(input.value).toBe('XY987ZW');
  });
}); 