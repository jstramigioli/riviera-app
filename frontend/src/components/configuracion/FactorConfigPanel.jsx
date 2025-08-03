import React from 'react';

export default function FactorConfigPanel({ 
  name, 
  color, 
  description, 
  isActive, 
  weight, 
  onToggle, 
  children 
}) {
  // Auto-expandir cuando está activo, auto-colapsar cuando está inactivo
  const isExpanded = isActive;

  return (
    <div 
      style={{
        border: `2px solid ${color}`,
        borderRadius: '12px',
        padding: '16px',
        background: isActive ? `${color}08` : '#f8f9fa',
        opacity: isActive ? 1 : 0.6,
        transition: 'all 0.3s ease',
        marginBottom: '16px',
        minHeight: isExpanded ? 'auto' : '80px'
      }}
    >
      {/* Header del factor */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flex: 1
        }}>
          <div 
            style={{
              width: '16px',
              height: '16px',
              backgroundColor: color,
              borderRadius: '50%',
              marginRight: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onClick={onToggle}
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.2)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1)';
            }}
          />
          <span style={{
            fontWeight: '600',
            color: '#2c3e50',
            fontSize: '20px'
          }}>
            {name}
          </span>
        </div>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          {/* Peso actual */}
          {isActive && (
            <div style={{
              fontSize: '18px',
              color: color,
              fontWeight: '600',
              padding: '6px 12px',
              backgroundColor: `${color}15`,
              borderRadius: '6px'
            }}>
              {Math.round(weight)}%
            </div>
          )}
        </div>
      </div>
      
      {/* Descripción */}
      <div style={{
        fontSize: '16px',
        color: '#6c757d',
        lineHeight: '1.4',
        marginBottom: '8px'
      }}>
        {description}
      </div>
      
      {/* Contenido expandible */}
      {isActive && isExpanded && (
        <div style={{
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: `1px solid ${color}30`
        }}>
          {children}
        </div>
      )}
    </div>
  );
} 