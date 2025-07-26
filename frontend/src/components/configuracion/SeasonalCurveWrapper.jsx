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
    console.log('Cargando keyframes para hotel:', hotelId);
    // Cargar keyframes desde el backend
    fetch(`/api/dynamic-pricing/keyframes/${hotelId}`)
      .then((res) => {
        console.log('Respuesta del fetch:', res.status)
        return res.json();
      })
      .then((data) => {
        console.log('Datos recibidos:', data);
        // Solo actualizar si hay datos del backend
        if (data && data.length > 0) {
          // Convertir el formato del backend al formato del editor
          const formattedKeyframes = data.map(k => ({
            date: new Date(k.date).toISOString().slice(0, 10),
            value: k.basePrice
          }));
          console.log('Keyframes formateados:', formattedKeyframes);
          setKeyframes(formattedKeyframes);
        } else {
          console.log('No hay datos del backend, manteniendo valores por defecto');
        }
        setLoading(false);
      })
      
      .catch((error) => {
        console.log('Error al cargar keyframes, manteniendo valores por defecto:', error);
        setLoading(false);
      });
  }, [hotelId]);

  const handleKeyframesChange = (newKeyframes) => {
    setKeyframes(newKeyframes);
  };

  const handleSave = async () => {
    try {
      console.log('Iniciando guardado...');
      console.log('Keyframes a guardar:', keyframes);
      
      // Convertir al formato del backend y guardar
      const backendKeyframes = keyframes.map(k => {
        console.log('Procesando keyframe:', k);
        const dateStr = k.date;
        console.log('Fecha original:', dateStr);
        
        // Validar que la fecha sea válida
        if (!dateStr) {
          console.error('Fecha vacía:', dateStr);
          throw new Error(`Fecha vacía: ${dateStr}`);
        }
        
        // Intentar crear la fecha
        const dateObj = new Date(dateStr + 'T00:00:00.000Z');
        if (isNaN(dateObj.getTime())) {
          console.error('Fecha inválida:', dateStr);
          throw new Error(`Fecha inválida: ${dateStr}`);
        }
        
        const isoDate = dateObj.toISOString();
        console.log('Fecha ISO:', isoDate);
        
        return {
          date: isoDate,
          basePrice: k.value
        };
      });

      console.log('Formato backend:', backendKeyframes);

      // Eliminar keyframes existentes y crear los nuevos
      console.log('Eliminando keyframes existentes...');
      const deleteResponse = await fetch(`/api/dynamic-pricing/keyframes/${hotelId}/all`, {
        method: 'DELETE'
      });
      console.log('Respuesta DELETE:', deleteResponse.status);

      // Crear los nuevos keyframes uno por uno
      console.log('Creando nuevos keyframes...');
      for (const keyframe of backendKeyframes) {
        console.log('Creando keyframe:', keyframe);
        const response = await fetch(`/api/dynamic-pricing/keyframes/${hotelId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(keyframe)
        });
        console.log('Respuesta POST:', response.status);
        if (!response.ok) {
          throw new Error(`Error al crear keyframe: ${response.status}`);
        }
      }

      console.log('Guardado completado');
      alert('Curva estacional guardada exitosamente');
    } catch (error) {
      console.error('Error al guardar:', error);
      alert('Error al guardar la curva estacional');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        Cargando curva estacional...
      </div>
    );
  }

  console.log('Renderizando SeasonalCurveEditor con keyframes:', keyframes, 'loading:', loading);
  return (
    <SeasonalCurveEditor 
      keyframes={keyframes}
      onChange={handleKeyframesChange}
      onSave={handleSave}
    />
  );
} 