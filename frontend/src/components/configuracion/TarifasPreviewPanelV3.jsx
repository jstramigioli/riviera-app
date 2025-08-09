import React, { useState, useEffect } from 'react';
import { FiLock, FiUnlock } from 'react-icons/fi';

export default function TarifasPreviewPanelV3({ hotelId = "default-hotel" }) {
  console.log('TarifasPreviewPanelV3 - Componente iniciado con hotelId:', hotelId);
  
  // Estados principales
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [lockedMode, setLockedMode] = useState(false); // Nuevo estado para el modo bloqueado
  
  // Datos del sistema
  const [basePrice, setBasePrice] = useState(100000); // Precio por defecto
  const [roomTypes, setRoomTypes] = useState([]); // Inicialmente vacío, se cargará desde la API

  // Estados de edición - ahora cada tipo de habitación tiene sus propios precios
  const [roomPrices, setRoomPrices] = useState({});
  const [editingPrices, setEditingPrices] = useState({}); // Estado temporal para edición
  
  // Estados para gestión de tipos de tarifa
  const [rateTypes, setRateTypes] = useState([]);
  const [editingRateType, setEditingRateType] = useState(null);
  const [showAddRateModal, setShowAddRateModal] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    console.log('TarifasPreviewPanelV3 - useEffect loadInitialData ejecutándose');
    loadInitialData();
  }, [hotelId]);

  // Cargar precio base cuando cambia la fecha
  useEffect(() => {
    console.log('TarifasPreviewPanelV3 - useEffect loadBasePrice ejecutándose con fecha:', selectedDate);
    if (selectedDate) {
      loadBasePriceFromSeasonalCurve(selectedDate);
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

      // Cargar tipos de tarifa
      try {
        const rateTypesResponse = await fetch(`${API_URL}/rate-types/${hotelId}`);
        if (rateTypesResponse.ok) {
          const rateTypesData = await rateTypesResponse.json();
          if (Array.isArray(rateTypesData) && rateTypesData.length > 0) {
            setRateTypes(rateTypesData);
            console.log('Tipos de tarifa cargados:', rateTypesData.length);
          } else {
            console.warn('No hay tipos de tarifa configurados');
            setRateTypes([]);
          }
        } else {
          console.warn('No se pudieron cargar los tipos de tarifa');
          setRateTypes([]);
        }
      } catch (error) {
        console.warn('Error cargando tipos de tarifa:', error);
        setRateTypes([]);
      }

    } catch (error) {
      console.error('Error cargando datos iniciales:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBasePriceFromSeasonalCurve = async (date) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_URL}/dynamic-pricing/seasonal-curve/${hotelId}?date=${date}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.price) {
          setBasePrice(data.price);
          // Inicializar precios para todos los tipos de habitación
          initializeRoomPrices(data.price);
        } else {
          setBasePrice(100000);
          initializeRoomPrices(100000);
        }
      } else {
        console.warn('No se pudo cargar el precio base, usando valor por defecto');
        setBasePrice(100000);
        initializeRoomPrices(100000);
      }
    } catch (error) {
      console.error('Error cargando precio base:', error);
      setBasePrice(100000);
      initializeRoomPrices(100000);
    }
  };

  const initializeRoomPrices = (basePriceValue) => {
    const newRoomPrices = {};
    roomTypes.forEach(roomType => {
      const basePriceForType = basePriceValue;
      const breakfastPrice = calculateBreakfastPrice(basePriceForType);
      const halfBoardPrice = calculateHalfBoardPrice(basePriceForType);
      
      newRoomPrices[roomType.name] = {
        base: basePriceForType,
        breakfast: breakfastPrice,
        halfBoard: halfBoardPrice
      };
    });
    setRoomPrices(newRoomPrices);
  };

  // Calcular precio con desayuno (simplificado)
  const calculateBreakfastPrice = (basePriceForType) => {
    return basePriceForType + 15000; // $15,000 fijos por ahora
  };

  // Calcular precio con media pensión (simplificado)
  const calculateHalfBoardPrice = (basePriceForType) => {
    const breakfastPrice = calculateBreakfastPrice(basePriceForType);
    return breakfastPrice + 25000; // $25,000 fijos por ahora
  };

  // Manejadores de cambios
  const handlePriceInputChange = (roomTypeName, priceType, value) => {
    // Solo actualizar el estado temporal de edición
    const newEditingPrices = { ...editingPrices };
    if (!newEditingPrices[roomTypeName]) {
      newEditingPrices[roomTypeName] = {};
    }
    newEditingPrices[roomTypeName][priceType] = value;
    setEditingPrices(newEditingPrices);
  };

  const handlePriceConfirm = (roomTypeName, priceType, value) => {
    const newPrice = parseFloat(value) || 0;
    
    if (lockedMode) {
      // Modo bloqueado: mantener proporciones
      handleLockedPriceChange(roomTypeName, priceType, newPrice);
    } else {
      // Modo libre: cambiar solo el precio específico
      handleFreePriceChange(roomTypeName, priceType, newPrice);
    }
    
    // Limpiar el estado de edición temporal
    const newEditingPrices = { ...editingPrices };
    if (newEditingPrices[roomTypeName]) {
      delete newEditingPrices[roomTypeName][priceType];
      if (Object.keys(newEditingPrices[roomTypeName]).length === 0) {
        delete newEditingPrices[roomTypeName];
      }
    }
    setEditingPrices(newEditingPrices);
  };

  const handleFreePriceChange = (roomTypeName, priceType, newPrice) => {
    const newRoomPrices = { ...roomPrices };
    
    if (!newRoomPrices[roomTypeName]) {
      newRoomPrices[roomTypeName] = {
        base: basePrice,
        breakfast: calculateBreakfastPrice(basePrice),
        halfBoard: calculateHalfBoardPrice(basePrice)
      };
    }
    
    newRoomPrices[roomTypeName][priceType] = newPrice;
    setRoomPrices(newRoomPrices);
  };

  const handleLockedPriceChange = (roomTypeName, priceType, newPrice) => {
    const newRoomPrices = { ...roomPrices };
    
    // Obtener el precio actual del tipo de habitación que se está modificando
    const currentPrices = roomPrices[roomTypeName] || {
      base: basePrice,
      breakfast: basePrice,
      halfBoard: basePrice
    };
    
    // Calcular el factor de cambio basado en el precio modificado
    let changeFactor;
    if (priceType === 'base') {
      changeFactor = newPrice / currentPrices.base;
    } else if (priceType === 'breakfast') {
      changeFactor = newPrice / currentPrices.breakfast;
    } else if (priceType === 'halfBoard') {
      changeFactor = newPrice / currentPrices.halfBoard;
    }
    
    // Aplicar el mismo factor de cambio a todos los tipos de habitación
    roomTypes.forEach(roomType => {
      const currentRoomPrices = roomPrices[roomType.name] || {
        base: basePrice,
        breakfast: basePrice,
        halfBoard: basePrice
      };
      
      newRoomPrices[roomType.name] = {
        base: Math.round(currentRoomPrices.base * changeFactor),
        breakfast: Math.round(currentRoomPrices.breakfast * changeFactor),
        halfBoard: Math.round(currentRoomPrices.halfBoard * changeFactor)
      };
    });
    
    setRoomPrices(newRoomPrices);
  };

  const toggleLockedMode = () => {
    setLockedMode(!lockedMode);
  };

  // Funciones para gestión de tipos de tarifa
  const addRateType = async (rateType) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_URL}/rate-types/${hotelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rateType)
      });
      
      if (response.ok) {
        const newRateType = await response.json();
        setRateTypes([...rateTypes, newRateType]);
        setShowAddRateModal(false);
        console.log('Tipo de tarifa agregado exitosamente');
      } else {
        console.error('Error agregando tipo de tarifa');
      }
    } catch (error) {
      console.error('Error agregando tipo de tarifa:', error);
    }
  };

  const updateRateType = async (id, updatedRateType) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_URL}/rate-types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedRateType)
      });
      
      if (response.ok) {
        const updatedRateTypeData = await response.json();
        setRateTypes(rateTypes.map(rt => 
          rt.id === id ? updatedRateTypeData : rt
        ));
        setEditingRateType(null);
        console.log('Tipo de tarifa actualizado exitosamente');
      } else {
        console.error('Error actualizando tipo de tarifa');
      }
    } catch (error) {
      console.error('Error actualizando tipo de tarifa:', error);
    }
  };

  const deleteRateType = async (id) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_URL}/rate-types/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setRateTypes(rateTypes.filter(rt => rt.id !== id));
        console.log('Tipo de tarifa eliminado exitosamente');
      } else {
        console.error('Error eliminando tipo de tarifa');
      }
    } catch (error) {
      console.error('Error eliminando tipo de tarifa:', error);
    }
  };

  const calculateRatePrice = (basePrice, rateType) => {
    if (rateType.mode === 'FIXED') {
      return basePrice + rateType.value;
    } else {
      return Math.round(basePrice * (1 + rateType.value / 100));
    }
  };



  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontSize: 'var(--font-size-medium)' }}>
        Cargando previsualización de tarifas...
      </div>
    );
  }

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

      {/* Selector de fecha y botón de bloqueo */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px' 
      }}>
        <div>
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
        
        <button
          onClick={toggleLockedMode}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            backgroundColor: lockedMode ? '#28a745' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: 'var(--font-size-medium)',
            fontWeight: '500'
          }}
        >
          {lockedMode ? <FiLock /> : <FiUnlock />}
          {lockedMode ? 'Proporciones Bloqueadas' : 'Proporciones Libres'}
        </button>
      </div>



      {/* Gestión de tipos de tarifa */}
      <div style={{ 
        marginBottom: '20px', 
        padding: '15px', 
        backgroundColor: 'white', 
        borderRadius: '6px',
        border: '1px solid #dee2e6'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '15px' 
        }}>
          <h4 style={{ 
            color: '#495057',
            fontSize: 'var(--font-size-medium)',
            fontWeight: '600',
            margin: 0
          }}>
            Tipos de Tarifa
          </h4>
          <button
            onClick={() => setShowAddRateModal(true)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: 'var(--font-size-small)',
              fontWeight: '500'
            }}
          >
            + Agregar Tarifa
          </button>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {rateTypes.map(rateType => (
            <div key={rateType.id} style={{
              padding: '8px 12px',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              border: '1px solid #dee2e6',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: 'var(--font-size-small)'
            }}>
              <span style={{ fontWeight: '500' }}>{rateType.name}</span>
              <span style={{ color: '#6c757d' }}>
                {rateType.mode === 'FIXED' ? '$' : '%'}{rateType.value}
              </span>
              <button
                onClick={() => setEditingRateType(rateType)}
                style={{
                  padding: '2px 6px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  fontSize: '10px'
                }}
              >
                Editar
              </button>
              <button
                onClick={() => deleteRateType(rateType.id)}
                style={{
                  padding: '2px 6px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  fontSize: '10px'
                }}
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
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
                Precio Base
              </th>
              {rateTypes.map(rateType => (
                <th key={rateType.id} style={{ 
                  padding: '16px', 
                  textAlign: 'center', 
                  fontWeight: '600',
                  fontSize: 'var(--font-size-medium)'
                }}>
                  {rateType.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roomTypes && roomTypes.length > 0 ? roomTypes.map((roomType) => {
              const currentPrices = roomPrices[roomType.name] || {
                base: basePrice,
                ...rateTypes.reduce((acc, rateType) => {
                  acc[rateType.id] = calculateRatePrice(basePrice, rateType);
                  return acc;
                }, {})
              };
              
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
                      value={editingPrices[roomType.name]?.base !== undefined ? 
                        editingPrices[roomType.name].base : 
                        currentPrices.base}
                      onChange={(e) => handlePriceInputChange(roomType.name, 'base', e.target.value)}
                      onBlur={(e) => handlePriceConfirm(roomType.name, 'base', e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handlePriceConfirm(roomType.name, 'base', e.target.value);
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
                  {rateTypes.map(rateType => (
                    <td key={rateType.id} style={{ padding: '16px', textAlign: 'center' }}>
                      <input
                        type="number"
                        value={editingPrices[roomType.name]?.[rateType.id] !== undefined ? 
                          editingPrices[roomType.name][rateType.id] : 
                          currentPrices[rateType.id]}
                        onChange={(e) => handlePriceInputChange(roomType.name, rateType.id, e.target.value)}
                        onBlur={(e) => handlePriceConfirm(roomType.name, rateType.id, e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handlePriceConfirm(roomType.name, rateType.id, e.target.value);
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
                  ))}
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={rateTypes.length + 2} style={{ 
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

      {/* Información del modo */}
      <div style={{ 
        marginTop: '15px', 
        padding: '10px', 
        backgroundColor: lockedMode ? '#d4edda' : '#fff3cd', 
        borderRadius: '4px',
        fontSize: 'var(--font-size-small)',
        color: lockedMode ? '#155724' : '#856404'
      }}>
        <strong>Modo actual:</strong> {lockedMode ? 
          'Proporciones bloqueadas - Los cambios mantienen las proporciones entre tipos de habitación' : 
          'Proporciones libres - Cada precio se edita independientemente'
        }
      </div>

      {/* Modal para agregar/editar tipo de tarifa */}
      {(showAddRateModal || editingRateType) && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            minWidth: '400px',
            maxWidth: '500px'
          }}>
            <h3 style={{
              marginBottom: '20px',
              color: '#495057',
              fontSize: 'var(--font-size-large)',
              fontWeight: '600'
            }}>
              {editingRateType ? 'Editar Tarifa' : 'Agregar Tarifa'}
            </h3>
            
            <RateTypeForm
              rateType={editingRateType}
              onSubmit={editingRateType ? 
                (data) => updateRateType(editingRateType.id, data) : 
                addRateType}
              onCancel={() => {
                setShowAddRateModal(false);
                setEditingRateType(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Componente para el formulario de tipo de tarifa
function RateTypeForm({ rateType, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: rateType?.name || '',
    value: rateType?.value || 0,
    mode: rateType?.mode || 'FIXED'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.name.trim() && formData.value > 0) {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontWeight: '500',
          fontSize: 'var(--font-size-medium)',
          color: '#495057'
        }}>
          Nombre de la Tarifa:
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            fontSize: 'var(--font-size-medium)'
          }}
          placeholder="Ej: Con Desayuno"
        />
      </div>
      
      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontWeight: '500',
          fontSize: 'var(--font-size-medium)',
          color: '#495057'
        }}>
          Modo:
        </label>
        <select
          value={formData.mode}
          onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            fontSize: 'var(--font-size-medium)'
          }}
        >
          <option value="FIXED">Monto Fijo</option>
          <option value="PERCENTAGE">Porcentaje</option>
        </select>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <label style={{
          display: 'block',
          marginBottom: '8px',
          fontWeight: '500',
          fontSize: 'var(--font-size-medium)',
          color: '#495057'
        }}>
          Valor:
        </label>
        <input
          type="number"
          value={formData.value}
          onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
          min="0"
          step={formData.mode === 'PERCENTAGE' ? '0.1' : '1'}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            fontSize: 'var(--font-size-medium)'
          }}
          placeholder={formData.mode === 'FIXED' ? '15000' : '15'}
        />
        <small style={{ color: '#6c757d', fontSize: 'var(--font-size-small)' }}>
          {formData.mode === 'FIXED' ? 'Monto en pesos' : 'Porcentaje (ej: 15 = 15%)'}
        </small>
      </div>
      
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '8px 16px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: 'var(--font-size-medium)'
          }}
        >
          Cancelar
        </button>
        <button
          type="submit"
          style={{
            padding: '8px 16px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: 'var(--font-size-medium)'
          }}
        >
          {rateType ? 'Actualizar' : 'Agregar'}
        </button>
      </div>
    </form>
  );
} 