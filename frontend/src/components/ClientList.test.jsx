/* eslint-env jest */
import { render, screen } from '@testing-library/react';
import ClientList from './ClientList';

const mockClients = [
  { id: 1, firstName: 'Juan', lastName: 'Pérez', email: 'juan@example.com' },
  { id: 2, firstName: 'María', lastName: 'García', email: 'maria@example.com' }
];

describe('ClientList', () => {
  it('renders a list of clients', () => {
    render(<ClientList clients={mockClients} />);
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByText('María García')).toBeInTheDocument();
  });

  it('shows empty state if no clients', () => {
    render(<ClientList clients={[]} />);
    expect(screen.getByText(/no clients/i)).toBeInTheDocument();
  });
}); 