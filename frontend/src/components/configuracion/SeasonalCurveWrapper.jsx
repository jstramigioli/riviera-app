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
            value: k.basePrice
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
          basePrice: k.value
        };
      });

      // Eliminar keyframes existentes y crear los nuevos
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      await fetch(`${API_URL}/dynamic-pricing/keyframes/${hotelId}/all`, {
        method: 'DELETE'
      });

      // Crear los nuevos keyframes uno por uno
      for (const keyframe of backendKeyframes) {
        const response = await fetch(`${API_URL}/dynamic-pricing/keyframes/${hotelId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(keyframe)
        });
        if (!response.ok) {
          throw new Error(`Error al crear keyframe: ${response.status}`);
        }
      }

    } catch (error) {
      console.error('Error al guardar:', error);
      // La notificación se manejará desde el SeasonalCurveEditor
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