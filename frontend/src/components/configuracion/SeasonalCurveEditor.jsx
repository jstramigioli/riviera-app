import React, { useRef, useState, useEffect } from "react";

// Coeficientes por defecto para tipos de habitación
const defaultRoomTypeCoefficients = {
  'single': 0.62,
  'doble': 1.00,
  'triple': 1.25,
  'cuadruple': 1.50,
  'quintuple': 1.75
};

const roomTypeNames = {
  'single': 'Individual',
  'doble': 'Doble',
  'triple': 'Triple',
  'cuadruple': 'Cuádruple',
  'quintuple': 'Quíntuple'
};

const priceTypeOptions = [
  { value: 'base', label: 'Precio Base' },
  { value: 'breakfast', label: 'Con Desayuno' },
  { value: 'halfBoard', label: 'Media Pensión' }
];

const zoomLevels = [
  { value: 'week', label: 'Semana' },
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
  const [previewDate, setPreviewDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedRoomType, setSelectedRoomType] = useState('doble');
  const [selectedPriceType, setSelectedPriceType] = useState('base');
  const [roomTypeCoefficients, setRoomTypeCoefficients] = useState(defaultRoomTypeCoefficients);
  const [zoomLevel, setZoomLevel] = useState('month');
  const [lastSavedKeyframes, setLastSavedKeyframes] = useState([]);
  const [currentPeriod, setCurrentPeriod] = useState(new Date());
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

  // Ordenar keyframes por fecha
  const sorted = [...keyframes].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Función para obtener el rango de fechas basado en el período actual
  const getDateRange = () => {
    const period = currentPeriod;
    
    switch (zoomLevel) {
      case 'week': {
        const weekStart = new Date(period);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        return { minDate: weekStart, maxDate: weekEnd };
      }
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
  const minValue = Math.min(...sorted.map((k) => k.value));
  const maxValue = Math.max(...sorted.map((k) => k.value));

  // Función para agregar punto desde el tooltip
  const addPointFromTooltip = () => {
    console.log('addPointFromTooltip called', { tooltip, sorted });
    if (tooltip.show && tooltip.snapDate) {
      const newPoint = {
        date: tooltip.snapDate.toISOString().slice(0, 10),
        value: tooltip.price
      };
      console.log('Adding new point:', newPoint);
      const newKeyframes = [...sorted, newPoint].sort((a, b) => new Date(a.date) - new Date(b.date));
      console.log('New keyframes:', newKeyframes);
      onChange(newKeyframes);
      console.log('onChange called');
    } else {
      console.log('Cannot add point:', { tooltipShow: tooltip.show, snapDate: tooltip.snapDate });
    }
  };

  // Función para abrir modal con valores del snap
  const openAddModalFromSnap = () => {
    if (tooltip.show && tooltip.snapDate) {
      setShowAddModal(true);
      // Los valores se pasarán al modal a través de props
    }
  };

  // Función para mostrar notificación
  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  // Event listener para tecla Enter
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Enter' && tooltip.show) {
        addPointFromTooltip();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [tooltip.show, tooltip.snapDate, tooltip.price, sorted, onChange]);

  // Cargar coeficientes desde el backend
  useEffect(() => {
    fetch(`/api/dynamic-pricing/coefficients/${hotelId}`)
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
  }, [sorted, lastSavedKeyframes, onSave, showAddModal, editingPoint]);
  
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
  const margin = 80;
  
  // Función original para la curva (suave)
  const dateToX = (date) =>
    margin +
    ((new Date(date) - minDate) / (maxDate - minDate || 1)) * (width - 2 * margin);
  
  // Función específica para puntos (alineada con etiquetas)
  const pointDateToX = (date) => {
    const targetDate = new Date(date);
    targetDate.setHours(12, 0, 0, 0); // Establecer a mediodía para evitar problemas de zona horaria
    const minDateMid = new Date(minDate);
    minDateMid.setHours(12, 0, 0, 0);
    const maxDateMid = new Date(maxDate);
    maxDateMid.setHours(12, 0, 0, 0);
    
    return margin +
      ((targetDate - minDateMid) / (maxDateMid - minDateMid || 1)) * (width - 2 * margin);
  };
  
  const valueToY = (value) =>
    height - margin - ((value - minValue) / (maxValue - minValue || 1)) * (height - 2 * margin);

  // Interpolación para la curva
  const points = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    const steps = 50; // Más puntos para curva más suave
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const date = new Date(lerp(new Date(a.date).getTime(), new Date(b.date).getTime(), t));
      const value = lerp(a.value, b.value, t);
      points.push({ x: dateToX(date), y: valueToY(value) });
    }
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
    console.log('Clic en punto de snap detectado');
    
    if (tooltip.show && tooltip.snapDate) {
      // Verificar si ya existe un punto en esta fecha
      const existingPointIndex = sorted.findIndex(point => {
        const pointDate = new Date(point.date);
        const snapDate = new Date(tooltip.snapDate);
        return pointDate.toDateString() === snapDate.toDateString();
      });
      
      if (existingPointIndex !== -1) {
        // Si existe un punto, editar en lugar de agregar
        console.log('Punto existente encontrado, editando...');
        setEditingPoint({ index: existingPointIndex, point: sorted[existingPointIndex] });
      } else {
        // Si no existe, agregar nuevo punto
        console.log('Agregando nuevo punto...');
        openAddModalFromSnap();
      }
    }
  };

  const navigatePeriod = (direction) => {
    const newPeriod = new Date(currentPeriod);
    console.log('Navegando:', { direction, zoomLevel, currentPeriod: currentPeriod.toDateString(), newPeriod: newPeriod.toDateString() });
    
    switch (zoomLevel) {
      case 'week':
        newPeriod.setDate(newPeriod.getDate() + direction);
        break;
      case 'month':
        newPeriod.setMonth(newPeriod.getMonth() + direction);
        break;
      case 'quarter':
        newPeriod.setMonth(newPeriod.getMonth() + direction);
        break;
    }
    
    console.log('Nuevo período:', newPeriod.toDateString());
    setCurrentPeriod(newPeriod);
  };

  const handleMouseMove = (e) => {
    const svgRect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - svgRect.left;
    const y = e.clientY - svgRect.top;
    
        // Tooltip para la curva
    if (x >= margin && x <= width - margin && y >= margin && y <= height - margin) {
      // Calcular la fecha aproximada basada en la posición X del mouse
      const approximateDate = new Date(minDate.getTime() + (x - margin) / (width - 2 * margin) * (maxDate - minDate));
      
      // Encontrar el día exacto más cercano al mouse
      const targetDate = new Date(approximateDate);
      targetDate.setHours(12, 0, 0, 0); // Establecer a mediodía para evitar problemas de zona horaria
      
      // Redondear al día más cercano
      const dayDiff = Math.round((targetDate.getTime() - minDate.getTime()) / (24 * 60 * 60 * 1000));
      const exactDate = new Date(minDate.getTime() + dayDiff * 24 * 60 * 60 * 1000);
      exactDate.setHours(12, 0, 0, 0);
      
      // Calcular la posición X del día exacto
      const snapX = dateToX(exactDate);
      const price = getInterpolatedPrice(exactDate);
      const snapY = valueToY(price);
      
      // Verificar que el snapX esté dentro del rango visible y cerca del mouse
      if (snapX < margin || snapX > width - margin || Math.abs(snapX - x) > 100) {
        setTooltip({ show: false, x: 0, y: 0, price: 0, date: '', snapX: 0, snapY: 0, snapDate: null });
        return;
      }
      
      // Calcular la distancia desde la curva
      const distanceFromCurve = Math.abs(y - snapY);
      
      // Solo mostrar tooltip si estamos cerca de la curva (dentro de 30px)
      if (distanceFromCurve <= 30) {
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
      } else {
        setTooltip({ show: false, x: 0, y: 0, price: 0, date: '', snapX: 0, snapY: 0, snapDate: null });
      }
    } else {
      setTooltip({ show: false, x: 0, y: 0, price: 0, date: '', snapX: 0, snapY: 0, snapDate: null });
    }
    
    // Drag & drop
    if (dragIdx === null) return;
    // Invertir escalas
    const date = new Date(
      minDate.getTime() +
        ((x - margin) / (width - 2 * margin)) * (maxDate - minDate || 1)
    );
    const value =
      minValue +
      ((height - margin - y) / (height - 2 * margin)) * (maxValue - minValue || 1);
    const newKeyframes = sorted.map((k, i) =>
      i === dragIdx ? { ...k, date: date.toISOString().slice(0, 10), value: Math.round(value) } : k
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
    return lerp(before.value, after.value, t);
  };

  const basePrice = getInterpolatedPrice(previewDate);

  // Calcular precios según tipo seleccionado
  const calculatePrices = () => {
    const basePriceForType = Math.round(basePrice * roomTypeCoefficients[selectedRoomType]);
    
    switch (selectedPriceType) {
      case 'breakfast':
        return Math.round(basePriceForType * 1.15);
      case 'halfBoard':
        return Math.round(basePriceForType * 1.35);
      default:
        return basePriceForType;
    }
  };

  const currentPrice = calculatePrices();

  // Función para ajustar automáticamente otros precios
  const adjustOtherPrices = (newPrice, roomType, priceType) => {
    const newCoefficients = { ...roomTypeCoefficients };
    
    if (priceType === 'base') {
      // Ajustar coeficiente del tipo de habitación
      newCoefficients[roomType] = newPrice / basePrice;
    } else if (priceType === 'breakfast') {
      // Calcular nuevo coeficiente basado en precio con desayuno
      const basePriceForType = newPrice / 1.15;
      newCoefficients[roomType] = basePriceForType / basePrice;
    } else if (priceType === 'halfBoard') {
      // Calcular nuevo coeficiente basado en precio con media pensión
      const basePriceForType = newPrice / 1.35;
      newCoefficients[roomType] = basePriceForType / basePrice;
    }
    
    setRoomTypeCoefficients(newCoefficients);
  };

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
              console.log('SVG clicked at:', e.clientX, e.clientY);
              if (tooltip.show) {
                console.log('Tooltip is active, attempting to add point');
                e.stopPropagation();
                addPointFromTooltip();
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
                  const shouldShow = zoomLevel === 'week' || zoomLevel === 'month' || isImportantDay;
                  
                  if (shouldShow) {
                    dayLabels.push(
                      <text
                        key={currentDate.getTime()}
                        x={x}
                        y={height - margin + 15}
                        fontSize={zoomLevel === 'quarter' ? 10 : 9}
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
                      y={height - margin + 35}
                      fontSize={12}
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
                  <text x={margin - 10} y={y + 5} fontSize={12} fill="#495057" textAnchor="end" fontWeight="bold">
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
            {sorted.map((k, i) => (
              <g key={i}>
                <circle
                  cx={pointDateToX(k.date)}
                  cy={valueToY(k.value)}
                  r={10}
                  fill="#fff"
                  stroke="#667eea"
                  strokeWidth={3}
                  onMouseDown={() => handleMouseDown(i)}
                  onClick={() => setEditingPoint({ index: i, point: k })}
                  style={{ cursor: "pointer" }}
                />
                <text
                  x={pointDateToX(k.date)}
                  y={valueToY(k.value) - 15}
                  fontSize={12}
                  fill="#495057"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  ${k.value.toLocaleString()}
                </text>
              </g>
            ))}
            
            {/* Punto de snap */}
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
                <circle
                  cx={tooltip.snapX}
                  cy={tooltip.snapY}
                  r={8}
                  fill="#e74c3c"
                  stroke="#c0392b"
                  strokeWidth={3}
                  style={{ cursor: "pointer" }}
                  onClick={handleSnapPointClick}
                />
                <circle
                  cx={tooltip.snapX}
                  cy={tooltip.snapY}
                  r={4}
                  fill="white"
                  onClick={handleSnapPointClick}
                />
              </g>
            )}


          </svg>
        </div>
        
        {/* Tooltip fuera del SVG */}
        {tooltip.show && (
          <div
            style={{
              position: 'absolute',
              left: tooltip.x,
              top: tooltip.y,
              backgroundColor: '#2c3e50',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              zIndex: 1000,
              pointerEvents: 'none',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
              minWidth: '140px',
              textAlign: 'center'
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
              {tooltip.date}
            </div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
              ${tooltip.price.toLocaleString()}
            </div>
            <div style={{ fontSize: '10px', color: '#95a5a6' }}>
              Clic para agregar punto
            </div>
            <div style={{ fontSize: '8px', color: '#7f8c8d' }}>
              (o presiona Enter)
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
              marginRight: '10px',
              fontSize: '14px'
            }}
          >
            Guardar Curva
          </button>
          {/* Botón de prueba temporal */}
          {tooltip.show && (
            <button
              onClick={() => {
                console.log('Botón de prueba: Agregando punto');
                addPointFromTooltip();
              }}
              style={{
                padding: '10px 20px',
                background: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              🧪 Probar Agregar Punto
            </button>
          )}
        </div>
      </div>

      {/* Panel de previsualización mejorado */}
      <div style={{ 
        marginTop: '30px',
        border: '1px solid #e9ecef', 
        borderRadius: '8px', 
        padding: '20px',
        background: '#f8f9fa'
      }}>
        <h4 style={{ marginBottom: '15px', color: '#34495e' }}>Previsualización de Tarifas</h4>
        
        <div style={{ 
          display: 'flex', 
          gap: '20px', 
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Fecha de previsualización:</label>
            <input
              type="date"
              value={previewDate}
              onChange={(e) => setPreviewDate(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Precio actual:</label>
            <input
              type="number"
              value={currentPrice}
              onChange={(e) => {
                const newPrice = parseFloat(e.target.value);
                adjustOtherPrices(newPrice, selectedRoomType, selectedPriceType);
              }}
              style={{
                padding: '8px 12px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px',
                width: '120px'
              }}
            />
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '4px' }}>
          <thead>
            <tr style={{ background: '#f8f9fa' }}>
              <th style={{ padding: '15px', textAlign: 'left', borderBottom: '1px solid #dee2e6', fontSize: '14px' }}>
                Tipo de Habitación
              </th>
              <th style={{ padding: '15px', textAlign: 'right', borderBottom: '1px solid #dee2e6', fontSize: '14px' }}>
                Base
              </th>
              <th style={{ padding: '15px', textAlign: 'right', borderBottom: '1px solid #dee2e6', fontSize: '14px' }}>
                Con Desayuno
              </th>
              <th style={{ padding: '15px', textAlign: 'right', borderBottom: '1px solid #dee2e6', fontSize: '14px' }}>
                Media Pensión
              </th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(roomTypeCoefficients).map(([type, coefficient]) => {
              const basePriceForType = Math.round(basePrice * coefficient);
              const breakfastPrice = Math.round(basePriceForType * 1.15);
              const halfBoardPrice = Math.round(breakfastPrice * 1.20);
              
              return (
                <tr key={type} style={{ borderBottom: '1px solid #f1f3f4' }}>
                  <td style={{ padding: '15px', fontWeight: '500', fontSize: '14px' }}>
                    {roomTypeNames[type]}
                  </td>
                  <td style={{ padding: '15px', textAlign: 'right', fontSize: '14px' }}>
                    ${basePriceForType.toLocaleString()}
                  </td>
                  <td style={{ padding: '15px', textAlign: 'right', color: '#28a745', fontSize: '14px' }}>
                    ${breakfastPrice.toLocaleString()}
                  </td>
                  <td style={{ padding: '15px', textAlign: 'right', color: '#dc3545', fontSize: '14px' }}>
                    ${halfBoardPrice.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal para agregar punto */}
      {showAddModal && (
        <AddPointModal
          initialDate={tooltip.snapDate ? tooltip.snapDate.toISOString().slice(0, 10) : ''}
          initialValue={tooltip.price || ''}
          onClose={() => setShowAddModal(false)}
          onAdd={(newPoint) => {
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

 