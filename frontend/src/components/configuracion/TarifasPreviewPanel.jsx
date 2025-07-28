import React, { useState, useEffect } from 'react';

const roomTypeNames = {
  'single': 'Individual',
  'doble': 'Doble',
  'triple': 'Triple',
  'cuadruple': 'Cuádruple',
  'quintuple': 'Quíntuple',
  'departamento El Romerito': 'Departamento El Romerito',
  'departamento El Tilo': 'Departamento El Tilo',
  'departamento Via 1': 'Departamento Via 1',
  'departamento La Esquinita': 'Departamento La Esquinita'
};

// Orden de tipos de habitación para mostrar en la tabla
const roomTypeOrder = [
  'single',
  'doble', 
  'triple',
  'cuadruple',
  'quintuple',
  'departamento El Romerito',
  'departamento El Tilo',
  'departamento Via 1',
  'departamento La Esquinita'
];

const defaultRoomTypeCoefficients = {
  'single': 0.62,
  'doble': 1.00,
  'triple': 1.25,
  'cuadruple': 1.50,
  'quintuple': 1.75,
  'departamento El Romerito': 1.50,
  'departamento El Tilo': 1.50,
  'departamento Via 1': 1.50,
  'departamento La Esquinita': 1.50
};

export default function TarifasPreviewPanel({ hotelId = "default-hotel" }) {
  const [previewDate, setPreviewDate] = useState(new Date().toISOString().slice(0, 10));
  const [roomTypeCoefficients, setRoomTypeCoefficients] = useState(defaultRoomTypeCoefficients);
  const [basePrice, setBasePrice] = useState(10000); // Precio base por defecto
  const [mealRules, setMealRules] = useState({
    breakfastMode: "PERCENTAGE",
    breakfastValue: 0.15,
    dinnerMode: "PERCENTAGE",
    dinnerValue: 0.2,
  });
  const [saving, setSaving] = useState(false);

  // Cargar coeficientes desde el backend
  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    fetch(`${API_URL}/dynamic-pricing/coefficients/${hotelId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && Object.keys(data).length > 0) {
          setRoomTypeCoefficients(data);
        }
      })
      .catch((error) => {
        console.log('Error al cargar coeficientes, usando valores por defecto:', error);
      });
  }, [hotelId]);

  // Cargar reglas de comidas desde el backend
  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    fetch(`${API_URL}/dynamic-pricing/meals/${hotelId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setMealRules(data);
        }
      })
      .catch((error) => {
        console.log('Error al cargar reglas de comidas, usando valores por defecto:', error);
      });
  }, [hotelId]);

  // Escuchar eventos de actualización de reglas de comidas
  useEffect(() => {
    const handleMealRulesUpdate = (event) => {
      if (event.detail && event.detail.hotelId === hotelId) {
        // Actualizar las reglas con los nuevos datos
        setMealRules(event.detail.rules);
      }
    };

    window.addEventListener('mealRulesUpdated', handleMealRulesUpdate);

    return () => {
      window.removeEventListener('mealRulesUpdated', handleMealRulesUpdate);
    };
  }, [hotelId]);

  // Calcular precios de comidas
  const calculateMealPrices = (basePriceForType) => {
    let breakfastPrice = basePriceForType;
    let halfBoardPrice = basePriceForType;

    // Calcular precio con desayuno
    if (mealRules.breakfastMode === "FIXED") {
      breakfastPrice = basePriceForType + mealRules.breakfastValue;
    } else {
      breakfastPrice = basePriceForType * (1 + mealRules.breakfastValue);
    }

    // Calcular precio con media pensión
    if (mealRules.dinnerMode === "FIXED") {
      halfBoardPrice = breakfastPrice + mealRules.dinnerValue;
    } else {
      halfBoardPrice = breakfastPrice * (1 + mealRules.dinnerValue);
    }

    return {
      breakfast: Math.round(breakfastPrice),
      halfBoard: Math.round(halfBoardPrice)
    };
  };

  // Manejar cambios en coeficientes
  const handleCoefficientChange = (roomType, value) => {
    const newCoefficients = {
      ...roomTypeCoefficients,
      [roomType]: parseFloat(value) || 0
    };
    setRoomTypeCoefficients(newCoefficients);
    
    // Guardar automáticamente
    saveCoefficients(newCoefficients);
  };

  // Manejar cambios en precios base
  const handleBasePriceChange = (roomType, value) => {
    const newPrice = parseFloat(value) || 0;
    const newCoefficient = newPrice / basePrice;
    
    const newCoefficients = {
      ...roomTypeCoefficients,
      [roomType]: newCoefficient
    };
    setRoomTypeCoefficients(newCoefficients);
    
    // Guardar automáticamente
    saveCoefficients(newCoefficients);
  };

  // Guardar coeficientes
  const saveCoefficients = async (coefficients) => {
    setSaving(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      await fetch(`${API_URL}/dynamic-pricing/coefficients/${hotelId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(coefficients)
      });
      
      // Disparar evento para actualizar otros componentes
      window.dispatchEvent(new CustomEvent('coefficientsUpdated', {
        detail: { hotelId, coefficients }
      }));
      
    } catch (error) {
      console.error('Error al guardar coeficientes:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ 
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      padding: '24px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <h3 style={{ marginBottom: '20px', color: '#2c3e50' }}>Previsualización de Tarifas</h3>
      
      <div style={{ marginBottom: '20px', display: 'flex', gap: '20px', alignItems: 'center' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
            Fecha de previsualización:
          </label>
          <input
            type="date"
            value={previewDate}
            onChange={(e) => setPreviewDate(e.target.value)}
            style={{
              padding: '8px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          />
        </div>
        
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
            Precio base:
          </label>
          <input
            type="number"
            value={basePrice}
            onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)}
            style={{
              padding: '8px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              fontSize: '14px',
              width: '120px'
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          fontSize: '14px'
        }}>
          <thead>
            <tr style={{ 
              backgroundColor: '#f8f9fa',
              borderBottom: '2px solid #dee2e6'
            }}>
              <th style={{ padding: '15px', textAlign: 'left', fontWeight: '600', color: '#495057' }}>
                Tipo de Habitación
              </th>
              <th style={{ padding: '15px', textAlign: 'center', fontWeight: '600', color: '#495057' }}>
                Coeficiente
              </th>
              <th style={{ padding: '15px', textAlign: 'center', fontWeight: '600', color: '#495057' }}>
                Precio Base
              </th>
              <th style={{ padding: '15px', textAlign: 'center', fontWeight: '600', color: '#495057' }}>
                Con Desayuno
              </th>
              <th style={{ padding: '15px', textAlign: 'center', fontWeight: '600', color: '#495057' }}>
                Con Media Pensión
              </th>
            </tr>
          </thead>
          <tbody>
            {roomTypeOrder
              .filter(type => roomTypeCoefficients[type] !== undefined)
              .map((type) => {
                const coefficient = roomTypeCoefficients[type];
                const basePriceForType = Math.round(basePrice * coefficient);
                const { breakfast, halfBoard } = calculateMealPrices(basePriceForType);
                
                return (
                  <tr key={type} style={{ borderBottom: '1px solid #e9ecef' }}>
                    <td style={{ padding: '15px', fontWeight: '500', color: '#495057' }}>
                      {roomTypeNames[type] || type}
                    </td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      <input
                        type="number"
                        value={coefficient}
                        onChange={(e) => handleCoefficientChange(type, e.target.value)}
                        step="0.01"
                        min="0"
                        style={{
                          width: '80px',
                          padding: '4px 8px',
                          border: '1px solid #ced4da',
                          borderRadius: '4px',
                          fontSize: '12px',
                          textAlign: 'center'
                        }}
                      />
                    </td>
                    <td style={{ padding: '15px', textAlign: 'center' }}>
                      <input
                        type="number"
                        value={basePriceForType}
                        onChange={(e) => handleBasePriceChange(type, e.target.value)}
                        min="0"
                        style={{
                          width: '100px',
                          padding: '4px 8px',
                          border: '1px solid #ced4da',
                          borderRadius: '4px',
                          fontSize: '12px',
                          textAlign: 'center'
                        }}
                      />
                    </td>
                    <td style={{ padding: '15px', textAlign: 'right', color: '#28a745', fontSize: '14px' }}>
                      ${breakfast.toLocaleString()}
                    </td>
                    <td style={{ padding: '15px', textAlign: 'right', color: '#dc3545', fontSize: '14px' }}>
                      ${halfBoard.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      
      {saving && (
        <div style={{ 
          marginTop: '10px', 
          textAlign: 'center', 
          color: '#6c757d', 
          fontSize: '12px' 
        }}>
          Guardando cambios...
        </div>
      )}
    </div>
  );
} 