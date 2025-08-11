import React, { useState, useEffect } from 'react';

export default function TarifasPreviewPanelV2({ hotelId = "default-hotel" }) {
  console.log('TarifasPreviewPanelV2 - Componente iniciado con hotelId:', hotelId);
  
  // Estados principales
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Datos del sistema
  const [basePrice, setBasePrice] = useState(100000); // Precio por defecto
  const [roomTypes, setRoomTypes] = useState([]); // Inicialmente vacío, se cargará desde la API
  const [coefficients, setCoefficients] = useState({}); // Inicialmente vacío, se cargará desde la API
  const [mealRules, setMealRules] = useState({
    breakfastMode: 'FIXED',
    breakfastValue: 15000,
    dinnerMode: 'FIXED', 
    dinnerValue: 25000
  });

  // Estados de edición
  const [editingBasePrices, setEditingBasePrices] = useState({});
  const [editingBreakfastPrices, setEditingBreakfastPrices] = useState({});
  const [editingHalfBoardPrices, setEditingHalfBoardPrices] = useState({});

  // Cargar datos iniciales
  useEffect(() => {
    console.log('TarifasPreviewPanelV2 - useEffect loadInitialData ejecutándose');
    loadInitialData();
  }, [hotelId]);

  // Cargar precio base cuando cambia la fecha
  useEffect(() => {
    console.log('TarifasPreviewPanelV2 - useEffect loadBasePrice ejecutándose con fecha:', selectedDate);
    if (selectedDate) {
      loadBasePriceFromSeasonBlocks(selectedDate);
    }
  }, [selectedDate]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      
      // Cargar tipos de habitación
      try {
        const roomTypesResponse = await fetch(`${API_URL}/room-types/${hotelId}`);
        if (roomTypesResponse.ok) {
          const roomTypesData = await roomTypesResponse.json();
          if (Array.isArray(roomTypesData) && roomTypesData.length > 0) {
            setRoomTypes(roomTypesData);
            console.log('Tipos de habitación cargados:', roomTypesData.length);
          } else {
            console.warn('Los datos de tipos de habitación están vacíos');
            setRoomTypes([]);
          }
        } else {
          console.warn('No se pudieron cargar los tipos de habitación');
          setRoomTypes([]);
        }
      } catch (error) {
        console.warn('Error cargando tipos de habitación:', error);
        setRoomTypes([]);
      }

      // Los coeficientes ya no se usan en el nuevo sistema
      setCoefficients({});

      // Cargar reglas de comidas
      try {
        const mealRulesResponse = await fetch(`${API_URL}/dynamic-pricing/meals/${hotelId}`);
        if (mealRulesResponse.ok) {
          const mealRulesData = await mealRulesResponse.json();
          if (mealRulesData && mealRulesData.breakfastMode && mealRulesData.dinnerMode) {
            setMealRules(mealRulesData);
          } else {
            console.warn('Los datos de reglas de comidas están incompletos, usando valores por defecto');
            // No cambiar mealRules, mantener los datos por defecto
          }
        } else {
          console.warn('No se pudieron cargar las reglas de comidas, usando valores por defecto');
          // No cambiar mealRules, mantener los datos por defecto
        }
      } catch (error) {
        console.warn('Error cargando reglas de comidas:', error);
        // No cambiar mealRules, mantener los datos por defecto
      }

    } catch (error) {
      console.error('Error cargando datos iniciales:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBasePriceFromSeasonBlocks = async (date) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_URL}/dynamic-pricing/seasonal-curve/${hotelId}?date=${date}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.price) {
          setBasePrice(data.price);
        } else {
          // Usar precio por defecto si no hay datos
          setBasePrice(100000);
        }
      } else {
        console.warn('No se pudo cargar el precio base, usando valor por defecto');
        setBasePrice(100000);
      }
    } catch (error) {
      console.error('Error cargando precio base:', error);
      setBasePrice(100000);
    }
  };

  // Calcular precios base por tipo de habitación (sin coeficientes)
  const calculateBasePriceForType = () => {
    return basePrice;
  };

  // Calcular precio con desayuno
  const calculateBreakfastPrice = (basePriceForType) => {
    if (mealRules.breakfastMode === 'FIXED') {
      return basePriceForType + mealRules.breakfastValue;
    } else {
      return Math.round(basePriceForType * (1 + mealRules.breakfastValue));
    }
  };

  // Calcular precio con media pensión
  const calculateHalfBoardPrice = (basePriceForType) => {
    const breakfastPrice = calculateBreakfastPrice(basePriceForType);
    
    if (mealRules.dinnerMode === 'FIXED') {
      return breakfastPrice + mealRules.dinnerValue;
    } else {
      return Math.round(breakfastPrice * (1 + mealRules.dinnerValue));
    }
  };

  // Manejadores de cambios
  const handleBasePriceChange = (_, value) => {
    const newPrice = parseFloat(value) || 0;
    
    // Usar el precio directamente (sin coeficientes)
    setBasePrice(newPrice);
    
    // Limpiar estados de edición
    setEditingBasePrices({});
    setEditingBreakfastPrices({});
    setEditingHalfBoardPrices({});
  };

  const handleBreakfastPriceChange = (_, value) => {
    const newBreakfastPrice = parseFloat(value) || 0;
    
    // Calcular nuevo precio base basado en el precio de desayuno deseado
    let newBasePrice;
    if (mealRules.breakfastMode === 'FIXED') {
      newBasePrice = newBreakfastPrice - mealRules.breakfastValue;
    } else {
      newBasePrice = newBreakfastPrice / (1 + mealRules.breakfastValue);
    }
    
    setBasePrice(newBasePrice);
    
    // Limpiar estados de edición
    setEditingBasePrices({});
    setEditingBreakfastPrices({});
    setEditingHalfBoardPrices({});
  };

  const handleHalfBoardPriceChange = (_, value) => {
    const newHalfBoardPrice = parseFloat(value) || 0;
    
    // Calcular el precio base que resulte en el precio de media pensión deseado
    let newBasePrice;
    if (mealRules.dinnerMode === 'FIXED') {
      // Para modo FIXED, necesitamos calcular hacia atrás desde el precio de media pensión
      const breakfastPrice = newHalfBoardPrice - mealRules.dinnerValue;
      if (mealRules.breakfastMode === 'FIXED') {
        newBasePrice = breakfastPrice - mealRules.breakfastValue;
      } else {
        newBasePrice = breakfastPrice / (1 + mealRules.breakfastValue);
      }
    } else {
      // Para modo PERCENTAGE, calculamos hacia atrás desde el precio de media pensión
      const breakfastPrice = newHalfBoardPrice / (1 + mealRules.dinnerValue);
      if (mealRules.breakfastMode === 'FIXED') {
        newBasePrice = breakfastPrice - mealRules.breakfastValue;
      } else {
        newBasePrice = breakfastPrice / (1 + mealRules.breakfastValue);
      }
    }
    
    setBasePrice(newBasePrice);
    
    // Limpiar estados de edición
    setEditingBasePrices({});
    setEditingBreakfastPrices({});
    setEditingHalfBoardPrices({});
  };



  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontSize: 'var(--font-size-medium)' }}>
        Cargando previsualización de tarifas...
      </div>
    );
  }

  // Debug logs
  console.log('TarifasPreviewPanelV2 - roomTypes:', roomTypes);
  console.log('TarifasPreviewPanelV2 - coefficients:', coefficients);
  console.log('TarifasPreviewPanelV2 - basePrice:', basePrice);
  console.log('TarifasPreviewPanelV2 - mealRules:', mealRules);

  return (
    <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', margin: '20px 0' }}>
      <h3 style={{ 
        marginBottom: '20px', 
        color: '#495057', 
        fontSize: 'var(--font-size-large)',
        fontWeight: '600'
      }}>
        Previsualización de Tarifas
      </h3>

      {/* Debug info */}
      <div style={{ 
        marginBottom: '10px', 
        padding: '10px', 
        backgroundColor: '#fff3cd', 
        borderRadius: '4px',
        fontSize: 'var(--font-size-small)',
        color: '#856404'
      }}>
        Debug: {roomTypes.length} tipos de habitación cargados desde la base de datos
        {roomTypes.length > 0 && (
          <div style={{ marginTop: '5px' }}>
            Tipos: {roomTypes.map(rt => rt.name).join(', ')}
          </div>
        )}
      </div>

      {/* Selector de fecha */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ 
          display: 'block', 
          marginBottom: '8px', 
          fontWeight: '500',
          fontSize: 'var(--font-size-medium)',
          color: '#495057'
        }}>
          Fecha:
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid #ced4da',
            borderRadius: '6px',
            fontSize: 'var(--font-size-medium)',
            width: '200px'
          }}
        />
      </div>

      {/* Información del precio base */}
      <div style={{ 
        marginBottom: '20px', 
        padding: '15px', 
        backgroundColor: '#e9ecef', 
        borderRadius: '6px',
        fontSize: 'var(--font-size-medium)'
      }}>
        <strong>Precio Base Global:</strong> ${basePrice.toLocaleString()}
        {basePrice === 100000 && (
          <div style={{ 
            marginTop: '8px', 
            fontSize: 'var(--font-size-small)', 
            color: '#6c757d',
            fontStyle: 'italic'
          }}>
            (Usando precio por defecto - no se pudo cargar desde el servidor)
          </div>
        )}
      </div>

      {/* Tabla de tarifas */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse', 
          backgroundColor: 'white',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#495057', color: 'white' }}>
              <th style={{ 
                padding: '16px', 
                textAlign: 'center', 
                fontWeight: '600',
                fontSize: 'var(--font-size-medium)'
              }}>
                Tipo de Habitación
              </th>
              <th style={{ 
                padding: '16px', 
                textAlign: 'center', 
                fontWeight: '600',
                fontSize: 'var(--font-size-medium)'
              }}>
                Coeficiente
              </th>
              <th style={{ 
                padding: '16px', 
                textAlign: 'center', 
                fontWeight: '600',
                fontSize: 'var(--font-size-medium)'
              }}>
                Precio Base
              </th>
              <th style={{ 
                padding: '16px', 
                textAlign: 'center', 
                fontWeight: '600',
                fontSize: 'var(--font-size-medium)'
              }}>
                Con Desayuno
              </th>
              <th style={{ 
                padding: '16px', 
                textAlign: 'center', 
                fontWeight: '600',
                fontSize: 'var(--font-size-medium)'
              }}>
                Con Media Pensión
              </th>
            </tr>
          </thead>
          <tbody>
            {roomTypes && roomTypes.length > 0 ? roomTypes.map((roomType) => {
              const basePriceForType = calculateBasePriceForType();
              const breakfastPrice = calculateBreakfastPrice(basePriceForType);
              const halfBoardPrice = calculateHalfBoardPrice(basePriceForType);
              
              console.log(`Rendering roomType: ${roomType.name}, basePrice: ${basePriceForType}, breakfast: ${breakfastPrice}, halfBoard: ${halfBoardPrice}`);
              
              return (
                <tr key={roomType.id} style={{ borderBottom: '1px solid #e9ecef' }}>
                  <td style={{ 
                    padding: '16px', 
                    textAlign: 'center', 
                    fontWeight: '500',
                    fontSize: 'var(--font-size-medium)',
                    color: '#495057'
                  }}>
                    {roomType.name}
                  </td>

                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    <input
                      type="number"
                      value={editingBasePrices[roomType.name] !== undefined 
                        ? editingBasePrices[roomType.name] 
                        : basePriceForType}
                      onChange={(e) => {
                        const newEditingPrices = { ...editingBasePrices };
                        newEditingPrices[roomType.name] = parseFloat(e.target.value) || 0;
                        setEditingBasePrices(newEditingPrices);
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
                      value={editingBreakfastPrices[roomType.name] !== undefined 
                        ? editingBreakfastPrices[roomType.name] 
                        : breakfastPrice}
                      onChange={(e) => {
                        const newEditingPrices = { ...editingBreakfastPrices };
                        newEditingPrices[roomType.name] = parseFloat(e.target.value) || 0;
                        setEditingBreakfastPrices(newEditingPrices);
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
                      value={editingHalfBoardPrices[roomType.name] !== undefined 
                        ? editingHalfBoardPrices[roomType.name] 
                        : halfBoardPrice}
                      onChange={(e) => {
                        const newEditingPrices = { ...editingHalfBoardPrices };
                        newEditingPrices[roomType.name] = parseFloat(e.target.value) || 0;
                        setEditingHalfBoardPrices(newEditingPrices);
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
            }) : (
              <tr>
                <td colSpan="5" style={{ 
                  padding: '20px', 
                  textAlign: 'center', 
                  color: '#6c757d',
                  fontSize: 'var(--font-size-medium)'
                }}>
                  No hay tipos de habitación disponibles
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>


    </div>
  );
} 