import React from 'react';
import HolidaysPanel from './HolidaysPanel';
import OpenDaysPanel from './OpenDaysPanel';

export default function CalendarioTab() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      padding: '24px',
      paddingBottom: '50px'
    }}>
      <HolidaysPanel />
      <OpenDaysPanel />
      <div style={{
        padding: '16px 20px',
        background: '#f8f9fa',
        border: '1px solid #e9ecef',
        borderRadius: '8px',
        color: '#6c757d'
      }}>
        <strong style={{ color: '#495057' }}>Períodos operacionales</strong>
        <p style={{ margin: '8px 0 0' }}>
          Esta función legacy depende de un modelo eliminado del esquema.
          Usá feriados y días cerrados (arriba) para controlar la disponibilidad del hotel.
        </p>
      </div>
    </div>
  );
}
