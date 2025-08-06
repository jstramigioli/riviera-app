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
    }
    setIsEditing(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  return (
    <div>
      {label && (
        <div style={{ 
          marginBottom: '12px', 
          fontWeight: '500', 
          color: color,
          fontSize: 'var(--font-size-medium)',
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
            padding: '14px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            fontSize: 'var(--font-size-medium)'
          }}
        />
      ) : (
        <div
          onClick={handleClick}
          style={{
            fontSize: 'calc(var(--font-size-xxlarge) * 2)',
            fontWeight: 'bold',
            color: color,
            cursor: 'pointer',
            padding: '12px',
            borderRadius: '8px',
            transition: 'background-color 0.2s ease',
            textAlign: 'center'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#f8f9fa';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = 'transparent';
          }}
        >
          {value}%
        </div>
      )}
    </div>
  );
} 