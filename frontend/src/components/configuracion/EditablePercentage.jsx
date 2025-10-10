import React, { useState } from 'react';

export default function EditablePercentage({ 
  value, 
  onValueChange, 
  color, 
  min = 0, 
  max = 50,
  step = 1,
  label = ''
}) {
  const [isEditing, setIsEditing] = useState(false);

  const handleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = (e) => {
    const newValue = parseFloat(e.target.value);
    if (!isNaN(newValue) && newValue >= min && newValue <= max) {
      onValueChange(newValue);
    } else {
      // Si el valor no es válido, mantener el valor anterior
      console.warn('Valor inválido:', e.target.value);
    }
    setIsEditing(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  return (
    <div>
      {label && (
        <div style={{ 
          marginBottom: '12px', 
          fontWeight: '500', 
          color: color,
          fontSize: 'var(--font-size-small)',
          textAlign: 'center'
        }}>
          {label}
        </div>
      )}
      {isEditing ? (
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          defaultValue={value}
          onBlur={handleBlur}
          onKeyPress={handleKeyPress}
          autoFocus
          style={{
            width: '100%',
            padding: '12px',
            border: '2px solid',
            borderColor: color,
            borderRadius: '8px',
            fontSize: 'var(--font-size-xlarge)',
            fontWeight: 'bold',
            color: color,
            textAlign: 'center',
            backgroundColor: 'white',
            outline: 'none',
            boxShadow: `0 0 0 3px ${color}20`,
            transition: 'all 0.2s ease'
          }}
        />
      ) : (
        <div
          onClick={handleClick}
          style={{
            fontSize: 'var(--font-size-xlarge)',
            fontWeight: 'bold',
            color: color,
            cursor: 'pointer',
            padding: '12px',
            borderRadius: '8px',
            transition: 'all 0.2s ease',
            textAlign: 'center',
            border: '2px solid transparent',
            backgroundColor: 'transparent',
            position: 'relative'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#f8f9fa';
            e.target.style.borderColor = color;
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = 'transparent';
            e.target.style.borderColor = 'transparent';
          }}
          title="Haz clic para editar"
        >
          {value}%
          <div style={{
            position: 'absolute',
            top: '4px',
            right: '8px',
            fontSize: '0.85rem',
            color: color,
            opacity: 0.6,
            fontWeight: 'normal'
          }}>
            ✏️
          </div>
        </div>
      )}
    </div>
  );
} 