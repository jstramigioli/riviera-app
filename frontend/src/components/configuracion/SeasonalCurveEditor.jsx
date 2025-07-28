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
  const [notification, setNotification] = useState({ show: false, message: '', type: 'error' });
  const [tooltip, setTooltip] = useState({ 
    show: false, 
    x: 0, 
    y: 0, 
    date: '', 
    price: 0,
    snapX: 0,
    snapY: 0
  });
  const svgRef = useRef();
  const [hoveredKeyframe, setHoveredKeyframe] = useState(null);
  const [periodsData, setPeriodsData] = useState([]);

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
  const minValue = 0; // Comenzar siempre en 0 pesos
  const maxValue = Math.max(...adjustedValues);
  
  console.log(`🔍 Valores para eje Y:`);
  console.log(`   minValue: ${minValue}`);
  console.log(`   maxValue: ${maxValue}`);
  console.log(`   adjustedValues: [${adjustedValues.join(', ')}]`);
  


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
    }, 5000);
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

  // Cargar períodos operacionales desde el backend
  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    fetch(`${API_URL}/operational-periods/${hotelId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          // Los keyframes operacionales se crean automáticamente en el backend
          // No necesitamos crearlos aquí
          console.log('Períodos operacionales cargados:', data.length);
        }
      })
      .catch((error) => {
        console.log('Error al cargar períodos operacionales:', error);
      });
  }, [hotelId]);

  // Cargar información de períodos operacionales
  useEffect(() => {
    const loadPeriodsData = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
        const response = await fetch(`${API_URL}/operational-periods/${hotelId}`);
        if (response.ok) {
          const data = await response.json();
          setPeriodsData(data);
        }
      } catch (error) {
        console.error('Error al cargar información de períodos:', error);
      }
    };
    
    loadPeriodsData();
  }, [hotelId]);

  const getOperationalPeriods = () => {
    const operationalKeyframes = sorted.filter(k => k.isOperational);
    const periods = [];
    
    // Agrupar keyframes por periodId
    const grouped = {};
    operationalKeyframes.forEach(k => {
      if (!grouped[k.periodId]) {
        grouped[k.periodId] = {};
      }
      grouped[k.periodId][k.operationalType] = k;
    });
    
    // Crear períodos con información completa
    Object.values(grouped).forEach(group => {
      if (group.opening && group.closing) {
        // Convertir las fechas string a objetos Date y establecerlas a mediodía
        const startDate = new Date(group.opening.date + 'T12:00:00.000Z');
        const endDate = new Date(group.closing.date + 'T12:00:00.000Z');
        
        // Buscar el período correspondiente
        const periodData = periodsData.find(p => p.id === group.opening.periodId);
        
        periods.push({
          startDate: startDate,
          endDate: endDate,
          periodId: group.opening.periodId,
          label: periodData?.label || null
        });
      }
    });
    
    return periods;
  };


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

  // Escuchar eventos de actualización de coeficientes
  useEffect(() => {
    const handleCoefficientsUpdate = (event) => {
      if (event.detail && event.detail.hotelId === hotelId) {
        // Actualizar los coeficientes con los nuevos datos
        setRoomTypeCoefficients(event.detail.coefficients);
      }
    };

    window.addEventListener('coefficientsUpdated', handleCoefficientsUpdate);

    return () => {
      window.removeEventListener('coefficientsUpdated', handleCoefficientsUpdate);
    };
  }, [hotelId]);

  // Escuchar eventos de actualización de períodos operacionales
  useEffect(() => {
    const handleOperationalPeriodsUpdate = (event) => {
      if (event.detail && event.detail.hotelId === hotelId) {
        // Recargar keyframes desde el backend para obtener los actualizados
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
        fetch(`${API_URL}/dynamic-pricing/keyframes/${hotelId}`)
          .then((res) => res.json())
          .then((keyframes) => {
            if (Array.isArray(keyframes)) {
              onChange(keyframes);
            }
          })
          .catch((error) => {
            console.error('Error al recargar keyframes:', error);
          });
      }
    };

    window.addEventListener('operationalPeriodsUpdated', handleOperationalPeriodsUpdate);

    return () => {
      window.removeEventListener('operationalPeriodsUpdated', handleOperationalPeriodsUpdate);
    };
  }, [hotelId, onChange]);

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
          onSave().catch(error => {
            console.error('Error en guardado automático:', error);
            // Si hay un error relacionado con keyframes operacionales, mostrar mensaje específico
            if (error.message.includes('operacional')) {
              showNotification('Las fechas clave de apertura y cierre se preservan automáticamente', 'info');
            } else {
              showNotification('Error al guardar la curva', 'error');
            }
          });
          showNotification('Curva guardada automáticamente');
        }, 1000); // Esperar 1 segundo después del último cambio
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [sorted, lastSavedKeyframes, onSave, showAddModal, editingPoint, showNotification]);
  
  if (sorted.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>No hay fechas clave configuradas</p>
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
          Agregar primera fecha clave
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

  // Interpolación para la curva - separada por períodos operacionales
  const curveSegments = [];
  const operationalPeriods = getOperationalPeriods();
  
  // Si no hay períodos operacionales, usar la lógica original
  if (operationalPeriods.length === 0) {
    const points = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i + 1];
      const steps = 50;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const date = new Date(lerp(new Date(a.date).getTime(), new Date(b.date).getTime(), t));
        const basePrice = lerp(a.value, b.value, t);
        
        const basePriceForType = Math.round(basePrice * roomTypeCoefficients[selectedRoomType]);
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
    curveSegments.push(points);
  } else {
    // Generar curvas separadas para cada período operacional
    operationalPeriods.forEach((period) => {
      const periodStart = new Date(period.startDate);
      const periodEnd = new Date(period.endDate);
      
      // Filtrar keyframes que están dentro de este período (incluyendo operacionales)
      const periodKeyframes = sorted.filter(k => {
        const keyframeDate = new Date(k.date);
        // Normalizar fechas usando toISOString().split('T')[0] para evitar problemas de zona horaria
        const keyframeDateStr = keyframeDate.toISOString().split('T')[0];
        const periodStartStr = periodStart.toISOString().split('T')[0];
        const periodEndStr = periodEnd.toISOString().split('T')[0];
        
        const isInPeriod = keyframeDateStr >= periodStartStr && keyframeDateStr <= periodEndStr;
        
        // Logs detallados para el keyframe de apertura
        if (k.isOperational && k.operationalType === 'opening') {
          console.log(`🔍 DEBUG APERTURA:`);
          console.log(`   Keyframe date: ${keyframeDate.toISOString()}`);
          console.log(`   Keyframe date string: ${keyframeDateStr}`);
          console.log(`   Period start: ${periodStart.toISOString()}`);
          console.log(`   Period start string: ${periodStartStr}`);
          console.log(`   Period end: ${periodEnd.toISOString()}`);
          console.log(`   Period end string: ${periodEndStr}`);
          console.log(`   keyframeDateStr >= periodStartStr: ${keyframeDateStr >= periodStartStr}`);
          console.log(`   keyframeDateStr <= periodEndStr: ${keyframeDateStr <= periodEndStr}`);
          console.log(`   isInPeriod: ${isInPeriod}`);
        }
        
        console.log(`🔍 FILTRO: Keyframe ${new Date(k.date).toISOString().split('T')[0]} - ${k.isOperational ? k.operationalType : 'NORMAL'} - $${k.value} - En período: ${isInPeriod} (${periodStart.toISOString().split('T')[0]} a ${periodEnd.toISOString().split('T')[0]})`);
        return isInPeriod;
      });
      
      // Ordenar keyframes del período por fecha
      const sortedPeriodKeyframes = periodKeyframes.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      // Generar curva para este período
      const points = [];
      
      // Si hay keyframes en este período, generar la curva
      if (sortedPeriodKeyframes.length > 1) {
        console.log(`🔍 DEBUG: Generando curva con ${sortedPeriodKeyframes.length} keyframes`);
        console.log(`🔍 DEBUG: Keyframes ordenados:`);
        sortedPeriodKeyframes.forEach((k, i) => {
          const dateStr = new Date(k.date).toISOString().split('T')[0];
          const typeStr = k.isOperational ? (k.operationalType === 'opening' ? 'APERTURA' : 'CIERRE') : 'NORMAL';
          console.log(`   ${i + 1}. ${dateStr} - ${typeStr} - $${k.value}`);
        });
        
        for (let i = 0; i < sortedPeriodKeyframes.length - 1; i++) {
          const a = sortedPeriodKeyframes[i], b = sortedPeriodKeyframes[i + 1];
          console.log(`🔍 DEBUG: Segmento ${i + 1}: Interpolando entre ${new Date(a.date).toISOString().split('T')[0]} (${a.isOperational ? a.operationalType : 'NORMAL'}) y ${new Date(b.date).toISOString().split('T')[0]} (${b.isOperational ? b.operationalType : 'NORMAL'})`);
          
          const steps = 50;
          for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const date = new Date(lerp(new Date(a.date).getTime(), new Date(b.date).getTime(), t));
            const basePrice = lerp(a.value, b.value, t);
            
            const basePriceForType = Math.round(basePrice * roomTypeCoefficients[selectedRoomType]);
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
      }
      
      if (points.length > 0) {
        console.log(`🔍 DEBUG: Puntos generados para período: ${points.length}`);
        console.log(`🔍 DEBUG: Primer punto: x=${points[0].x}, y=${points[0].y}`);
        console.log(`🔍 DEBUG: Último punto: x=${points[points.length-1].x}, y=${points[points.length-1].y}`);
        curveSegments.push(points);
      }
    });
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
      setTooltip({ show: false, x: 0, y: 0, date: '', price: 0, snapX: 0, snapY: 0 });
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
        // Editar punto existente
        setEditingPoint({ index: existingPointIndex, point: sorted[existingPointIndex] });
      } else {
        // Agregar nuevo punto
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
        setTooltip({ show: false, x: 0, y: 0, date: '', price: 0, snapX: 0, snapY: 0 });
        setHoveredKeyframe(null);
        return;
      }
      
      // Calcular la distancia desde la curva
      const distanceFromCurve = Math.abs(y - snapY);
      
      // Solo mostrar tooltip si estamos cerca de la curva (dentro de 100px para ser muy permisivo)
      if (distanceFromCurve <= 100) {
        // Verificar en qué período operacional estamos haciendo hover
        const operationalPeriods = getOperationalPeriods();
        const currentPeriod = operationalPeriods.find(period => {
          const periodStart = new Date(period.startDate);
          const periodEnd = new Date(period.endDate);
          return exactDate >= periodStart && exactDate <= periodEnd;
        });
        
        if (currentPeriod) {
          // Contar cuántos segmentos de línea azul hay en este período
          const periodStart = new Date(currentPeriod.startDate);
          const periodEnd = new Date(currentPeriod.endDate);
          
          const periodKeyframes = sorted.filter(k => {
            const keyframeDate = new Date(k.date);
            return keyframeDate >= periodStart && keyframeDate <= periodEnd;
          });
          
          const sortedPeriodKeyframes = periodKeyframes.sort((a, b) => new Date(a.date) - new Date(b.date));
          const segmentCount = sortedPeriodKeyframes.length > 1 ? sortedPeriodKeyframes.length - 1 : 0;
          
          console.log(`🔍 Hover en período operacional: ${currentPeriod.label || 'Sin etiqueta'} - Segmentos de línea azul: ${segmentCount}`);
        }
        
        // Si no existe un keyframe en esta fecha, mostrar signo +
        if (existingKeyframeIndex === -1) {
          setTooltip({
            show: true,
            x: e.clientX + 10,
            y: e.clientY - 80,
            date: exactDate.toLocaleDateString('es-ES', { 
              day: 'numeric', 
              month: 'short', 
              year: 'numeric' 
            }),
            price: price,
            snapX: snapX,
            snapY: snapY,
            snapDate: exactDate // Agregar la fecha del snap
          });
          setHoveredKeyframe(null);
        } else {
          // Si existe un keyframe, no mostrar tooltip pero marcar como hovered
          setTooltip({ show: false, x: 0, y: 0, date: '', price: 0, snapX: 0, snapY: 0 });
          setHoveredKeyframe(existingKeyframeIndex);
        }
      } else {
        setTooltip({ show: false, x: 0, y: 0, date: '', price: 0, snapX: 0, snapY: 0 });
        setHoveredKeyframe(null);
      }
    } else {
      setTooltip({ show: false, x: 0, y: 0, date: '', price: 0, snapX: 0, snapY: 0 });
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
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Notificación */}
      {notification.show && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: notification.type === 'error' ? '#f8d7da' : '#d4edda',
          color: notification.type === 'error' ? '#721c24' : '#155724',
          padding: '12px 20px',
          borderRadius: '4px',
          border: `1px solid ${notification.type === 'error' ? '#f5c6cb' : '#c3e6cb'}`,
          zIndex: 1001,
          maxWidth: '400px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          {notification.message}
        </div>
      )}

      {/* Controles de navegación */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
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
              setTooltip({ show: false, x: 0, y: 0, date: '', price: 0, snapX: 0, snapY: 0 });
            }}
            onClick={(e) => {
              // No agregar punto si se hizo clic en un keyframe
              if (tooltip.show && !e.target.closest('circle[stroke="#667eea"]')) {
                e.stopPropagation();
                // addPointFromTooltip(); // Eliminado
              }
            }}
          >
            {/* Fondo grisado para períodos cerrados */}
            {getOperationalPeriods().map((period, index) => {
              const startX = dateToX(period.startDate);
              const endX = dateToX(period.endDate);
              
              return (
                <g key={`closed-period-${index}`}>
                  {/* Área grisada a la izquierda del período (antes de apertura) */}
                  <rect
                    x={0}
                    y={0}
                    width={startX}
                    height={height}
                    fill="rgba(128, 128, 128, 0.3)"
                    stroke="none"
                  />
                  {/* Área grisada a la derecha del período (después de cierre) */}
                  <rect
                    x={endX}
                    y={0}
                    width={width - endX}
                    height={height}
                    fill="rgba(128, 128, 128, 0.3)"
                    stroke="none"
                  />
                </g>
              );
            })}

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
            
            {/* Curvas interpoladas separadas por períodos operacionales */}
            {curveSegments.map((segment, segmentIndex) => (
              <polyline
                key={`curve-segment-${segmentIndex}`}
                fill="none"
                stroke="#667eea"
                strokeWidth={4}
                points={segment.map((p) => `${p.x},${p.y}`).join(" ")}
              />
            ))}
            

            
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
            
            {/* Puntos clave - SOLO keyframes NO operacionales */}
            {sorted.filter(k => !k.isOperational).map((k) => {
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
              
              // Encontrar el índice real en el array sorted completo
              const realIndex = sorted.findIndex(keyframe => keyframe === k);
              
              return (
                <g key={`normal-${realIndex}`}>
                  <circle
                    cx={curveDateToX(k.date)}
                    cy={valueToY(adjustedPrice)}
                    r={10}
                    fill={hoveredKeyframe === realIndex ? "#667eea" : "#fff"}
                    stroke="#667eea"
                    strokeWidth={3}
                    onMouseDown={() => handleMouseDown(realIndex)}
                    onClick={() => setEditingPoint({ index: realIndex, point: k })}
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

            {/* Keyframes operacionales */}
            {sorted.filter(k => k.isOperational).map((k) => {
              // Encontrar el índice real en el array sorted
              const realIndex = sorted.findIndex(keyframe => keyframe === k);
              
              // Calcular el precio ajustado para este keyframe operacional
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
              
              // Obtener información del período desde el estado
              const periodData = periodsData.find(p => p.id === k.periodId);
              const periodLabel = periodData?.label || null;
              
              return (
                <g key={`operational-${realIndex}`}>
                  {/* Círculo principal - más grande y azul */}
                  <circle
                    cx={curveDateToX(k.date)}
                    cy={valueToY(adjustedPrice)}
                    r={15}
                    fill="#667eea"
                    stroke="#5a67d8"
                    strokeWidth={3}
                    onClick={() => setEditingPoint({ index: realIndex, point: k, isOperational: true })}
                    style={{ cursor: "pointer" }}
                  />
                  
                  {/* Indicador de tipo (Apertura/Cierre) - arriba del gráfico */}
                  <text
                    x={curveDateToX(k.date)}
                    y={margin - 10}
                    fontSize={16}
                    fill="#667eea"
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    {k.operationalType === 'opening' ? 'APERTURA' : 'CIERRE'}
                  </text>
                  
                  {/* Nombre del período - debajo del tipo */}
                  {periodLabel && (
                    <text
                      x={curveDateToX(k.date)}
                      y={margin + 8}
                      fontSize={14}
                      fill="#667eea"
                      textAnchor="middle"
                      fontWeight="normal"
                    >
                      {periodLabel}
                    </text>
                  )}
                  
                  {/* Precio - en negro como los keyframes normales */}
                  <text
                    x={curveDateToX(k.date)}
                    y={valueToY(adjustedPrice) - 15}
                    fontSize={16}
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
            + Agregar fecha clave
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
          onClose={() => {
            console.log('🔍 Cerrando modal de agregar punto');
            setShowAddModal(false);
          }}
          onAdd={(newPoint) => {
            console.log('🔍 onAdd llamado con:', newPoint);
            
            // Verificar si ya existe un keyframe en esta fecha
            const newPointDateString = normalizeDate(newPoint.date);
            const existingKeyframeIndex = sorted.findIndex(point => {
              const pointDateString = normalizeDate(point.date);
              return pointDateString === newPointDateString;
            });
            
            console.log('🔍 newPointDateString:', newPointDateString);
            console.log('🔍 existingKeyframeIndex:', existingKeyframeIndex);
            
            if (existingKeyframeIndex !== -1) {
              showNotification('Ya existe un precio establecido para esta fecha clave', 'error');
              return;
            }
            
            const newKeyframes = [...sorted, newPoint].sort((a, b) => new Date(a.date) - new Date(b.date));
            console.log('🔍 newKeyframes:', newKeyframes);
            
            onChange(newKeyframes);
            setShowAddModal(false);
            showNotification('Fecha clave agregada exitosamente');
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
            console.log('🔍 EditPointModal onSave - isOperational:', editingPoint.isOperational);
            console.log('🔍 EditPointModal onSave - point:', editingPoint.point);
            
            if (editingPoint.isOperational) {
              // Para keyframes operacionales, solo actualizar el precio en el estado local
              const newKeyframes = sorted.map((k, i) => 
                i === editingPoint.index ? { ...k, value: updatedPoint.value } : k
              );
              onChange(newKeyframes);
              showNotification('Precio de la fecha clave actualizado', 'success');
            } else {
              // Para keyframes normales, usar la lógica existente
              const newKeyframes = sorted.map((k, i) => 
                i === editingPoint.index ? updatedPoint : k
              );
              onChange(newKeyframes);
            }
            setEditingPoint(null);
          }}
          onDelete={() => {
            console.log('🔍 EditPointModal onDelete - isOperational:', editingPoint.isOperational);
            
            if (editingPoint.isOperational) {
              showNotification('No se pueden eliminar fechas clave operacionales desde aquí', 'error');
              return;
            }
            const newKeyframes = sorted.filter((_, i) => i !== editingPoint.index);
            onChange(newKeyframes);
            setEditingPoint(null);
            showNotification('Fecha clave eliminada exitosamente');
          }}
          isOperational={editingPoint.isOperational}
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
        <h3 style={{ marginBottom: '20px' }}>Agregar Fecha Clave</h3>
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

function EditPointModal({ point, onClose, onSave, onDelete, isOperational = false }) {
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
  const [showError, setShowError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!date || !value) return;
    
    console.log('🔍 EditPointModal handleSubmit - isOperational:', isOperational);
    console.log('🔍 EditPointModal handleSubmit - date:', date, 'validDate:', validDate);
    
    // Si es un keyframe operacional, verificar que no se cambie la fecha
    if (isOperational && date !== validDate) {
      console.log('❌ EditPointModal - Intento de cambiar fecha en keyframe operacional');
      setShowError(true);
      return;
    }
    
    onSave({ date, value: parseFloat(parseFloat(value).toFixed(2)) });
  };

  const handleDelete = () => {
    console.log('🔍 EditPointModal handleDelete - isOperational:', isOperational);
    
    if (isOperational) {
      console.log('❌ EditPointModal - Intento de eliminar keyframe operacional');
      setShowError(true);
      return;
    }
    onDelete();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', minWidth: '400px' }}>
        <h3 style={{ marginBottom: '20px' }}>
          {isOperational ? 'Editar Fecha Clave Operacional' : 'Editar Fecha Clave'}
        </h3>
        
        {isOperational && (
          <div style={{
            background: '#fff3cd',
            color: '#856404',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '15px',
            border: '1px solid #ffeaa7'
          }}>
            <strong>⚠️ Fecha Clave de Apertura/Cierre</strong><br/>
            Esta fecha clave representa una fecha de apertura o cierre del hotel. 
            Solo puedes modificar el precio base, no la fecha.
          </div>
        )}
        
        {showError && (
          <div style={{
            background: '#f8d7da',
            color: '#721c24',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '15px',
            border: '1px solid #f5c6cb'
          }}>
            {isOperational 
              ? 'No puedes modificar la fecha o eliminar esta fecha clave operacional. Para hacer cambios en las fechas de apertura y cierre, usa el panel de "Períodos de Apertura y Cierre".'
              : 'Error al procesar la solicitud.'
            }
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Fecha:</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '8px', 
                border: '1px solid #ced4da', 
                borderRadius: '4px',
                backgroundColor: isOperational ? '#f8f9fa' : 'white',
                cursor: isOperational ? 'not-allowed' : 'text'
              }}
              disabled={isOperational}
              required
            />
            {isOperational && (
              <small style={{ color: '#6c757d', fontSize: '12px' }}>
                La fecha no se puede modificar para fechas clave operacionales
              </small>
            )}
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
            {!isOperational && (
              <button type="button" onClick={handleDelete} style={{
                padding: '8px 16px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'
              }}>
                Eliminar
              </button>
            )}
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

 