import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClientContactLinks, { digitsForWhatsApp, whatsAppHref } from './ClientContactLinks';

describe('ClientContactLinks helpers', () => {
  it('normaliza el teléfono a dígitos para WhatsApp', () => {
    expect(digitsForWhatsApp('+54 9 223 555-1212')).toBe('5492235551212');
    expect(whatsAppHref('+54 9 223 555-1212')).toBe('https://wa.me/5492235551212');
  });

  it('devuelve null si no hay dígitos', () => {
    expect(whatsAppHref('---')).toBeNull();
  });
});

describe('ClientContactLinks', () => {
  it('no renderiza nada sin teléfono ni email', () => {
    const { container } = render(<ClientContactLinks />);
    expect(container).toBeEmptyDOMElement();
  });

  it('muestra solo valores, sin labels mail/teléfono', () => {
    render(
      <ClientContactLinks phone="+54 223 111-2222" email="ana@hotel.test" />
    );

    expect(screen.getByText('+54 223 111-2222')).toBeInTheDocument();
    expect(screen.getByText('ana@hotel.test')).toBeInTheDocument();
    expect(screen.queryByText(/^tel[eé]fono:?$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^(e-?mail|mail):?$/i)).not.toBeInTheDocument();
  });

  it('enlaza teléfono a WhatsApp y email a mailto', () => {
    render(
      <ClientContactLinks phone="+54 223 111-2222" email="ana@hotel.test" />
    );

    expect(screen.getByRole('link', { name: /WhatsApp/i })).toHaveAttribute(
      'href',
      'https://wa.me/542231112222'
    );
    expect(screen.getByRole('link', { name: /email/i })).toHaveAttribute(
      'href',
      'mailto:ana@hotel.test'
    );
  });

  it('copia el valor y confirma en el botón', async () => {
    const user = userEvent.setup();
    render(<ClientContactLinks email="ana@hotel.test" />);

    const copyBtn = screen.getByRole('button', { name: /Copiar email/i });
    expect(copyBtn).toHaveAttribute('title', 'Copiar email ana@hotel.test');

    await user.click(copyBtn);

    await waitFor(() => {
      expect(copyBtn).toHaveAttribute('title', 'Copiado');
    });
  });

  it('no usa emojis en la UI', () => {
    render(
      <ClientContactLinks phone="+54 223 111-2222" email="ana@hotel.test" />
    );
    expect(screen.getByTestId('client-contact-links').textContent).not.toMatch(
      /\p{Extended_Pictographic}/u
    );
  });
});
