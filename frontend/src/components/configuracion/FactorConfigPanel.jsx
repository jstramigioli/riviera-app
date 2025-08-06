import React from 'react';

export default function FactorConfigPanel({ 
  name, 
  color, 
  description, 
  isActive, 
  onToggle, 
  children 
}) {
  return (
    <div style={{
      border: `2px solid ${color}`,
      borderRadius: '12px',
      padding: '20px',
      backgroundColor: 'white',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header con toggle */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: `1px solid ${color}20`
      }}>
        <div>
          <h4 style={{ 
            margin: '0 0 4px 0', 
            color: color,
            fontSize: 'var(--font-size-large)',
            fontWeight: '600'
          }}>
            {name}
          </h4>
          <p style={{ 
            margin: 0, 
            fontSize: 'var(--font-size-small)', 
            color: '#666',
            fontStyle: 'italic'
          }}>
            {description}
          </p>
        </div>
        
        {/* Toggle Switch */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            onClick={onToggle}
            style={{
              width: '40px',
              height: '20px',
              backgroundColor: isActive ? color : '#bdc3c7',
              borderRadius: '10px',
              position: 'relative',
              cursor: 'pointer',
              transition: 'background-color 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              padding: '2px'
            }}
          >
            <div
              style={{
                width: '16px',
                height: '16px',
                backgroundColor: 'white',
                borderRadius: '50%',
                transform: isActive ? 'translateX(20px)' : 'translateX(0px)',
                transition: 'transform 0.3s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              }}
            />
          </div>
        </div>
      </div>
      
      {/* Contenido del panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
} 