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

// Orden de tipos de habitación para mostrar en la tabla (se cargará dinámicamente)
// const defaultRoomTypeOrder = [
//   'single',
//   'doble', 
//   'triple',
//   'cuadruple',
//   'quintuple',
//   'departamento El Romerito',
//   'departamento El Tilo',
//   'departamento Via 1',
//   'departamento La Esquinita'
// ];

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
  const [basePrice, setBasePrice] = useState(0); // Se calculará automáticamente
  const [mealRules, setMealRules] = useState({
    breakfastMode: "PERCENTAGE",
    breakfastValue: 0.15,
    dinnerMode: "PERCENTAGE",
    dinnerValue: 0.2,
  });
  const [saving, setSaving] = useState(false);
  const [roomTypes, setRoomTypes] = useState([]); // Nuevo estado para tipos de habitación dinámicos
  const [editablePrices, setEditablePrices] = useState({}); // Estado para precios editables

  // Cargar tipos de habitación desde el backend
  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    fetch(`${API_URL}/room-types`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setRoomTypes(data);
        }
      })
      .catch((error) => {
        console.log('Error al cargar tipos de habitación:', error);
      });
  }, []);

  // Escuchar eventos de actualización de tipos de habitación
  useEffect(() => {
    const handleRoomTypesUpdate = (event) => {
      console.log('🔄 Actualizando tipos de habitación en previsualización:', event.detail);
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      fetch(`${API_URL}/room-types`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setRoomTypes(data);
          }
        })
        .catch((error) => {
          console.log('Error al recargar tipos de habitación:', error);
        });
    };

    window.addEventListener('roomTypesUpdated', handleRoomTypesUpdate);
    return () => {
      window.removeEventListener('roomTypesUpdated', handleRoomTypesUpdate);
    };
  }, []);

  // Cargar precio base desde bloques de temporada
  const loadBasePriceFromSeasonBlocks = async (date) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      // Usar un rango de fechas válido (mismo día + 1 día siguiente)
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().slice(0, 10);
      
      const url = `${API_URL}/dynamic-pricing/calculated-rates/${hotelId}/3?startDate=${date}&endDate=${nextDayStr}&serviceType=base`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.rates && data.rates.length > 0) {
        // Usar el precio base del primer día
        const baseRate = data.rates[0].baseRate;
        setBasePrice(baseRate);
      } else {
        setBasePrice(0);
      }
    } catch (error) {
      console.error('Error al cargar precio base desde bloques de temporada:', error);
      setBasePrice(0);
    }
  };

  // Cargar precio base cuando cambie la fecha
  useEffect(() => {
    if (previewDate) {
      loadBasePriceFromSeasonBlocks(previewDate);
    }
  }, [previewDate, hotelId]);

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
    const newEditablePrices = { ...editablePrices };
    
    // Actualizar el precio base para el tipo de habitación editado
    newEditablePrices[roomType] = newPrice;
    
    // Actualizar todos los demás tipos de habitación basándose en sus coeficientes
    roomTypes.forEach(type => {
      if (type.name !== roomType) {
        const coefficient = roomTypeCoefficients[type.name];
        newEditablePrices[type.name] = Math.round(newPrice * coefficient);
      }
    });
    
    setEditablePrices(newEditablePrices);
  };

  // Manejar cambios en precios de desayuno
  const handleBreakfastPriceChange = (roomType, value) => {
    const newBreakfastPrice = parseFloat(value) || 0;
    const coefficient = roomTypeCoefficients[roomType] || 1.0;
    
    // Calcular el nuevo precio base que resulte en el precio de desayuno deseado
    let newBasePriceForType;
    if (mealRules.breakfastMode === "FIXED") {
      newBasePriceForType = newBreakfastPrice - mealRules.breakfastValue;
    } else {
      newBasePriceForType = newBreakfastPrice / (1 + mealRules.breakfastValue);
    }
    
    // Convertir el precio base del tipo de habitación al precio base global
    const newGlobalBasePrice = newBasePriceForType / coefficient;
    setBasePrice(newGlobalBasePrice);
    
    // Actualizar todos los precios base basándose en el nuevo precio base global calculado
    const newEditablePrices = { ...editablePrices };
    roomTypes.forEach(type => {
      const typeCoefficient = roomTypeCoefficients[type.name];
      newEditablePrices[type.name] = Math.round(newGlobalBasePrice * typeCoefficient);
    });
    
    setEditablePrices(newEditablePrices);
  };

  // Manejar cambios en precios de media pensión
  const handleHalfBoardPriceChange = (roomType, value) => {
    const newHalfBoardPrice = parseFloat(value) || 0;
    const coefficient = roomTypeCoefficients[roomType] || 1.0;
    
    // Calcular el precio base del tipo de habitación que resulte en el precio de media pensión deseado
    let newBasePriceForType;
    if (mealRules.dinnerMode === "FIXED") {
      // Para modo FIXED, necesitamos calcular hacia atrás desde el precio de media pensión
      // Primero calculamos el precio de desayuno que resultaría
      const breakfastPrice = newHalfBoardPrice - mealRules.dinnerValue;
      // Luego calculamos el precio base que resultaría en ese precio de desayuno
      if (mealRules.breakfastMode === "FIXED") {
        newBasePriceForType = breakfastPrice - mealRules.breakfastValue;
      } else {
        newBasePriceForType = breakfastPrice / (1 + mealRules.breakfastValue);
      }
    } else {
      // Para modo PERCENTAGE, calculamos hacia atrás desde el precio de media pensión
      // El precio de media pensión = precio de desayuno * (1 + dinnerValue)
      const breakfastPrice = newHalfBoardPrice / (1 + mealRules.dinnerValue);
      // Luego calculamos el precio base que resultaría en ese precio de desayuno
      if (mealRules.breakfastMode === "FIXED") {
        newBasePriceForType = breakfastPrice - mealRules.breakfastValue;
      } else {
        newBasePriceForType = breakfastPrice / (1 + mealRules.breakfastValue);
      }
    }
    
    // Convertir el precio base del tipo de habitación al precio base global
    const newGlobalBasePrice = newBasePriceForType / coefficient;
    setBasePrice(newGlobalBasePrice);
    
    // Actualizar todos los precios base basándose en el nuevo precio base global calculado
    const newEditablePrices = { ...editablePrices };
    roomTypes.forEach(type => {
      const typeCoefficient = roomTypeCoefficients[type.name];
      newEditablePrices[type.name] = Math.round(newGlobalBasePrice * typeCoefficient);
    });
    
    setEditablePrices(newEditablePrices);
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
      <h3 style={{ 
        marginBottom: '20px', 
        color: '#2c3e50',
        fontSize: 'var(--font-size-xxlarge)',
        fontWeight: '600'
      }}>Previsualización de Tarifas</h3>
      
      <div style={{ marginBottom: '20px' }}>
        <div>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            fontWeight: '500',
            fontSize: 'var(--font-size-medium)',
            color: '#495057'
          }}>
            Fecha de previsualización:
          </label>
          <input
            type="date"
            value={previewDate}
            onChange={(e) => setPreviewDate(e.target.value)}
            style={{
              padding: '12px',
              border: '1px solid #ced4da',
              borderRadius: '6px',
              fontSize: 'var(--font-size-medium)',
              width: '200px'
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          fontSize: 'var(--font-size-medium)'
        }}>
          <thead>
            <tr style={{ 
              backgroundColor: '#f8f9fa',
              borderBottom: '2px solid #dee2e6'
            }}>
              <th style={{ 
                padding: '16px', 
                textAlign: 'left', 
                fontWeight: '600', 
                color: '#495057',
                fontSize: 'var(--font-size-medium)'
              }}>
                Tipo de Habitación
              </th>
              <th style={{ 
                padding: '16px', 
                textAlign: 'center', 
                fontWeight: '600', 
                color: '#495057',
                fontSize: 'var(--font-size-medium)'
              }}>
                Coeficiente
              </th>
              <th style={{ 
                padding: '16px', 
                textAlign: 'center', 
                fontWeight: '600', 
                color: '#495057',
                fontSize: 'var(--font-size-medium)'
              }}>
                Precio Base
              </th>
              <th style={{ 
                padding: '16px', 
                textAlign: 'center', 
                fontWeight: '600', 
                color: '#495057',
                fontSize: 'var(--font-size-medium)'
              }}>
                Con Desayuno
              </th>
              <th style={{ 
                padding: '16px', 
                textAlign: 'center', 
                fontWeight: '600', 
                color: '#495057',
                fontSize: 'var(--font-size-medium)'
              }}>
                Con Media Pensión
              </th>
            </tr>
          </thead>
          <tbody>
            {roomTypes.length > 0 
              ? roomTypes
                  .filter(roomType => roomTypeCoefficients[roomType.name] !== undefined)
                  .map((roomType) => {
                    const coefficient = roomTypeCoefficients[roomType.name];
                    const basePriceForType = editablePrices[roomType.name] || Math.round(basePrice * coefficient);
                    const { breakfast, halfBoard } = calculateMealPrices(basePriceForType);
                    
                    return (
                      <tr key={roomType.id} style={{ borderBottom: '1px solid #e9ecef' }}>
                        <td style={{ 
                          padding: '16px', 
                          textAlign: 'center', 
                          fontWeight: '500', 
                          color: '#495057',
                          fontSize: 'var(--font-size-medium)'
                        }}>
                          {roomTypeNames[roomType.name] || roomType.name}
                        </td>
                        <td style={{ padding: '16px', textAlign: 'center' }}>
                          <input
                            type="number"
                            value={coefficient}
                            onChange={(e) => handleCoefficientChange(roomType.name, e.target.value)}
                            step="0.01"
                            min="0"
                            style={{
                              width: '90px',
                              padding: '8px 12px',
                              border: '1px solid #ced4da',
                              borderRadius: '6px',
                              fontSize: 'var(--font-size-medium)',
                              textAlign: 'center'
                            }}
                          />
                        </td>
                        <td style={{ padding: '16px', textAlign: 'center' }}>
                          <input
                            type="number"
                            value={editablePrices[roomType.name] || Math.round(basePrice * roomTypeCoefficients[roomType.name])}
                            onChange={(e) => {
                              const newEditablePrices = { ...editablePrices };
                              newEditablePrices[roomType.name] = parseFloat(e.target.value) || 0;
                              setEditablePrices(newEditablePrices);
                            }}
                            onBlur={(e) => handleBasePriceChange(roomType.name, e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleBasePriceChange(roomType.name, e.target.value);
                                e.target.blur();
                              }
                            }}
                            style={{
                              width: '100%',
                              padding: '8px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: 'var(--font-size-medium)',
                              textAlign: 'center'
                            }}
                          />
                        </td>
                        <td style={{ padding: '16px', textAlign: 'center' }}>
                          <input
                            type="number"
                            value={breakfast}
                            onChange={() => {
                              // Solo actualizar el valor local, no hacer cálculos
                              // Aquí podrías mantener un estado local temporal si fuera necesario
                            }}
                            onBlur={(e) => handleBreakfastPriceChange(roomType.name, e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleBreakfastPriceChange(roomType.name, e.target.value);
                                e.target.blur();
                              }
                            }}
                            min="0"
                            style={{
                              width: '120px',
                              padding: '8px 12px',
                              border: '1px solid #ced4da',
                              borderRadius: '6px',
                              fontSize: 'var(--font-size-medium)',
                              textAlign: 'center',
                              color: '#28a745',
                              fontWeight: '500'
                            }}
                          />
                        </td>
                        <td style={{ padding: '16px', textAlign: 'center' }}>
                          <input
                            type="number"
                            value={halfBoard}
                            onChange={() => {
                              // Solo actualizar el valor local, no hacer cálculos
                              // Aquí podrías mantener un estado local temporal si fuera necesario
                            }}
                            onBlur={(e) => handleHalfBoardPriceChange(roomType.name, e.target.value)}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleHalfBoardPriceChange(roomType.name, e.target.value);
                                e.target.blur();
                              }
                            }}
                            min="0"
                            style={{
                              width: '120px',
                              padding: '8px 12px',
                              border: '1px solid #ced4da',
                              borderRadius: '6px',
                              fontSize: 'var(--font-size-medium)',
                              textAlign: 'center',
                              color: '#dc3545',
                              fontWeight: '500'
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })
              : (
                  <tr>
                    <td colSpan="5" style={{ 
                      padding: '24px', 
                      textAlign: 'center', 
                      color: '#6c757d',
                      fontStyle: 'italic',
                      fontSize: 'var(--font-size-medium)'
                    }}>
                      Cargando tipos de habitación...
                    </td>
                  </tr>
                )
            }
          </tbody>
        </table>
      </div>
      
      {saving && (
        <div style={{ 
          marginTop: '16px', 
          textAlign: 'center', 
          color: '#6c757d', 
          fontSize: 'var(--font-size-medium)',
          fontWeight: '500'
        }}>
          Guardando cambios...
        </div>
      )}
    </div>
  );
} 