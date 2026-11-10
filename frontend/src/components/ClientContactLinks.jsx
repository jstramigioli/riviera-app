import React, { useState } from 'react';
import { FiCopy, FiCheck } from 'react-icons/fi';
import styles from './ClientContactLinks.module.css';

export function digitsForWhatsApp(phone) {
  return String(phone || '').replace(/\D/g, '');
}

export function whatsAppHref(phone) {
  const digits = digitsForWhatsApp(phone);
  return digits ? `https://wa.me/${digits}` : null;
}

async function copyValue(value) {
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function ContactLine({ value, href, ariaLabel, copyLabel, external }) {
  const [copied, setCopied] = useState(false);

  if (!value) return null;

  const handleCopy = async () => {
    const ok = await copyValue(value);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className={styles.line}>
      <a
        className={styles.value}
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        {value}
      </a>
      <button
        type="button"
        className={styles.copyBtn}
        onClick={handleCopy}
        aria-label={copyLabel}
        title={copied ? 'Copiado' : copyLabel}
      >
        {copied ? <FiCheck aria-hidden="true" /> : <FiCopy aria-hidden="true" />}
      </button>
    </div>
  );
}

const ClientContactLinks = ({ phone, email }) => {
  const phoneValue = typeof phone === 'string' ? phone.trim() : '';
  const emailValue = typeof email === 'string' ? email.trim() : '';
  const wa = whatsAppHref(phoneValue);

  if (!phoneValue && !emailValue) return null;

  return (
    <div className={styles.root} data-testid="client-contact-links">
      {phoneValue && wa && (
        <ContactLine
          value={phoneValue}
          href={wa}
          ariaLabel={`Abrir WhatsApp ${phoneValue}`}
          copyLabel={`Copiar teléfono ${phoneValue}`}
          external
        />
      )}
      {emailValue && (
        <ContactLine
          value={emailValue}
          href={`mailto:${emailValue}`}
          ariaLabel={`Enviar email a ${emailValue}`}
          copyLabel={`Copiar email ${emailValue}`}
        />
      )}
    </div>
  );
};

export default ClientContactLinks;
