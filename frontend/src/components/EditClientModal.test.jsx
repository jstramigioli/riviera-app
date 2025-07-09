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
    render(<EditClientModal open={true} client={mockClient} onClose={() => {}} onSave={() => {}} />);
    expect(screen.getByDisplayValue('Juan')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Pérez')).toBeInTheDocument();
  });

  it('allows editing the first name', () => {
    render(<EditClientModal open={true} client={mockClient} onClose={() => {}} onSave={() => {}} />);
    const input = screen.getByLabelText(/first name/i);
    fireEvent.change(input, { target: { value: 'Carlos' } });
    expect(input.value).toBe('Carlos');
  });
}); 