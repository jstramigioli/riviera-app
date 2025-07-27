import React, { useRef, useState, useEffect } from "react";

// Coeficientes por defecto para tipos de habitación
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

const priceTypeOptions = [
  { value: 'base', label: 'Precio Base' },
  { value: 'breakfast', label: 'Con Desayuno' },
  { value: 'halfBoard', label: 'Media Pensión' }
];

const zoomLevels = [
  { value: 'month', label: 'Mes' },
  { value: 'quarter', label: '3 Meses' }
];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function getMonthName(date) {
  const months = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ];
  return months[date.getMonth()];
}

export default function SeasonalCurveEditor({ keyframes = [], onChange, onSave, hotelId = "default-hotel" }) {
  const [dragIdx, setDragIdx] = useState(null);
  const [editingPoint, setEditingPoint] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedRoomType, setSelectedRoomType] = useState('doble');
  const [selectedPriceType, setSelectedPriceType] = useState('base');
  const [roomTypeCoefficients, setRoomTypeCoefficients] = useState(defaultRoomTypeCoefficients);
  const [zoomLevel, setZoomLevel] = useState('month');
  const [lastSavedKeyframes, setLastSavedKeyframes] = useState([]);
  const [currentPeriod, setCurrentPeriod] = useState(new Date());
  const [mealRules, setMealRules] = useState({
    breakfastMode: "PERCENTAGE",
    breakfastValue: 0.15,
    dinnerMode: "PERCENTAGE",
    dinnerValue: 0.2,
  });
  const [tooltip, setTooltip] = useState({ 
    show: false, 
    x: 0, 
    y: 0, 
    price: 0, 
    date: '', 
    snapX: 0, 
    snapY: 0, 
    snapDate: null 
  });
  const svgRef = useRef();
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [hoveredKeyframe, setHoveredKeyframe] = useState(null);

  // Ordenar keyframes por fecha
  const sorted = [...keyframes].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Función para obtener el rango de fechas basado en el período actual
  const getDateRange = () => {
    const period = currentPeriod;
    
    switch (zoomLevel) {
      case 'month': {
        const monthStart = new Date(period.getFullYear(), period.getMonth(), 1);
        const monthEnd = new Date(period.getFullYear(), period.getMonth() + 1, 0);
        return { minDate: monthStart, maxDate: monthEnd };
      }
      case 'quarter': {
        const quarterStart = new Date(period.getFullYear(), period.getMonth() - 1, 1);
        const quarterEnd = new Date(period.getFullYear(), period.getMonth() + 2, 0);
        return { minDate: quarterStart, maxDate: quarterEnd };
      }
      default: {
        const minDate = new Date(sorted[0]?.date || period);
        const maxDate = new Date(sorted[sorted.length - 1]?.date || period);
        return { minDate, maxDate };
      }
    }
  };

  // Obtener el rango de fechas actual
  const { minDate, maxDate } = getDateRange();
  
  // Calcular valores mínimos y máximos considerando el tipo de habitación y precio seleccionado
  const calculateAdjustedValue = (baseValue) => {
    const basePriceForType = Math.round(baseValue * roomTypeCoefficients[selectedRoomType]);
    
    switch (selectedPriceType) {
      case 'breakfast':
        return Math.round(basePriceForType * 1.15);
      case 'halfBoard':
        return Math.round(basePriceForType * 1.35);
      default:
        return basePriceForType;
    }
  };
  
  const adjustedValues = sorted.map(k => calculateAdjustedValue(k.value));
  const minValue = Math.min(...adjustedValues);
  const maxValue = Math.max(...adjustedValues);
  


  // Función helper para normalizar fechas a formato YYYY-MM-DD
  const normalizeDate = (date) => {
    if (typeof date === 'string') {
      return date.slice(0, 10); // Ya está en formato YYYY-MM-DD
    }
    return date.toISOString().slice(0, 10);
  };

  // Función para mostrar notificación
  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: 'success' });
    }, 3000);
  };

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

  // Guardar automáticamente cuando cambian los keyframes (solo si no estamos editando)
  useEffect(() => {
    if (sorted.length > 0 && lastSavedKeyframes.length === 0) {
      // Inicializar lastSavedKeyframes con los keyframes actuales
      setLastSavedKeyframes(sorted);
    } else if (sorted.length > 0 && !showAddModal && !editingPoint) {
      // Verificar si hay cambios reales y no estamos en modo edición
      const currentKeyframesStr = JSON.stringify(sorted);
      const lastSavedStr = JSON.stringify(lastSavedKeyframes);
      
      if (currentKeyframesStr !== lastSavedStr) {
        // Usar setTimeout para evitar múltiples guardados durante el drag
        const timeoutId = setTimeout(() => {
          setLastSavedKeyframes(sorted);
          onSave();
          showNotification('Curva guardada automáticamente');
        }, 1000); // Esperar 1 segundo después del último cambio
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [sorted, lastSavedKeyframes, onSave, showAddModal, editingPoint, showNotification]);
  
  if (sorted.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>No hay puntos de referencia configurados</p>
        <button 
          onClick={() => setShowAddModal(true)}
          style={{
            padding: '8px 16px',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Agregar primer punto
        </button>
      </div>
    );
  }

  // Escalas para gráfico responsive
  const containerWidth = window.innerWidth - 200; // Margen para controles
  const width = Math.max(800, containerWidth);
  const height = 500;
  const margin = 120;
  
  // Función unificada para posicionamiento (keyframes, snap y curva)
  const dateToX = (date) => {
    // Normalizar todas las fechas al inicio del día para consistencia
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);
    
    const normalizedMinDate = new Date(minDate);
    normalizedMinDate.setHours(0, 0, 0, 0);
    
    const normalizedMaxDate = new Date(maxDate);
    normalizedMaxDate.setHours(0, 0, 0, 0);
    
    return margin +
      ((normalizedDate - normalizedMinDate) / (normalizedMaxDate - normalizedMinDate || 1)) * (width - 2 * margin);
  };
  
  // Función para la curva suave (interpolación)
  const curveDateToX = (date) => {
    // No normalizar para mantener interpolación suave
    const normalizedMinDate = new Date(minDate);
    normalizedMinDate.setHours(0, 0, 0, 0);
    
    const normalizedMaxDate = new Date(maxDate);
    normalizedMaxDate.setHours(0, 0, 0, 0);
    
    return margin +
      ((new Date(date) - normalizedMinDate) / (normalizedMaxDate - normalizedMinDate || 1)) * (width - 2 * margin);
  };
  
  // Función para calcular fecha desde posición X (consistente con curveDateToX)
  const xToCurveDate = (x) => {
    const ratio = (x - margin) / (width - 2 * margin);
    
    // No normalizar para mantener consistencia con curveDateToX
    const normalizedMinDate = new Date(minDate);
    normalizedMinDate.setHours(0, 0, 0, 0);
    
    const normalizedMaxDate = new Date(maxDate);
    normalizedMaxDate.setHours(0, 0, 0, 0);
    
    return new Date(normalizedMinDate.getTime() + ratio * (normalizedMaxDate.getTime() - normalizedMinDate.getTime()));
  };
  

  
  const valueToY = (value) =>
    height - margin - ((value - minValue) / (maxValue - minValue || 1)) * (height - 2 * margin);

  // Calcular precio interpolado para una fecha
  const getInterpolatedPrice = (date) => {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0].value;
    
    const targetDate = new Date(date);
    
    // Encontrar los dos puntos más cercanos
    let before = null, after = null;
    for (let i = 0; i < sorted.length; i++) {
      const pointDate = new Date(sorted[i].date);
      if (pointDate <= targetDate) {
        before = sorted[i];
      } else {
        after = sorted[i];
        break;
      }
    }
    
    if (!before) return after.value;
    if (!after) return before.value;
    
    // Interpolar
    const t = (targetDate - new Date(before.date)) / (new Date(after.date) - new Date(before.date));
    const basePrice = lerp(before.value, after.value, t);
    
    // Aplicar coeficiente del tipo de habitación seleccionado
    const basePriceForType = Math.round(basePrice * roomTypeCoefficients[selectedRoomType]);
    
    // Aplicar multiplicador según el tipo de precio seleccionado
    switch (selectedPriceType) {
      case 'breakfast':
        if (mealRules.breakfastMode === "FIXED") {
          return Math.round(basePriceForType + mealRules.breakfastValue);
        } else {
          return Math.round(basePriceForType * (1 + mealRules.breakfastValue));
        }
      case 'halfBoard': {
        let breakfastPrice = basePriceForType;
        if (mealRules.breakfastMode === "FIXED") {
          breakfastPrice = basePriceForType + mealRules.breakfastValue;
        } else {
          breakfastPrice = basePriceForType * (1 + mealRules.breakfastValue);
        }
        
        if (mealRules.dinnerMode === "FIXED") {
          return Math.round(breakfastPrice + mealRules.dinnerValue);
        } else {
          return Math.round(breakfastPrice * (1 + mealRules.dinnerValue));
        }
      }
      default:
        return basePriceForType;
    }
  };

  // Interpolación para la curva
  const points = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    const steps = 50; // Más puntos para curva más suave
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const date = new Date(lerp(new Date(a.date).getTime(), new Date(b.date).getTime(), t));
      const basePrice = lerp(a.value, b.value, t);
      
      // Aplicar coeficiente del tipo de habitación seleccionado
      const basePriceForType = Math.round(basePrice * roomTypeCoefficients[selectedRoomType]);
      
      // Aplicar multiplicador según el tipo de precio seleccionado
      let adjustedPrice;
      switch (selectedPriceType) {
        case 'breakfast':
          if (mealRules.breakfastMode === "FIXED") {
            adjustedPrice = Math.round(basePriceForType + mealRules.breakfastValue);
          } else {
            adjustedPrice = Math.round(basePriceForType * (1 + mealRules.breakfastValue));
          }
          break;
        case 'halfBoard': {
          let breakfastPrice = basePriceForType;
          if (mealRules.breakfastMode === "FIXED") {
            breakfastPrice = basePriceForType + mealRules.breakfastValue;
          } else {
            breakfastPrice = basePriceForType * (1 + mealRules.breakfastValue);
          }
          
          if (mealRules.dinnerMode === "FIXED") {
            adjustedPrice = Math.round(breakfastPrice + mealRules.dinnerValue);
          } else {
            adjustedPrice = Math.round(breakfastPrice * (1 + mealRules.dinnerValue));
          }
          break;
        }
        default:
          adjustedPrice = basePriceForType;
      }
      
      points.push({ x: curveDateToX(date), y: valueToY(adjustedPrice) });
    }
  }

  // Generar puntos de la curva para los rectángulos de debug
  const curvePoints = [];
  const currentDate = new Date(minDate);
  
  while (currentDate <= maxDate) {
    const x = curveDateToX(currentDate);
    if (x >= margin && x <= width - margin) {
      const price = getInterpolatedPrice(currentDate);
      const y = valueToY(price);
      curvePoints.push({ x, y, date: new Date(currentDate) });
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Drag & drop handlers
  const handleMouseDown = (idx) => setDragIdx(idx);
  const handleMouseUp = () => {
    setDragIdx(null);
    // No ocultar el tooltip si estamos haciendo clic en el punto de snap
    if (!tooltip.show) {
      setTooltip({ show: false, x: 0, y: 0, price: 0, date: '', snapX: 0, snapY: 0, snapDate: null });
    }
  };

  // Función específica para clic en punto de snap
  const handleSnapPointClick = (e) => {
    e.stopPropagation(); // Evitar que el clic se propague
    
    if (tooltip.show && tooltip.snapDate) {
      // Verificar si ya existe un punto en esta fecha
      const snapDateString = normalizeDate(tooltip.snapDate);
      const existingPointIndex = sorted.findIndex(point => {
        const pointDateString = normalizeDate(point.date);
        return pointDateString === snapDateString;
      });
      
      if (existingPointIndex !== -1) {
        // Si existe un punto, editar en lugar de agregar
        setEditingPoint({ index: existingPointIndex, point: sorted[existingPointIndex] });
      } else {
        // Si no existe, abrir modal para agregar nuevo punto
        setShowAddModal(true);
      }
    }
  };

  const navigatePeriod = (direction) => {
    const newPeriod = new Date(currentPeriod);
    
    switch (zoomLevel) {
      case 'month':
        newPeriod.setMonth(newPeriod.getMonth() + direction);
        break;
      case 'quarter':
        newPeriod.setMonth(newPeriod.getMonth() + direction);
        break;
    }
    
    setCurrentPeriod(newPeriod);
  };

  const handleMouseMove = (e) => {
    const svgRect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - svgRect.left;
    const y = e.clientY - svgRect.top;
    

    
    // Tooltip para la curva - simplificar condiciones
    if (x >= margin && x <= width - margin) {
      // Calcular la fecha aproximada desde la posición del mouse
      const approximateDate = xToCurveDate(x);
      
      // Encontrar el día correspondiente basado en la posición X
      // Calcular cuántos días han pasado desde minDate usando round para centrar en el día
      const daysSinceMinDate = Math.round((approximateDate - minDate) / (1000 * 60 * 60 * 24));
      const targetDate = new Date(minDate);
      targetDate.setDate(minDate.getDate() + daysSinceMinDate);
      targetDate.setHours(0, 0, 0, 0); // Establecer a inicio del día para el snap
      
      // Verificar si ya existe un keyframe en esta fecha
      const targetDateString = normalizeDate(targetDate);
      const existingKeyframeIndex = sorted.findIndex(point => {
        const pointDateString = normalizeDate(point.date);
        return pointDateString === targetDateString;
      });
      
      // Calcular la posición X exacta del día calculado
      const snapX = curveDateToX(targetDate);
      
      const price = getInterpolatedPrice(targetDate);
      const snapY = valueToY(price);
      
      // Usar la fecha calculada para el tooltip
      const exactDate = targetDate;
      
      // Verificar que el snapX esté dentro del rango visible
      if (snapX < margin || snapX > width - margin) {
        setTooltip({ show: false, x: 0, y: 0, price: 0, date: '', snapX: 0, snapY: 0, snapDate: null });
        setHoveredKeyframe(null);
        return;
      }
      
      // Calcular la distancia desde la curva
      const distanceFromCurve = Math.abs(y - snapY);
      
      // Solo mostrar tooltip si estamos cerca de la curva (dentro de 100px para ser muy permisivo)
      if (distanceFromCurve <= 100) {
        // Si no existe un keyframe en esta fecha, mostrar signo +
        if (existingKeyframeIndex === -1) {
          setTooltip({
            show: true,
            x: e.clientX + 10,
            y: e.clientY - 80,
            price: price,
            date: exactDate.toLocaleDateString('es-ES', { 
              day: 'numeric', 
              month: 'short', 
              year: 'numeric' 
            }),
            snapX: snapX,
            snapY: snapY,
            snapDate: exactDate
          });
          setHoveredKeyframe(null);
        } else {
          // Si existe un keyframe, no mostrar tooltip pero marcar como hovered
          setTooltip({ show: false, x: 0, y: 0, price: 0, date: '', snapX: 0, snapY: 0, snapDate: null });
          setHoveredKeyframe(existingKeyframeIndex);
        }
      } else {
        setTooltip({ show: false, x: 0, y: 0, price: 0, date: '', snapX: 0, snapY: 0, snapDate: null });
        setHoveredKeyframe(null);
      }
    } else {
      setTooltip({ show: false, x: 0, y: 0, price: 0, date: '', snapX: 0, snapY: 0, snapDate: null });
      setHoveredKeyframe(null);
    }
    
    // Drag & drop
    if (dragIdx === null) return;
    
    // Calcular la fecha desde la posición X
    const date = new Date(
      minDate.getTime() +
        ((x - margin) / (width - 2 * margin)) * (maxDate - minDate || 1)
    );
    
    // Calcular el valor desde la posición Y (precio ajustado)
    const adjustedValue =
      minValue +
      ((height - margin - y) / (height - 2 * margin)) * (maxValue - minValue || 1);
    
    // Convertir el precio ajustado de vuelta al precio base
    let baseValue;
    const basePriceForType = adjustedValue;
    
    switch (selectedPriceType) {
      case 'breakfast':
        baseValue = Math.round(basePriceForType / 1.15);
        break;
      case 'halfBoard':
        baseValue = Math.round(basePriceForType / 1.35);
        break;
      default:
        baseValue = basePriceForType;
    }
    
    // Convertir de vuelta al precio base (dividir por el coeficiente del tipo de habitación)
    const finalBaseValue = Math.round(baseValue / roomTypeCoefficients[selectedRoomType]);
    
    const newKeyframes = sorted.map((k, i) =>
      i === dragIdx ? { ...k, date: date.toISOString().slice(0, 10), value: finalBaseValue } : k
    );
    onChange(newKeyframes);
  };



  // Meses de fondo
  const months = [];
  let d = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  while (d <= maxDate) {
    months.push(new Date(d));
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h3 style={{ color: '#2c3e50', margin: 0 }}>Curva Estacional</h3>
          <div style={{ fontSize: '12px', color: '#6c757d' }}>
            {(() => {
              const { minDate, maxDate } = getDateRange();
              const formatDate = (date) => date.toLocaleDateString('es-ES', { 
                day: 'numeric', 
                month: 'short', 
                year: 'numeric' 
              });
              return `${formatDate(minDate)} - ${formatDate(maxDate)}`;
            })()}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Selector de tipo de habitación */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '500' }}>
              Tipo de Habitación
            </label>
            <select
              value={selectedRoomType}
              onChange={(e) => setSelectedRoomType(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            >
              {Object.entries(roomTypeNames).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </select>
          </div>

          {/* Selector de tipo de precio */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '500' }}>
              Tipo de Precio
            </label>
            <select
              value={selectedPriceType}
              onChange={(e) => setSelectedPriceType(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            >
              {priceTypeOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

                      {/* Botones de zoom */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '500' }}>
                Nivel de Zoom
              </label>
              <div style={{ display: 'flex', gap: '4px' }}>
                {zoomLevels.map(level => (
                  <button
                    key={level.value}
                    onClick={() => setZoomLevel(level.value)}
                    style={{
                      padding: '8px 12px',
                      background: zoomLevel === level.value ? '#667eea' : '#f8f9fa',
                      color: zoomLevel === level.value ? 'white' : '#495057',
                      border: '1px solid #ced4da',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Controles de navegación */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', color: '#6c757d', fontWeight: '500' }}>
                Navegación
              </label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => navigatePeriod(-1)}
                  style={{
                    padding: '8px 12px',
                    background: '#f8f9fa',
                    color: '#495057',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    minWidth: '40px'
                  }}
                  title="Anterior"
                >
                  ←
                </button>
                <button
                  onClick={() => setCurrentPeriod(new Date())}
                  style={{
                    padding: '8px 12px',
                    background: '#f8f9fa',
                    color: '#495057',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}
                >
                  Hoy
                </button>
                <button
                  onClick={() => navigatePeriod(1)}
                  style={{
                    padding: '8px 12px',
                    background: '#f8f9fa',
                    color: '#495057',
                    border: '1px solid #ced4da',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    minWidth: '40px'
                  }}
                  title="Siguiente"
                >
                  →
                </button>
              </div>
            </div>
        </div>
      </div>
      
      <div style={{ 
        border: '1px solid #e9ecef', 
        borderRadius: '8px', 
        padding: '20px',
        background: '#fff',
        minHeight: '600px'
      }}>
        <div style={{
          width: '100%',
          position: 'relative'
        }}>
          <svg
            ref={svgRef}
            width={width}
            height={height}
            style={{ 
              background: "#f8f9fa", 
              border: "1px solid #dee2e6", 
              borderRadius: "4px",
              touchAction: "none"
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              setDragIdx(null);
              setTooltip({ show: false, x: 0, y: 0, price: 0, date: '', snapX: 0, snapY: 0, snapDate: null });
            }}
            onClick={(e) => {
              // No agregar punto si se hizo clic en un keyframe
              if (tooltip.show && !e.target.closest('circle[stroke="#667eea"]')) {
                e.stopPropagation();
                // addPointFromTooltip(); // Eliminado
              }
            }}
          >
            {/* Fondo sombreado por mes */}
            {months.map((m, i) => (
              <rect
                key={i}
                x={dateToX(m)}
                y={margin}
                width={dateToX(new Date(m.getFullYear(), m.getMonth() + 1, 1)) - dateToX(m)}
                height={height - 2 * margin}
                fill={i % 2 === 0 ? "#e3f2fd" : "#fff"}
                opacity={0.3}
              />
            ))}
            

            
            {/* Ejes */}
            <line x1={margin} y1={height - margin} x2={width - margin} y2={height - margin} stroke="#6c757d" strokeWidth={2} />
            <line x1={margin} y1={margin} x2={margin} y2={height - margin} stroke="#6c757d" strokeWidth={2} />
            
            {/* Etiquetas de fechas en eje X con números de día */}
            {(() => {
              const dayLabels = [];
              const currentDate = new Date(minDate);
              
              while (currentDate <= maxDate) {
                const x = dateToX(currentDate);
                if (x >= margin && x <= width - margin) {
                  const day = currentDate.getDate();
                  const isImportantDay = day === 1 || day === 10 || day === 20 || 
                                       day === new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
                  
                  // Mostrar todos los días en semana y mes, solo días importantes en quarter
                  const shouldShow = zoomLevel === 'month' || isImportantDay;
                  
                  if (shouldShow) {
                    dayLabels.push(
                      <text
                        key={currentDate.getTime()}
                        x={x}
                        y={height - margin + 20}
                        fontSize={zoomLevel === 'quarter' ? 20 : 18}
                        fill="#495057"
                        textAnchor="middle"
                        fontWeight={isImportantDay ? "600" : "400"}
                      >
                        {day}
                      </text>
                    );
                  }
                }
                
                // Avanzar al siguiente día
                currentDate.setDate(currentDate.getDate() + 1);
              }
              
              // Agregar nombres de meses
              const monthLabels = [];
              const monthStart = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
              const monthEnd = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);
              const currentMonth = new Date(monthStart);
              
              while (currentMonth <= monthEnd) {
                const x = dateToX(currentMonth);
                if (x >= margin && x <= width - margin) {
                  monthLabels.push(
                    <text
                      key={`month-${currentMonth.getTime()}`}
                      x={x + 5}
                                              y={height - margin + 55}
                        fontSize={24}
                        fill="#495057"
                        fontWeight="bold"
                    >
                      {getMonthName(currentMonth)}
                    </text>
                  );
                }
                currentMonth.setMonth(currentMonth.getMonth() + 1);
              }
              
              return [...dayLabels, ...monthLabels];
            })()}
            
            {/* Etiquetas de precios en eje Y */}
            {[0, 25, 50, 75, 100].map(percent => {
              const value = minValue + (maxValue - minValue) * (percent / 100);
              const y = valueToY(value);
              return (
                <g key={percent}>
                  <line x1={margin - 5} y1={y} x2={margin} y2={y} stroke="#6c757d" strokeWidth={1} />
                  <text x={margin - 25} y={y + 5} fontSize={18} fill="#495057" textAnchor="end" fontWeight="bold">
                    ${Math.round(value).toLocaleString()}
                  </text>
                </g>
              );
            })}
            
            {/* Curva interpolada */}
            <polyline
              fill="none"
              stroke="#667eea"
              strokeWidth={4}
              points={points.map((p) => `${p.x},${p.y}`).join(" ")}
            />
            

            
            {/* Área de clic adicional para debug */}
            {tooltip.show && (
              <rect
                x={tooltip.snapX - 20}
                y={tooltip.snapY - 20}
                width={40}
                height={40}
                fill="transparent"
                stroke="transparent"
                style={{ cursor: "pointer" }}
                onClick={handleSnapPointClick}
              />
            )}
            
            {/* Puntos clave */}
            {sorted.map((k, i) => {
              // Calcular el precio ajustado para este keyframe
              const basePriceForType = Math.round(k.value * roomTypeCoefficients[selectedRoomType]);
              let adjustedPrice;
              switch (selectedPriceType) {
                case 'breakfast':
                  if (mealRules.breakfastMode === "FIXED") {
                    adjustedPrice = Math.round(basePriceForType + mealRules.breakfastValue);
                  } else {
                    adjustedPrice = Math.round(basePriceForType * (1 + mealRules.breakfastValue));
                  }
                  break;
                case 'halfBoard': {
                  let breakfastPrice = basePriceForType;
                  if (mealRules.breakfastMode === "FIXED") {
                    breakfastPrice = basePriceForType + mealRules.breakfastValue;
                  } else {
                    breakfastPrice = basePriceForType * (1 + mealRules.breakfastValue);
                  }
                  
                  if (mealRules.dinnerMode === "FIXED") {
                    adjustedPrice = Math.round(breakfastPrice + mealRules.dinnerValue);
                  } else {
                    adjustedPrice = Math.round(breakfastPrice * (1 + mealRules.dinnerValue));
                  }
                  break;
                }
                default:
                  adjustedPrice = basePriceForType;
              }
              
              return (
                <g key={i}>
                  <circle
                    cx={curveDateToX(k.date)}
                    cy={valueToY(adjustedPrice)}
                    r={10}
                    fill={hoveredKeyframe === i ? "#667eea" : "#fff"}
                    stroke="#667eea"
                    strokeWidth={3}
                    onMouseDown={() => handleMouseDown(i)}
                    onClick={() => setEditingPoint({ index: i, point: k })}
                    style={{ cursor: "pointer" }}
                  />
                  <text
                    x={curveDateToX(k.date)}
                    y={valueToY(adjustedPrice) - 15}
                    fontSize={18}
                    fill="#495057"
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    ${Math.round(adjustedPrice).toLocaleString()}
                  </text>
                </g>
              );
            })}
            
            {/* Signo + para días sin precio */}
            {tooltip.show && (
              <g>
                {/* Área de clic invisible más grande */}
                <circle
                  cx={tooltip.snapX}
                  cy={tooltip.snapY}
                  r={20}
                  fill="transparent"
                  stroke="transparent"
                  style={{ cursor: "pointer" }}
                  onClick={handleSnapPointClick}
                />
                {/* Círculo de fondo */}
                <circle
                  cx={tooltip.snapX}
                  cy={tooltip.snapY}
                  r={12}
                  fill="#667eea"
                  stroke="#5a67d8"
                  strokeWidth={2}
                  style={{ cursor: "pointer" }}
                  onClick={handleSnapPointClick}
                />
                {/* Signo + */}
                <text
                  x={tooltip.snapX}
                  y={tooltip.snapY + 4}
                  fontSize={16}
                  fill="white"
                  textAnchor="middle"
                  fontWeight="bold"
                  style={{ cursor: "pointer" }}
                  onClick={handleSnapPointClick}
                >
                  +
                </text>
              </g>
            )}
            



          </svg>
        </div>
        
        {/* Tooltip fuera del SVG */}
        {tooltip.show && (
          <div
            style={{
              position: 'absolute',
              left: tooltip.x + 50,
              top: tooltip.y - 50,
              backgroundColor: '#2c3e50',
              color: 'white',
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '16px',
              zIndex: 1000,
              pointerEvents: 'none',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
              minWidth: '250px',
              textAlign: 'center'
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '18px' }}>
              {tooltip.date}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '6px' }}>
              ${tooltip.price.toLocaleString()}
            </div>
            <div style={{ fontSize: '14px', color: '#95a5a6' }}>
              Clic para agregar precio
            </div>
          </div>
        )}
        
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '10px 20px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '10px',
              fontSize: '14px'
            }}
          >
            + Agregar punto
          </button>
          <button
            onClick={onSave}
            style={{
              padding: '10px 20px',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Guardar Cambios
          </button>
        </div>

      </div>

      {/* Modal para agregar punto */}
      {showAddModal && (
        <AddPointModal
          initialDate={tooltip.show && tooltip.snapDate ? tooltip.snapDate.toISOString().slice(0, 10) : ''}
          initialValue={tooltip.show && tooltip.price ? tooltip.price.toString() : ''}
          onClose={() => setShowAddModal(false)}
          onAdd={(newPoint) => {
            // Verificar si ya existe un keyframe en esta fecha
            const newPointDateString = normalizeDate(newPoint.date);
            const existingKeyframeIndex = sorted.findIndex(point => {
              const pointDateString = normalizeDate(point.date);
              return pointDateString === newPointDateString;
            });
            
            if (existingKeyframeIndex !== -1) {
              showNotification('Ya existe un precio establecido para este día', 'error');
              return;
            }
            
            const newKeyframes = [...sorted, newPoint].sort((a, b) => new Date(a.date) - new Date(b.date));
            onChange(newKeyframes);
            setShowAddModal(false);
            showNotification('Punto agregado exitosamente');
          }}
        />
      )}

      {/* Notificación */}
      {notification.show && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: notification.type === 'success' ? '#28a745' : '#dc3545',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '4px',
          zIndex: 10000,
          boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
        }}>
          {notification.message}
        </div>
      )}

      {/* Modal para editar punto */}
      {editingPoint && (
        <EditPointModal
          point={editingPoint.point}
          onClose={() => setEditingPoint(null)}
          onSave={(updatedPoint) => {
            const newKeyframes = sorted.map((k, i) => 
              i === editingPoint.index ? updatedPoint : k
            );
            onChange(newKeyframes);
            setEditingPoint(null);
          }}
          onDelete={() => {
            const newKeyframes = sorted.filter((_, i) => i !== editingPoint.index);
            onChange(newKeyframes);
            setEditingPoint(null);
            showNotification('Punto eliminado exitosamente');
          }}
        />
      )}
    </div>
  );
}

function AddPointModal({ onClose, onAdd, initialDate = '', initialValue = '' }) {
  const [date, setDate] = useState(initialDate || new Date().toISOString().slice(0, 10));
  const [value, setValue] = useState(initialValue ? parseFloat(initialValue).toFixed(2) : '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!date || !value) return;
    onAdd({ date, value: parseFloat(parseFloat(value).toFixed(2)) });
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{ 
        background: '#fff', 
        padding: '24px', 
        borderRadius: '8px', 
        minWidth: '400px'
      }}>
        <h3 style={{ marginBottom: '20px' }}>Agregar Punto de Referencia</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Fecha:</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
              required
            />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Precio Base (Habitación Doble):</label>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Ej: 10000"
              style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
              required
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{
              padding: '8px 16px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'
            }}>
              Cancelar
            </button>
            <button type="submit" style={{
              padding: '8px 16px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'
            }}>
              Agregar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditPointModal({ point, onClose, onSave, onDelete }) {
  const validDate = (() => {
    try {
      const dateObj = new Date(point.date);
      if (isNaN(dateObj.getTime())) {
        return new Date().toISOString().slice(0, 10);
      }
      return dateObj.toISOString().slice(0, 10);
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  })();
  
  const [date, setDate] = useState(validDate);
  const [value, setValue] = useState(point.value.toFixed(2));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!date || !value) return;
    onSave({ date, value: parseFloat(parseFloat(value).toFixed(2)) });
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', minWidth: '400px' }}>
        <h3 style={{ marginBottom: '20px' }}>Editar Punto de Referencia</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Fecha:</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
              required
            />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Precio Base (Habitación Doble):</label>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #ced4da', borderRadius: '4px' }}
              required
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onDelete} style={{
              padding: '8px 16px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'
            }}>
              Eliminar
            </button>
            <button type="button" onClick={onClose} style={{
              padding: '8px 16px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'
            }}>
              Cancelar
            </button>
            <button type="submit" style={{
              padding: '8px 16px', background: '#667eea', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'
            }}>
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

 