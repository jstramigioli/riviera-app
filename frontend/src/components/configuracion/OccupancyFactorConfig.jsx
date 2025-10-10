import React from 'react';
import EditablePercentage from './EditablePercentage';

export default function OccupancyFactorConfig({ 
  percentage, 
  idealOccupancy, 
  onPercentageChange, 
  onIdealOccupancyChange 
}) {
  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ 
          marginBottom: '12px', 
          fontWeight: '500', 
          color: '#495057', 
          fontSize: 'var(--font-size-small)'
        }}>
          Ocupación ideal (%):
        </div>
        <input
          type="number"
          min="0"
          max="100"
          value={idealOccupancy || 80}
          onChange={(e) => onIdealOccupancyChange(parseFloat(e.target.value))}
          style={{
            width: 'calc(100% - 28px)',
            padding: '12px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            fontSize: 'var(--font-size-small)',
            boxSizing: 'border-box'
          }}
        />
        <div style={{ 
          fontSize: 'var(--font-size-small)', 
          color: '#666', 
          marginTop: '8px',
          fontStyle: 'italic',
          textAlign: 'center'
        }}>
          Esta es la ocupación considerada "normal" para calcular ajustes. 
          Si la ocupación real es mayor, se aplica recargo; si es menor, se aplica descuento.
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <EditablePercentage
          value={percentage}
          onValueChange={onPercentageChange}
          color="#667eea"
          min={0}
          max={50}
          step={1}
          label="Máximo ajuste por ocupación (%)"
        />
        <div style={{ 
          fontSize: 'var(--font-size-small)', 
          color: '#666', 
          marginTop: '8px',
          fontStyle: 'italic',
          textAlign: 'center'
        }}>
          Este es el porcentaje máximo que puede variar el precio debido a la ocupación.
        </div>
      </div>
    </div>
  );
} 