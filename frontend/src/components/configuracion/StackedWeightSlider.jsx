import React, { useState, useEffect } from 'react';

const factorNames = {
  'occupancy': 'Ocupación',
  'anticipation': 'Anticipación',
  'season': 'Estacionalidad',
  'events': 'Eventos'
};

const factorColors = {
  'occupancy': '#667eea',
  'anticipation': '#f0932b',
  'season': '#eb4d4b',
  'events': '#6ab04c'
};

export default function StackedWeightSlider({ weights, onChange }) {
  const [localWeights, setLocalWeights] = useState(weights);
  const [dragging, setDragging] = useState(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartWeights, setDragStartWeights] = useState({});

  useEffect(() => {
    setLocalWeights(weights);
  }, [weights]);

  const totalWidth = 600;
  const barHeight = 20;

  const normalizeWeights = (weights) => {
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    if (total === 0) return weights;
    
    const normalized = {};
    Object.keys(weights).forEach(key => {
      normalized[key] = weights[key] / total;
    });
    return normalized;
  };

  const getBarPositions = (weights) => {
    const normalized = normalizeWeights(weights);
    let currentX = 0;
    const positions = {};
    
    Object.keys(normalized).forEach(key => {
      positions[key] = {
        x: currentX,
        width: normalized[key] * totalWidth
      };
      currentX += normalized[key] * totalWidth;
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
    const newWeight = Math.max(0, Math.min(100, currentWeight + deltaPercent));
    
    // Redistribuir el peso entre los otros factores
    const otherFactors = Object.keys(newWeights).filter(key => key !== dragging);
    const totalOtherWeight = otherFactors.reduce((sum, key) => sum + newWeights[key], 0);
    
    if (totalOtherWeight > 0) {
      const ratio = (100 - newWeight) / totalOtherWeight;
      otherFactors.forEach(key => {
        newWeights[key] = newWeights[key] * ratio;
      });
    }
    
    setLocalWeights(newWeights);
  };

  const handleMouseUp = () => {
    if (dragging) {
      setDragging(null);
      onChange(localWeights);
    }
  };

  const positions = getBarPositions(localWeights);
  const normalized = normalizeWeights(localWeights);

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
        fontSize: '18px',
        fontWeight: '600'
      }}>
        Configuración de Pesos para Tarifas Dinámicas
      </h3>
      
      <p style={{ 
        marginBottom: '20px', 
        color: '#6c757d',
        fontSize: '14px',
        lineHeight: '1.5'
      }}>
        Ajusta los pesos de cada factor que influye en el cálculo de tarifas dinámicas. 
        Arrastra los bordes de cada sección para redistribuir los pesos. El total siempre suma 100%.
      </p>

      <div style={{ 
        position: 'relative',
        marginBottom: '20px'
      }}>
        {/* Barra principal */}
        <div style={{
          width: totalWidth,
          height: barHeight,
          backgroundColor: '#f8f9fa',
          borderRadius: '10px',
          position: 'relative',
          border: '2px solid #e9ecef'
        }}>
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
                fontSize: '12px',
                fontWeight: 'bold',
                userSelect: 'none'
              }}
              onMouseDown={(e) => handleMouseDown(factor, e)}
            >
              {factorNames[factor]}
            </div>
          ))}
        </div>

        {/* Etiquetas de porcentaje */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '10px',
          width: totalWidth
        }}>
          {Object.keys(positions).map(factor => (
            <div
              key={factor}
              style={{
                textAlign: 'center',
                fontSize: '12px',
                color: '#495057',
                fontWeight: '500'
              }}
            >
              <div style={{ color: factorColors[factor], fontWeight: 'bold' }}>
                {Math.round(normalized[factor] * 100)}%
              </div>
              <div style={{ fontSize: '10px', color: '#6c757d' }}>
                {factorNames[factor]}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Descripción de factores */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '15px',
        marginTop: '20px'
      }}>
        {Object.entries(factorNames).map(([key, name]) => (
          <div key={key} style={{
            border: `2px solid ${factorColors[key]}`,
            borderRadius: '8px',
            padding: '12px',
            background: `${factorColors[key]}10`
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              <div style={{
                width: '12px',
                height: '12px',
                backgroundColor: factorColors[key],
                borderRadius: '50%',
                marginRight: '8px'
              }} />
              <span style={{
                fontWeight: '600',
                color: '#2c3e50',
                fontSize: '14px'
              }}>
                {name}
              </span>
            </div>
            <div style={{
              fontSize: '12px',
              color: '#6c757d',
              lineHeight: '1.4'
            }}>
              {getFactorDescription(key)}
            </div>
          </div>
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
          onClick={() => {
            const defaultWeights = {
              occupancy: 30,
              anticipation: 25,
              season: 30,
              events: 15
            };
            setLocalWeights(defaultWeights);
            onChange(defaultWeights);
          }}
          style={{
            padding: '10px 20px',
            background: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Restaurar Valores por Defecto
        </button>
        <button
          onClick={() => onChange(localWeights)}
          style={{
            padding: '10px 20px',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Guardar Configuración
        </button>
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
    'season': 'Efecto de la estacionalidad turística en los precios.',
    'events': 'Influencia de eventos especiales, feriados o actividades locales en la demanda.'
  };
  return descriptions[factor] || '';
} 