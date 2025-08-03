import React, { useState, useEffect } from 'react';
import FactorConfigPanel from './FactorConfigPanel';
import AnticipationFactorConfig from './AnticipationFactorConfig';

const factorNames = {
  'occupancy': 'Ocupación',
  'anticipation': 'Anticipación',
  'weekend': 'Fin de semana',
  'holiday': 'Feriados',
  'demand': 'Índice de demanda',
  'weather': 'Clima',
  'events': 'Eventos'
};

const factorColors = {
  'occupancy': '#667eea',
  'anticipation': '#f0932b',
  'weekend': '#eb4d4b',
  'holiday': '#6ab04c',
  'demand': '#9b59b6',
  'weather': '#3498db',
  'events': '#e74c3c'
};

export default function DynamicPricingWeightsEditor({ weights, onChange, config, onConfigChange }) {
  const [localWeights, setLocalWeights] = useState(weights);
  const [originalWeights, setOriginalWeights] = useState(weights);
  const [activeFactors, setActiveFactors] = useState({
    occupancy: true,
    anticipation: true,
    weekend: true,
    holiday: true,
    demand: true,
    weather: true,
    events: true
  });
  const [dragging, setDragging] = useState(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartWeights, setDragStartWeights] = useState({});
  const [editingFactor, setEditingFactor] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalWeights(weights);
    setOriginalWeights(weights);
    setHasChanges(false);
  }, [weights]);

  const totalWidth = window.innerWidth > 1200 ? 1000 : Math.max(600, window.innerWidth - 100);
  const barHeight = 30;

  // Obtener solo los factores activos
  const getActiveWeights = () => {
    const active = {};
    Object.keys(localWeights).forEach(key => {
      if (activeFactors[key]) {
        active[key] = localWeights[key];
      }
    });
    return active;
  };

  // Calcular el total actual de pesos solo de factores activos
  const activeWeights = getActiveWeights();
  const currentTotal = Object.values(activeWeights).reduce((sum, weight) => sum + weight, 0);
  const isComplete = Math.abs(currentTotal - 100) < 0.1; // Tolerancia de 0.1%

  // Función para calcular el máximo valor posible para un factor
  const getMaxValueForFactor = (factor, currentWeights) => {
    const otherFactors = Object.keys(currentWeights).filter(key => key !== factor && activeFactors[key]);
    const otherFactorsTotal = otherFactors.reduce((sum, key) => sum + currentWeights[key], 0);
    return Math.max(0, 100 - otherFactorsTotal);
  };

  // Función para detectar cambios
  const checkForChanges = (newWeights) => {
    const hasChanges = Object.keys(originalWeights).some(key => 
      Math.abs((originalWeights[key] || 0) - (newWeights[key] || 0)) > 0.1
    );
    setHasChanges(hasChanges);
  };

  const handleFactorToggle = (factor) => {
    const newActiveFactors = { ...activeFactors };
    newActiveFactors[factor] = !newActiveFactors[factor];
    setActiveFactors(newActiveFactors);
    setHasChanges(true);
  };

  const getBarPositions = (weights) => {
    let currentX = 0;
    const positions = {};
    
    Object.keys(weights).forEach(key => {
      if (activeFactors[key]) {
        const width = (weights[key] / 100) * totalWidth;
        positions[key] = {
          x: currentX,
          width: width
        };
        currentX += width;
      }
    });
    
    return positions;
  };

  const handleMouseDown = (factor, e) => {
    setDragging(factor);
    setDragStartX(e.clientX);
    setDragStartWeights({ ...localWeights });
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    
    const deltaX = e.clientX - dragStartX;
    const deltaPercent = (deltaX / totalWidth) * 100;
    
    const newWeights = { ...dragStartWeights };
    const currentWeight = newWeights[dragging];
    const newWeight = currentWeight + deltaPercent;
    
    // Calcular el máximo valor posible para este factor
    const maxValue = getMaxValueForFactor(dragging, dragStartWeights);
    
    // Aplicar límites: mínimo 0, máximo el valor calculado
    const clampedWeight = Math.max(0, Math.min(maxValue, newWeight));
    
    // Solo cambiar el peso del factor que se está arrastrando
    newWeights[dragging] = clampedWeight;
    
    setLocalWeights(newWeights);
    checkForChanges(newWeights);
  };

  const handleMouseUp = () => {
    if (dragging) {
      setDragging(null);
      // No llamar a onChange aquí, solo actualizar el estado local
    }
  };

  const handlePercentageClick = (factor) => {
    setEditingFactor(factor);
    setEditValue(localWeights[factor].toString());
  };

  const handlePercentageChange = (e) => {
    const value = e.target.value;
    setEditValue(value);
  };

  const handlePercentageBlur = () => {
    if (editingFactor && editValue !== '') {
      const newValue = parseFloat(editValue) || 0;
      
      // Calcular el máximo valor posible para este factor
      const maxValue = getMaxValueForFactor(editingFactor, localWeights);
      
      // Aplicar límites
      const clampedValue = Math.max(0, Math.min(maxValue, newValue));
      
      const newWeights = { ...localWeights };
      newWeights[editingFactor] = clampedValue;
      setLocalWeights(newWeights);
      checkForChanges(newWeights);
      // No llamar a onChange aquí
    }
    setEditingFactor(null);
    setEditValue('');
  };

  const handlePercentageKeyPress = (e) => {
    if (e.key === 'Enter') {
      handlePercentageBlur();
    } else if (e.key === 'Escape') {
      setEditingFactor(null);
      setEditValue('');
    }
  };

  const handleSave = async () => {
    if (!isComplete || saving) return;
    
    setSaving(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      
      // Crear objeto con solo los factores activos, 0 para los inactivos
      const weightsToSend = {};
      Object.keys(localWeights).forEach(key => {
        weightsToSend[key] = activeFactors[key] ? localWeights[key] : 0;
      });
      
      const response = await fetch(`${API_URL}/dynamic-pricing/config/default-hotel`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Mapear los campos del frontend a los del backend
          globalOccupancyWeight: weightsToSend.occupancy / 100,
          anticipationWeight: weightsToSend.anticipation / 100,
          isWeekendWeight: weightsToSend.weekend / 100,
          isHolidayWeight: weightsToSend.holiday / 100,
          demandIndexWeight: weightsToSend.demand / 100,
          weatherScoreWeight: weightsToSend.weather / 100,
          eventImpactWeight: weightsToSend.events / 100,
          anticipationThresholds: [21, 14, 7, 3],
          maxAdjustmentPercentage: 0.4
        })
      });

      if (response.ok) {
        setOriginalWeights(localWeights);
        setHasChanges(false);
        onChange(localWeights);
      } else {
        console.error('Error al guardar la configuración');
      }
    } catch (error) {
      console.error('Error al guardar:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreDefaults = () => {
    const defaultWeights = {
      occupancy: 25,
      anticipation: 20,
      weekend: 15,
      holiday: 10,
      demand: 15,
      weather: 5,
      events: 10
    };
    setLocalWeights(defaultWeights);
    checkForChanges(defaultWeights);
  };

  const positions = getBarPositions(localWeights);

  return (
    <div style={{ 
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      padding: '24px',
      marginBottom: '24px'
    }}>
      <h3 style={{ 
        marginBottom: '20px', 
        color: '#2c3e50',
        fontSize: '24px',
        fontWeight: '600'
      }}>
        Editor de Factores de Precios Dinámicos
      </h3>
      
      <p style={{ 
        marginBottom: '20px', 
        color: '#6c757d',
        fontSize: '18px',
        lineHeight: '1.5'
      }}>
        Ajusta los pesos de cada factor que influye en el cálculo de tarifas dinámicas. 
        Arrastra los bordes de cada sección o haz clic en los porcentajes para modificar los pesos individualmente.
        El total no puede superar el 100%.
      </p>

      <div style={{ 
        position: 'relative',
        marginBottom: '20px'
      }}>
        {/* Barra gris de fondo (100%) */}
        <div style={{
          width: '100%',
          maxWidth: totalWidth,
          height: barHeight,
          backgroundColor: '#e9ecef',
          borderRadius: '10px',
          position: 'relative',
          border: '2px solid #dee2e6'
        }}>
          {/* Barras de factores */}
          {Object.keys(positions).map(factor => (
            <div
              key={factor}
              style={{
                position: 'absolute',
                left: positions[factor].x,
                width: positions[factor].width,
                height: barHeight,
                backgroundColor: factorColors[factor],
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '16px',
                fontWeight: 'bold',
                userSelect: 'none',
                zIndex: 2
              }}
              onMouseDown={(e) => handleMouseDown(factor, e)}
            >
              {factorNames[factor]}
            </div>
          ))}
        </div>

                {/* Etiquetas de porcentaje */}
        <div style={{
          position: 'relative',
          marginTop: '10px',
          width: '100%',
          maxWidth: totalWidth,
          height: '30px'
        }}>
          {Object.keys(positions).map(factor => (
            <div
              key={factor}
              style={{
                position: 'absolute',
                left: positions[factor].x + (positions[factor].width / 2) - 20,
                fontSize: '16px',
                color: factorColors[factor],
                fontWeight: '600',
                textAlign: 'center',
                width: '40px'
              }}
            >
              {editingFactor === factor ? (
                <input
                  type="number"
                  value={editValue}
                  onChange={handlePercentageChange}
                  onBlur={handlePercentageBlur}
                  onKeyPress={handlePercentageKeyPress}
                  min="0"
                  max={getMaxValueForFactor(factor, localWeights)}
                  style={{
                    width: '40px',
                    textAlign: 'center',
                    border: '1px solid #007bff',
                    borderRadius: '4px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: factorColors[factor]
                  }}
                  autoFocus
                />
              ) : (
                <div 
                  style={{ 
                    color: factorColors[factor], 
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = '#f8f9fa';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = 'transparent';
                  }}
                  onClick={() => handlePercentageClick(factor)}
                >
                  {Math.round(localWeights[factor])}%
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Notificación de estado */}
        {!isComplete && (
          <div style={{
            marginTop: '10px',
            padding: '8px 12px',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '6px',
            color: '#856404',
            fontSize: '12px',
            fontWeight: '500'
          }}>
            ⚠️ Total actual: {Math.round(currentTotal)}% - Ajusta los pesos para llegar al 100%
          </div>
        )}
      </div>

      {/* Paneles de configuración de factores */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        marginTop: '20px'
      }}>
        {Object.entries(factorNames).map(([key, name]) => (
          <FactorConfigPanel
            key={key}
            factor={key}
            name={name}
            color={factorColors[key]}
            description={getFactorDescription(key)}
            isActive={activeFactors[key]}
            weight={localWeights[key]}
            onToggle={() => handleFactorToggle(key)}
            onWeightChange={(newWeight) => {
              const newWeights = { ...localWeights, [key]: newWeight };
              setLocalWeights(newWeights);
              checkForChanges(newWeights);
            }}
          >
            {key === 'anticipation' && (
              <AnticipationFactorConfig
                config={{
                  anticipationMode: config?.anticipationMode || 'ESCALONADO',
                  anticipationMaxDays: config?.anticipationMaxDays || 30,
                  anticipationSteps: config?.anticipationSteps || [
                    { days: 21, weight: 1.0 },
                    { days: 14, weight: 0.7 },
                    { days: 7, weight: 0.4 },
                    { days: 3, weight: 0.2 }
                  ]
                }}
                onConfigChange={(anticipationConfig) => {
                  if (onConfigChange) {
                    const newConfig = {
                      ...config,
                      anticipationMode: anticipationConfig.anticipationMode,
                      anticipationMaxDays: anticipationConfig.anticipationMaxDays,
                      anticipationSteps: anticipationConfig.anticipationSteps
                    };
                    onConfigChange('anticipationConfig', newConfig);
                  }
                }}
              />
            )}
          </FactorConfigPanel>
        ))}
      </div>

      {/* Botones de acción */}
      <div style={{
        display: 'flex',
        gap: '12px',
        justifyContent: 'flex-end',
        marginTop: '20px'
      }}>
        <button
          onClick={handleRestoreDefaults}
          style={{
            padding: '12px 24px',
            background: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '500'
          }}
        >
          Restaurar Valores por Defecto
        </button>
        {hasChanges && (
          <button
            onClick={handleSave}
            disabled={!isComplete || saving}
            style={{
              padding: '12px 24px',
              background: isComplete && !saving ? '#28a745' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isComplete && !saving ? 'pointer' : 'not-allowed',
              fontSize: '16px',
              fontWeight: '500',
              opacity: isComplete && !saving ? 1 : 0.6
            }}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        )}
      </div>

      {/* Event listeners para el drag */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: dragging ? 'auto' : 'none',
          zIndex: 1000
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
    </div>
  );
}

function getFactorDescription(factor) {
  const descriptions = {
    'occupancy': 'Influencia del nivel de ocupación del hotel en el precio. Mayor ocupación = precios más altos.',
    'anticipation': 'Impacto de la anticipación de reservas. Reservas anticipadas pueden tener precios diferentes.',
    'weekend': 'Efecto de los fines de semana en la demanda y precios. Mayor demanda = precios más altos.',
    'holiday': 'Influencia de los feriados nacionales o locales en la demanda y precios.',
    'demand': 'Impacto del índice de demanda general en la tarifa. Basado en reservas históricas.',
    'weather': 'Efecto del clima en la demanda y precios de los hoteles.',
    'events': 'Influencia de eventos especiales, feriados o actividades locales en la demanda.'
  };
  return descriptions[factor] || '';
} 