import React, { useEffect, useState } from 'react';

const roomTypeNames = {
  'single': 'Individual',
  'doble': 'Doble',
  'triple': 'Triple',
  'cuadruple': 'Cuádruple',
  'quintuple': 'Quíntuple'
};

const defaultCoefficients = {
  'single': 0.62,
  'doble': 1.00,
  'triple': 1.25,
  'cuadruple': 1.50,
  'quintuple': 1.75
};

export default function CoefficientsPanel({ hotelId = "default-hotel" }) {
  const [coefficients, setCoefficients] = useState(defaultCoefficients);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // Cargar coeficientes desde el backend
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    fetch(`${API_URL}/dynamic-pricing/coefficients/${hotelId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && Object.keys(data).length > 0) {
          setCoefficients(data);
        }
      })
      .catch((error) => {
        console.log('Error al cargar coeficientes, usando valores por defecto:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [hotelId]);

  const handleCoefficientChange = (roomType, value) => {
    setCoefficients(prev => ({
      ...prev,
      [roomType]: parseFloat(value)
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_URL}/dynamic-pricing/coefficients/${hotelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(coefficients)
      });
      
      if (response.ok) {
        alert('Coeficientes guardados exitosamente');
      } else {
        throw new Error('Error al guardar coeficientes');
      }
    } catch (error) {
      console.error('Error al guardar coeficientes:', error);
      alert('Error al guardar los coeficientes');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setCoefficients(defaultCoefficients);
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        Cargando coeficientes...
      </div>
    );
  }

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
        Configuración de Coeficientes por Tipo de Habitación
      </h3>
      
      <p style={{ 
        marginBottom: '20px', 
        color: '#6c757d',
        fontSize: '14px',
        lineHeight: '1.5'
      }}>
        Los coeficientes determinan la proporción de precios entre diferentes tipos de habitación. 
        El coeficiente de la habitación Doble es 1.00 (precio base), y los demás tipos se calculan 
        como multiplicadores de este precio base.
      </p>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px',
        marginBottom: '24px'
      }}>
        {Object.entries(roomTypeNames).map(([key, name]) => (
          <div key={key} style={{
            border: '1px solid #e9ecef',
            borderRadius: '8px',
            padding: '16px',
            background: '#f8f9fa'
          }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '500',
              color: '#495057',
              fontSize: '14px'
            }}>
              {name}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="number"
                step="0.01"
                min="0"
                value={coefficients[key]}
                onChange={(e) => handleCoefficientChange(key, e.target.value)}
                style={{ 
                  flex: 1,
                  padding: '8px 12px', 
                  border: '1px solid #ced4da', 
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
              <span style={{ 
                color: '#6c757d',
                fontSize: '12px',
                fontWeight: '500'
              }}>
                x{coefficients[key]}
              </span>
            </div>
            <div style={{ 
              marginTop: '8px',
              fontSize: '12px',
              color: '#6c757d'
            }}>
              {key === 'doble' ? 'Precio base (referencia)' : `Multiplicador del precio base`}
            </div>
          </div>
        ))}
      </div>

      <div style={{ 
        display: 'flex', 
        gap: '12px',
        justifyContent: 'flex-end'
      }}>
        <button
          onClick={handleReset}
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
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '10px 20px',
            background: saving ? '#6c757d' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          {saving ? 'Guardando...' : 'Guardar Coeficientes'}
        </button>
      </div>
    </div>
  );
} 