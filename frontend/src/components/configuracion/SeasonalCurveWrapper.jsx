import React, { useEffect, useState } from 'react';
import SeasonalCurveEditor from './SeasonalCurveEditor';

export default function SeasonalCurveWrapper({ hotelId = "default-hotel" }) {
  const [keyframes, setKeyframes] = useState([
    { date: '2024-01-15', value: 8000 },
    { date: '2024-02-15', value: 7500 },
    { date: '2024-03-15', value: 7000 },
    { date: '2024-04-15', value: 6500 },
    { date: '2024-05-15', value: 6000 },
    { date: '2024-06-15', value: 5500 },
    { date: '2024-07-15', value: 6000 },
    { date: '2024-08-15', value: 6500 },
    { date: '2024-09-15', value: 7000 },
    { date: '2024-10-15', value: 7500 },
    { date: '2024-11-15', value: 8000 },
    { date: '2024-12-15', value: 8500 }
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Cargar keyframes desde el backend
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    fetch(`${API_URL}/dynamic-pricing/keyframes/${hotelId}`)
      .then((res) => {
        return res.json();
      })
      .then((data) => {
        // Solo actualizar si hay datos del backend
        if (data && data.length > 0) {
          // Convertir el formato del backend al formato del editor
          const formattedKeyframes = data.map(k => ({
            date: new Date(k.date).toISOString().slice(0, 10),
            value: k.basePrice,
            // Preservar propiedades operacionales
            isOperational: k.isOperational || false,
            operationalType: k.operationalType || null,
            periodId: k.periodId || null,
            id: k.id // Preservar el ID original
          }));
          setKeyframes(formattedKeyframes);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [hotelId]);

  const handleKeyframesChange = (newKeyframes) => {
    // Validar que no haya duplicados antes de actualizar el estado
    const uniqueKeyframes = [];
    const seenDates = new Set();
    
    for (const keyframe of newKeyframes) {
      const dateString = keyframe.date.slice(0, 10); // YYYY-MM-DD
      if (!seenDates.has(dateString)) {
        seenDates.add(dateString);
        uniqueKeyframes.push(keyframe);
      }
    }
    
    setKeyframes(uniqueKeyframes);
  };

  const handleSave = async () => {
    try {
      console.log('🔍 Iniciando guardado de keyframes...');
      
      // Convertir al formato del backend y guardar
      const backendKeyframes = keyframes.map(k => {
        const dateStr = k.date;
        
        // Validar que la fecha sea válida
        if (!dateStr) {
          throw new Error(`Fecha vacía: ${dateStr}`);
        }
        
        // Intentar crear la fecha
        const dateObj = new Date(dateStr + 'T00:00:00.000Z');
        if (isNaN(dateObj.getTime())) {
          throw new Error(`Fecha inválida: ${dateStr}`);
        }
        
        const isoDate = dateObj.toISOString();
        
        return {
          date: isoDate,
          basePrice: k.value,
          // Preservar propiedades operacionales si existen
          isOperational: k.isOperational || false,
          operationalType: k.operationalType || null,
          periodId: k.periodId || null,
          id: k.id // Preservar el ID original si existe
        };
      });

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      
      console.log('🔍 Keyframes a guardar:', backendKeyframes.length);
      
      // Obtener keyframes operacionales existentes para preservarlos
      const existingKeyframesResponse = await fetch(`${API_URL}/dynamic-pricing/keyframes/${hotelId}`);
      if (!existingKeyframesResponse.ok) {
        throw new Error(`Error al obtener keyframes existentes: ${existingKeyframesResponse.status}`);
      }
      
      const existingKeyframes = await existingKeyframesResponse.json();
      const operationalKeyframes = existingKeyframes.filter(k => k.isOperational);
      const normalKeyframes = existingKeyframes.filter(k => !k.isOperational);
      
      console.log('🔍 Keyframes operacionales existentes:', operationalKeyframes.length);
      console.log('🔍 Keyframes normales existentes:', normalKeyframes.length);

      // Eliminar solo keyframes NO operacionales
      const deleteResponse = await fetch(`${API_URL}/dynamic-pricing/keyframes/${hotelId}/all`, {
        method: 'DELETE'
      });
      
      if (!deleteResponse.ok) {
        throw new Error(`Error al eliminar keyframes: ${deleteResponse.status}`);
      }
      
      console.log('🔍 Keyframes normales eliminados');

      // Crear los nuevos keyframes normales uno por uno
      const newNormalKeyframes = backendKeyframes.filter(k => !k.isOperational);
      console.log('🔍 Creando', newNormalKeyframes.length, 'keyframes normales');
      
      for (const keyframe of newNormalKeyframes) {
        const response = await fetch(`${API_URL}/dynamic-pricing/keyframes/${hotelId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(keyframe)
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Error al crear keyframe: ${response.status} - ${errorData.message || 'Error desconocido'}`);
        }
      }

      // Recrear los keyframes operacionales si es necesario
      console.log('🔍 Recreando', operationalKeyframes.length, 'keyframes operacionales');
      
      for (const operationalKeyframe of operationalKeyframes) {
        const response = await fetch(`${API_URL}/dynamic-pricing/keyframes/${hotelId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: operationalKeyframe.date,
            basePrice: operationalKeyframe.basePrice,
            isOperational: true,
            operationalType: operationalKeyframe.operationalType,
            periodId: operationalKeyframe.periodId
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Error al recrear keyframe operacional: ${response.status} - ${errorData.message || 'Error desconocido'}`);
        }
      }

      console.log('🔍 Guardado completado exitosamente');
      
    } catch (error) {
      console.error('❌ Error al guardar:', error);
      throw error; // Re-lanzar el error para que el SeasonalCurveEditor lo maneje
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        Cargando curva estacional...
      </div>
    );
  }

  return (
    <SeasonalCurveEditor 
      keyframes={keyframes}
      onChange={handleKeyframesChange}
      onSave={handleSave}
      hotelId={hotelId}
    />
  );
} 