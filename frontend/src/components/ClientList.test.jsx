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
    expect(screen.getByText('Juan')).toBeInTheDocument();
    expect(screen.getByText('Pérez')).toBeInTheDocument();
    expect(screen.getByText('María')).toBeInTheDocument();
    expect(screen.getByText('García')).toBeInTheDocument();
  });

  it('shows empty state if no clients', () => {
    render(<ClientList clients={[]} />);
    expect(screen.getByText('No se encontraron clientes que coincidan con la búsqueda.')).toBeInTheDocument();
  });
}); 