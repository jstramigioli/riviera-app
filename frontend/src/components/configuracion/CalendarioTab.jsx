import React from 'react';
import HolidaysPanel from './HolidaysPanel';
import OperationalPeriodsPanel from './OperationalPeriodsPanel';

export default function CalendarioTab() {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      gap: '24px',
      padding: '24px',
      paddingBottom: '50px'
    }}>
      {/* Panel de feriados */}
      <HolidaysPanel />

      {/* Panel de períodos operacionales */}
      <OperationalPeriodsPanel />
    </div>
  );
} 