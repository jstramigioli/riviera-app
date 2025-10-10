import React, { useCallback, useEffect, useState } from 'react';

export default function WeekendFactorConfig({ config, onConfigChange }) {
  const [weekendDays, setWeekendDays] = useState(config?.weekendDays || [0, 6]);

  useEffect(() => {
    // Sync local state with prop changes
    if (config?.weekendDays) {
      setWeekendDays(config.weekendDays);
    }
  }, [config?.weekendDays]);

  const handleDayToggle = useCallback((day) => {
    let newWeekendDays;
    
    if (weekendDays.includes(day)) {
      // Remover el día si ya está seleccionado
      newWeekendDays = weekendDays.filter(d => d !== day);
    } else {
      // Agregar el día si no está seleccionado
      newWeekendDays = [...weekendDays, day].sort();
    }

    setWeekendDays(newWeekendDays);

    // Llamar inmediatamente al callback para persistir el cambio
    if (onConfigChange) {
      const newConfig = {
        ...config,
        weekendDays: newWeekendDays
      };
      onConfigChange(newConfig);
    }
  }, [config, onConfigChange, weekendDays]);

  const dayNames = {
    5: 'Viernes',
    6: 'Sábado', 
    0: 'Domingo'
  };

  const dayColors = {
    5: '#e74c3c', // Viernes - rojo
    6: '#e74c3c', // Sábado - rojo
    0: '#e74c3c'  // Domingo - rojo
  };

  // Ordenar los días en el orden correcto: Viernes, Sábado, Domingo
  const orderedDays = [5, 6, 0];

  return (
    <div>
      <div style={{ 
        marginBottom: '12px', 
        fontWeight: '500', 
        color: '#495057', 
        fontSize: 'var(--font-size-small)'
      }}>
        Días de fin de semana:
      </div>
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        {orderedDays.map((dayNum) => {
          const dayName = dayNames[dayNum];
          const isSelected = weekendDays.includes(dayNum);
          
          return (
            <button
              key={dayNum}
              onClick={() => handleDayToggle(dayNum)}
              style={{
                padding: '12px 20px',
                border: `2px solid ${dayColors[dayNum]}`,
                borderRadius: '8px',
                backgroundColor: isSelected ? dayColors[dayNum] : '#fdf2f2',
                color: isSelected ? 'white' : '#e74c3c',
                cursor: 'pointer',
                fontSize: 'var(--font-size-small)',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                minWidth: '90px'
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.target.style.backgroundColor = '#fce4e4';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.target.style.backgroundColor = '#fdf2f2';
                }
              }}
            >
              {dayName}
            </button>
          );
        })}
      </div>
      <div style={{ 
        fontSize: 'var(--font-size-small)', 
        color: '#666', 
        marginTop: '12px',
        fontStyle: 'italic',
        textAlign: 'center'
      }}>
        Selecciona los días que se considerarán como fin de semana para aplicar el recargo adicional.
      </div>
    </div>
  );
} 