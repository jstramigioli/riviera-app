import React, { useCallback, useEffect } from 'react';

export default function WeekendFactorConfig({ config, onConfigChange }) {
  const weekendDays = config?.weekendDays || [0, 6];

  useEffect(() => {
    // Sync local state with prop changes
  }, [config]);

  const handlePresetChange = useCallback((preset) => {
    let newWeekendDays;
    
    if (preset === 'saturday-sunday') {
      newWeekendDays = [0, 6]; // Domingo y Sábado
    } else if (preset === 'friday-saturday-sunday') {
      newWeekendDays = [0, 5, 6]; // Viernes, Sábado y Domingo
    } else {
      newWeekendDays = [0, 6]; // Por defecto
    }

    // Llamar inmediatamente al callback para persistir el cambio
    if (onConfigChange) {
      const newConfig = {
        ...config,
        weekendDays: newWeekendDays
      };
      onConfigChange(newConfig);
    }
  }, [config, onConfigChange, weekendDays]);

  const getCurrentPreset = useCallback(() => {
    // Ordenar los arrays para comparación consistente
    const sortedWeekendDays = [...weekendDays].sort();
    
    // Comparar arrays ordenados
    if (sortedWeekendDays.length === 2 && 
        sortedWeekendDays[0] === 0 && 
        sortedWeekendDays[1] === 6) {
      return 'saturday-sunday';
    } else if (sortedWeekendDays.length === 3 && 
               sortedWeekendDays[0] === 0 && 
               sortedWeekendDays[1] === 5 && 
               sortedWeekendDays[2] === 6) {
      return 'friday-saturday-sunday';
    }
    
    return 'saturday-sunday'; // Por defecto
  }, [weekendDays]);

  const currentPreset = getCurrentPreset();

  return (
    <div style={{
      padding: '16px',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      marginTop: '12px'
    }}>
      <h4 style={{
        margin: '0 0 12px 0',
        fontSize: '16px',
        fontWeight: '600',
        color: '#2c3e50'
      }}>
        Configuración de días de fin de semana
      </h4>
      
      <div style={{
        marginBottom: '16px'
      }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontSize: '14px',
          fontWeight: '500',
          color: '#495057'
        }}>
          Selecciona qué días se consideran fin de semana:
        </label>
        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          <button
            type="button"
            onClick={() => handlePresetChange('saturday-sunday')}
            style={{
              padding: '8px 16px',
              border: currentPreset === 'saturday-sunday' ? '2px solid #eb4d4b' : '1px solid #dee2e6',
              borderRadius: '6px',
              backgroundColor: currentPreset === 'saturday-sunday' ? '#eb4d4b15' : 'white',
              color: currentPreset === 'saturday-sunday' ? '#eb4d4b' : '#495057',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
          >
            Sábado y Domingo
          </button>
          <button
            type="button"
            onClick={() => handlePresetChange('friday-saturday-sunday')}
            style={{
              padding: '8px 16px',
              border: currentPreset === 'friday-saturday-sunday' ? '2px solid #eb4d4b' : '1px solid #dee2e6',
              borderRadius: '6px',
              backgroundColor: currentPreset === 'friday-saturday-sunday' ? '#eb4d4b15' : 'white',
              color: currentPreset === 'friday-saturday-sunday' ? '#eb4d4b' : '#495057',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
          >
            Viernes, Sábado y Domingo
          </button>
        </div>
      </div>
      
      <div style={{
        fontSize: '12px',
        color: '#6c757d',
        fontStyle: 'italic'
      }}>
        Esta configuración afecta cómo se calculan los precios dinámicos para los fines de semana.
      </div>
    </div>
  );
} 