import React, { useEffect, useState, useRef } from 'react';
import { addDays, format, differenceInDays, subDays, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import ReservationBar from './ReservationBar';
import DayInfoSidePanel from './DayInfoSidePanel';
import FloatingAddButton from './FloatingAddButton';
import CreateReservationPanel from './CreateReservationPanel';
import { createReservation, createClient, getDetailedOccupancyScore } from '../services/api';
import styles from '../styles/ReservationGrid.module.css';
import OccupancyScoreModal from './OccupancyScoreModal';

function getDaysArray(start, end) {
  const arr = [];
  let dt = start;
  while (dt <= end) {
    arr.push(new Date(dt));
    dt = addDays(dt, 1);
  }
  return arr;
}

// Función para agrupar días por mes
function groupDaysByMonth(days) {
  const months = [];
  let currentMonth = null;
  let currentMonthDays = [];

  days.forEach(day => {
    const monthKey = format(day, 'yyyy-MM');
    
    if (currentMonth !== monthKey) {
      if (currentMonthDays.length > 0) {
        months.push({
          month: currentMonthDays[0],
          days: currentMonthDays,
          colSpan: currentMonthDays.length
        });
      }
      currentMonth = monthKey;
      currentMonthDays = [day];
    } else {
      currentMonthDays.push(day);
    }
  });

  // Agregar el último mes
  if (currentMonthDays.length > 0) {
    months.push({
      month: currentMonthDays[0],
      days: currentMonthDays,
      colSpan: currentMonthDays.length
    });
  }

  return months;
}

export default function ReservationGrid({ rooms, reservations, setReservations, updateReservation, onReservationClick, operationalPeriods = [] }) {
  const today = new Date();
  // Normalizar la fecha de inicio a medianoche UTC
  const normalizedStartDate = new Date(addDays(today, -30));
  normalizedStartDate.setUTCHours(0, 0, 0, 0);
  
  const [startDate, setStartDate] = useState(normalizedStartDate);
  // Normalizar la fecha de fin a medianoche UTC
  const normalizedEndDate = new Date(addDays(today, 30));
  normalizedEndDate.setUTCHours(0, 0, 0, 0);
  
  const [endDate, setEndDate] = useState(normalizedEndDate);
  const [days, setDays] = useState(getDaysArray(normalizedStartDate, normalizedEndDate));
  const [months, setMonths] = useState(groupDaysByMonth(getDaysArray(normalizedStartDate, normalizedEndDate)));
  const [cellWidth, setCellWidth] = useState(50); // Ancho inicial, se ajustará dinámicamente
  const [cellHeight, setCellHeight] = useState(30); // Alto inicial, se ajustará dinámicamente
  const [dragPreview, setDragPreview] = useState(null);
  const [draggedReservation, setDraggedReservation] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [resizingReservation, setResizingReservation] = useState(null);
  const [resizeData, setResizeData] = useState(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState(null);
  const [resizeReservationId, setResizeReservationId] = useState(null);
  const [headerHeight, setHeaderHeight] = useState(0); // Nueva variable para altura dinámica de headers
  const [justFinishedResize, setJustFinishedResize] = useState(false); // Nueva variable para prevenir click después del resize
  const [isInitialLoad, setIsInitialLoad] = useState(true); // Nueva variable para controlar la carga inicial
  
  // Nuevas variables para el panel de información del día
  const [selectedDate, setSelectedDate] = useState(null);
  const [isDayInfoPanelOpen, setIsDayInfoPanelOpen] = useState(false);
  
  // Nuevas variables para el panel de creación de reservas
  const [isCreateReservationPanelOpen, setIsCreateReservationPanelOpen] = useState(false);
  
  // Estado para configuración de precios dinámicos
  const [dynamicPricingConfig, setDynamicPricingConfig] = useState(null);
  const [occupancyScores, setOccupancyScores] = useState({});
  
  // Estado para el modal de score de ocupación
  const [isOccupancyModalOpen, setIsOccupancyModalOpen] = useState(false);
  const [selectedOccupancyData, setSelectedOccupancyData] = useState(null);
  const [selectedOccupancyDate, setSelectedOccupancyDate] = useState(null);
  
  const tableRef = useRef();
  const containerRef = useRef();
  const resizingReservationRef = useRef(null);
  const resizeDataRef = useRef(null);

  // Constantes para el cálculo de posiciones
  const roomColumnWidth = 120;

  // Función para determinar si un día está en un período cerrado
  const isDayClosed = (day) => {
    if (!operationalPeriods || operationalPeriods.length === 0) {
      return false; // Si no hay períodos configurados, el hotel está siempre abierto
    }

    const dayDate = new Date(day);
    dayDate.setHours(0, 0, 0, 0);

    // Verificar si el día está dentro de algún período operacional
    for (const period of operationalPeriods) {
      const periodStart = new Date(period.startDate);
      const periodEnd = new Date(period.endDate);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd.setHours(0, 0, 0, 0);

      if (dayDate >= periodStart && dayDate <= periodEnd) {
        return false; // El día está dentro de un período abierto
      }
    }

    return true; // El día no está dentro de ningún período abierto, está cerrado
  };

  // Cargar configuración de precios dinámicos
  useEffect(() => {
    const loadDynamicPricingConfig = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
        const response = await fetch(`${API_URL}/dynamic-pricing/config/default-hotel`);
        const config = await response.json();
        setDynamicPricingConfig(config);
      } catch (error) {
        console.error('Error cargando configuración de precios dinámicos:', error);
      }
    };
    
    loadDynamicPricingConfig();
  }, []);

  // Función para verificar si una fecha es parte de un feriado/fin de semana largo
  const checkIfLongWeekendOrHoliday = async (date) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      
      // Llamar al endpoint del backend que maneja la nueva lógica
      const response = await fetch(`${API_URL}/dynamic-pricing/long-weekend-check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: date.toISOString(),
          hotelId: 'default-hotel'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.isLongWeekendOrHoliday;
      }
    } catch (error) {
      console.error('Error verificando feriado/fin de semana largo:', error);
    }
    return false;
  };

  // Función para obtener el occupancy score de un día
  const getOccupancyScore = async (date) => {
    if (!dynamicPricingConfig?.enabled) return null;
    
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      
      // Normalizar fechas a medianoche para evitar problemas de hora
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      
      const daysUntilDate = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
      

      
      // Usar configuración de días de fin de semana desde el backend
      const weekendDays = dynamicPricingConfig?.weekendDays || [0, 6]; // Por defecto: domingo y sábado
      const isWeekend = weekendDays.includes(getDay(date));
      const isLongWeekendOrHoliday = await checkIfLongWeekendOrHoliday(date); // Consultar si es feriado/fin de semana largo
      
      const requestBody = {
        date: date.toISOString(),
        hotelId: 'default-hotel',
        daysUntilDate,
        currentOccupancy: 50, // Por ahora hardcodeado
        isWeekend,
        isHoliday: isLongWeekendOrHoliday // Usar la nueva lógica
      };
      

      
      const response = await fetch(`${API_URL}/dynamic-pricing/occupancy-score`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      if (response.ok) {
        const data = await response.json();

        return data.occupancyScore;
      }
    } catch (error) {
      console.error('Error obteniendo occupancy score:', error);
    }
    
    return null;
  };

  // Cargar occupancy scores para todos los días
  useEffect(() => {
    if (dynamicPricingConfig?.enabled) {
      const loadOccupancyScores = async () => {
        const scores = {};
        for (const day of days) {
          const score = await getOccupancyScore(day);
          if (score !== null) {
            scores[day.toISOString()] = score;
          }
        }
        setOccupancyScores(scores);
      };
      
      loadOccupancyScores();
    }
  }, [dynamicPricingConfig, days]);

  function handleScroll() {
    if (!containerRef.current) return;
  
    const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
  
    // Solo procesar scroll horizontal, ignorar scroll vertical
    // Verificar si hay scroll horizontal significativo
    const horizontalScrollThreshold = 50; // Umbral mínimo para considerar scroll horizontal
    const isHorizontalScroll = Math.abs(scrollLeft) > horizontalScrollThreshold;
    
    if (!isHorizontalScroll) return;
  
    // Si estás cerca del borde derecho (últimos 200px)
    if (scrollLeft + clientWidth >= scrollWidth - 200) {
      setEndDate(prev => {
        const newEndDate = addDays(prev, 30);
        const newDays = getDaysArray(startDate, newEndDate);
        setDays(newDays);
        setMonths(groupDaysByMonth(newDays));
        return newEndDate;
      });
    }
  
    // Si estás cerca del borde izquierdo (primeros 200px)
    if (scrollLeft <= 200) {
      setStartDate(prev => {
        const newStartDate = addDays(prev, -30);
        const newDays = getDaysArray(newStartDate, endDate);
        setDays(newDays);
        setMonths(groupDaysByMonth(newDays));
        
        // Ajustar el scroll position para compensar los días agregados al inicio
        // Esto mantiene la posición visual relativa
        setTimeout(() => {
          if (containerRef.current) {
            const daysAdded = 30;
            const newScrollLeft = scrollLeft + (daysAdded * cellWidth);
            containerRef.current.scrollLeft = newScrollLeft;
          }
        }, 0);
        
        return newStartDate;
      });
    }
  }

  function handleMonthClick(month) {
    // TODO: Implementar navegación a estadísticas del mes
    console.log('Click en mes:', format(month, 'MMMM yyyy', { locale: es }));
    // Aquí irá la lógica para redirigir a estadísticas
  }

  function handleReservationClick(reservation) {
    // Prevenir que se abra el panel si acabamos de hacer resize
    if (justFinishedResize) {
      console.log('Click ignorado porque acabamos de hacer resize');
      return;
    }
    
    if (onReservationClick) onReservationClick(reservation);
  }

  function handleResize(reservationId, updateData) {
    console.log('handleResize llamado:', reservationId, updateData);
    setResizingReservation(reservationId);
    setResizeData(updateData);
    setReservations(prev => prev.map(reservation =>
      reservation.id === reservationId
        ? { ...reservation, ...updateData }
        : reservation
    ));
  }

  function handleResizeEnd(reservationId, updateData) {
    if (reservationId && updateData) {
      console.log('Fin resize. Nueva fecha de finalización:', updateData.checkOut);
      updateReservation(reservationId, updateData);
      setResizingReservation(null);
      setResizeData(null);
    }
  }

  function handleDragStart(e, reservation, offset) {
    console.log('Iniciando drag de reserva:', reservation.id, 'con offset:', offset);
    setDraggedReservation(reservation);
    setDragOffset(offset);
  }

  function handleDragEnd(reservation) {
    console.log('Finalizando drag de reserva:', reservation.id);
    setDragPreview(null);
    setDraggedReservation(null);
    setDragOffset(0);
  }

  function handleDragOver(e) {
    e.preventDefault();
    
    if (!draggedReservation) {
      console.log('No hay reserva arrastrada');
      return;
    }
    
    console.log('Drag over con reserva:', draggedReservation.id, 'offset:', dragOffset);
    
    // Obtener la posición del mouse considerando ambos scrolls
    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft;
    const scrollTop = containerRef.current.scrollTop;
    const x = e.clientX - rect.left + scrollLeft;
    const y = e.clientY - rect.top + scrollTop;
    
    // Calcular la nueva posición con snap
    const relativeX = x - roomColumnWidth;
    const dayIndex = Math.max(0, Math.round(relativeX / cellWidth));
    const roomIndex = Math.max(0, Math.floor((y - headerHeight) / cellHeight));
    
    const newStartDate = addDays(startDate, dayIndex);
    const newRoom = rooms[roomIndex];
    
    console.log(`Posición: x=${x}, y=${y}, dayIndex=${dayIndex}, roomIndex=${roomIndex}`);
    console.log(`Cálculo detallado: relativeX=${relativeX}, cellWidth=${cellWidth}, startDate=${startDate.toISOString()}`);
    
    if (newRoom) {
      // Calcular la duración de la reserva original
      const checkIn = new Date(draggedReservation.checkIn);
      const checkOut = new Date(draggedReservation.checkOut);
      const duration = differenceInDays(checkOut, checkIn);
      
      // Calcular las nuevas fechas considerando el offset del drag
      // El día donde hiciste click debe posicionarse donde está el cursor
      const newCheckIn = addDays(newStartDate, -dragOffset);
      const newCheckOut = addDays(newCheckIn, duration);
      
      console.log(`Cálculo fechas: newStartDate=${newStartDate.toISOString()}, dragOffset=${dragOffset}, newCheckIn=${newCheckIn.toISOString()}`);
      console.log(`Nueva posición: habitación=${newRoom.name}, fecha=${newCheckIn.toISOString()}, offset aplicado=${dragOffset}`);
      console.log(`Lógica: click en día ${dragOffset} de la barra → se posiciona en ${newStartDate.toISOString()}`);
      console.log(`Resultado: el día ${dragOffset} de la barra original se posiciona en ${newCheckIn.toISOString()}`);
      
      // Actualizar la preview
      setDragPreview({
        reservation: draggedReservation,
        roomIndex,
        checkIn: newCheckIn.toISOString(),
        checkOut: newCheckOut.toISOString(),
        roomId: newRoom.id,
        roomName: newRoom.name
      });
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    
    if (dragPreview) {
      console.log(`Moviendo reserva ${dragPreview.reservation.id} a habitación ${dragPreview.roomName} en fecha ${dragPreview.checkIn}`);
      
      // Actualizar la reserva usando la información de la preview
      updateReservation(dragPreview.reservation.id, {
        roomId: dragPreview.roomId,
        checkIn: dragPreview.checkIn,
        checkOut: dragPreview.checkOut
      });
      
      setDragPreview(null); // Limpiar preview
    }
  }

  // Función para centrar la grilla en el día de hoy
  function centerOnToday() {
    if (containerRef.current) {
      const todayIndex = days.findIndex(day => 
        format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
      );
      if (todayIndex !== -1) {
        const scrollPosition = (todayIndex * cellWidth) - (containerRef.current.clientWidth / 2) + (cellWidth / 2);
        containerRef.current.scrollLeft = Math.max(0, scrollPosition);
      }
    }
  }

  // Centrar la grilla después de que se carguen los datos
  useEffect(() => {
    if (rooms.length > 0 && containerRef.current && isInitialLoad) {
      setTimeout(() => {
        centerOnToday();
        setIsInitialLoad(false); // Marcar que ya no es la carga inicial
      }, 100);
    }
  }, [rooms, isInitialLoad]);

  // Función para medir el ancho y alto real de las celdas después de que se renderice la tabla
  function measureCellDimensions() {
    // Usar valores fijos que coincidan con el CSS
    const fixedWidth = 50;
    const fixedHeight = 30;
    setCellWidth(fixedWidth);
    setCellHeight(fixedHeight);
    console.log('Dimensiones fijas:', { width: fixedWidth, height: fixedHeight });
  }

  // Función para medir la altura real de los headers
  function measureHeaderHeight() {
    if (tableRef.current && containerRef.current) {
      const thead = tableRef.current.querySelector('thead');
      const tbody = tableRef.current.querySelector('tbody');
      
      if (thead && tbody) {
        // Medir la altura del thead
        const theadHeight = thead.offsetHeight;
        
        // Ahora las barras se posicionan relativas al contenedor directamente
        // No necesitamos agregar el margen del contenedor
        setHeaderHeight(theadHeight);
        console.log('Altura real de headers:', {
          theadHeight
        })
      }
    }
  }

  useEffect(() => {
    if (tableRef.current && rooms.length > 0) {
      setTimeout(() => {
        measureCellDimensions();
        measureHeaderHeight();
      }, 200);
    }
  }, [rooms, days]);

  useEffect(() => {
    // Medir dimensiones cuando el componente se monte
    setTimeout(() => {
      measureCellDimensions();
      measureHeaderHeight();
    }, 100);
  }, []);

  useEffect(() => {
    // Escuchar mouseup global para detectar fin de resize
    function onMouseUp() {
      handleResizeEnd(resizingReservation, resizeData);
    }
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, [resizingReservation, resizeData]);

  // Handler para iniciar resize desde ReservationBar
  function handleResizeStart(reservationId, direction) {
    setIsResizing(true);
    setResizeDirection(direction);
    setResizeReservationId(reservationId);
  }

  // Handler global para mousemove
  function handleGlobalMouseMove(e) {
    console.log('handleGlobalMouseMove llamado');
    if (!isResizing || !resizeReservationId || !resizeDirection) return;
    const bar = document.getElementById(`reservation-bar-${resizeReservationId}`);
    if (!bar) return;
    // Usar el contenedor de la grilla para calcular la posición absoluta
    const gridRect = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft;
    const x = e.clientX - gridRect.left + scrollLeft;
    const roomColumnWidth = 120;
    // Calcular dayIndex relativo al inicio de la grilla
    const dayIndex = Math.round((x - roomColumnWidth) / cellWidth);
    const startDateObj = new Date(bar.dataset.startdate);
    const newDate = addDays(startDateObj, dayIndex);
    const currentCheckIn = new Date(bar.dataset.checkin);
    const currentCheckOut = new Date(bar.dataset.checkout);
    const minDuration = 1;
    if (resizeDirection === 'left') {
      const maxCheckIn = subDays(currentCheckOut, minDuration);
      console.log('[LEFT] newDate:', newDate, 'maxCheckIn:', maxCheckIn, 'startDateObj:', startDateObj);
      if (newDate < maxCheckIn && newDate >= startDateObj) {
        console.log('[LEFT] Condición cumplida, llamando a handleResize');
        handleResize(resizeReservationId, {
          roomId: reservations.find(r => r.id === resizeReservationId)?.roomId,
          checkIn: newDate.toISOString(),
          checkOut: currentCheckOut.toISOString()
        });
      } else {
        console.log('[LEFT] Condición NO cumplida');
      }
    } else if (resizeDirection === 'right') {
      const minCheckOut = addDays(currentCheckIn, minDuration);
      console.log('[RIGHT] newDate:', newDate, 'minCheckOut:', minCheckOut, 'currentCheckIn:', currentCheckIn);
      if (newDate >= minCheckOut) {
        console.log('[RIGHT] Condición cumplida, llamando a handleResize');
        handleResize(resizeReservationId, {
          roomId: reservations.find(r => r.id === resizeReservationId)?.roomId,
          checkIn: currentCheckIn.toISOString(),
          checkOut: newDate.toISOString()
        });
      } else {
        console.log('[RIGHT] Condición NO cumplida');
      }
    }
  }

  // Handler global para mouseup
  function handleGlobalMouseUp() {
    console.log('handleGlobalMouseUp llamado');
    console.log('resizingReservation:', resizingReservationRef.current, 'resizeData:', resizeDataRef.current);
    if (isResizing) {
      setIsResizing(false);
      setResizeDirection(null);
      setResizeReservationId(null);
      setJustFinishedResize(true); // Marcar que acabamos de hacer resize
      handleResizeEnd(resizingReservationRef.current, resizeDataRef.current);
      
      // Limpiar la bandera después de un delay
      setTimeout(() => {
        setJustFinishedResize(false);
      }, 200);
    }
  }

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isResizing, resizeDirection, resizeReservationId]);

  useEffect(() => {
    resizingReservationRef.current = resizingReservation;
  }, [resizingReservation]);

  useEffect(() => {
    resizeDataRef.current = resizeData;
  }, [resizeData]);

  function handleDayClick(day) {
    setSelectedDate(day);
    setIsDayInfoPanelOpen(true);
  }

  function handleDayInfoPanelClose() {
    setIsDayInfoPanelOpen(false);
    setSelectedDate(null);
  }

  function handleCreateReservationClick() {
    setIsCreateReservationPanelOpen(true);
  }

  function handleCreateReservationPanelClose() {
    setIsCreateReservationPanelOpen(false);
  }

  async function handleCreateReservation(newReservation) {
    try {
      let mainClientId = newReservation.mainClient.id;
      
      // Si el cliente no tiene ID, significa que es un cliente nuevo
      if (!mainClientId) {
        // Crear el cliente primero
        const clientData = {
          firstName: newReservation.mainClient.firstName,
          lastName: newReservation.mainClient.lastName,
          email: newReservation.mainClient.email,
          phone: newReservation.mainClient.phone,
          documentType: newReservation.mainClient.documentType,
          documentNumber: newReservation.mainClient.documentNumber
        };
        
        const createdClient = await createClient(clientData);
        mainClientId = createdClient.id;
        console.log('Nuevo cliente creado:', createdClient);
      }

      // Preparar los datos para la reserva
      const reservationData = {
        roomId: parseInt(newReservation.roomId),
        mainClientId: parseInt(mainClientId),
        checkIn: newReservation.checkIn,
        checkOut: newReservation.checkOut,
        notes: newReservation.notes,
        status: 'active',
        reservationType: newReservation.reservationType || 'con_desayuno',
        totalAmount: newReservation.totalAmount || 0, // Usar el monto calculado al crear la reserva
        requiredGuests: newReservation.requiredGuests,
        requiredRoomId: newReservation.requiredRoomId,
        requiredTags: newReservation.requiredTags,
        requirementsNotes: newReservation.requirementsNotes
      };

      // Crear la reserva en el backend
      const createdReservation = await createReservation(reservationData);
      
      // Agregar la nueva reserva al estado local
      setReservations(prev => [...prev, createdReservation]);
      
      console.log('Nueva reserva creada exitosamente:', createdReservation);
      
      // Cerrar el panel
      setIsCreateReservationPanelOpen(false);
      
    } catch (error) {
      console.error('Error al crear la reserva:', error);
      // Aquí podrías mostrar un mensaje de error al usuario
      alert('Error al crear la reserva. Por favor, inténtalo de nuevo.');
    }
  }

  // Función optimizada para manejar hover sin re-renders
  const handleCellHover = (roomIndex, colIndex) => {
    if (!tableRef.current) return;
    
    // Limpiar estilos anteriores de manera más eficiente
    const allCells = tableRef.current.querySelectorAll('td, th');
    const cellsToReset = [];
    allCells.forEach(cell => {
      if (cell.classList.contains(styles['data-highlight']) || 
          cell.classList.contains(styles['room-highlight']) || 
          cell.classList.contains(styles['header-highlight'])) {
        cellsToReset.push(cell);
      }
    });
    
    // Aplicar reset en batch
    cellsToReset.forEach(cell => {
      cell.classList.remove(styles['data-highlight'], styles['room-highlight'], styles['header-highlight']);
    });
    
    // Recolectar todas las celdas a marcar de una vez usando selectores más eficientes
    const cellsToHighlight = [];
    
    // Marcar columna hacia arriba usando un selector más eficiente
    const columnCells = tableRef.current.querySelectorAll(`td[data-room-index][data-col-index="${colIndex}"]`);
    columnCells.forEach(cell => {
      const cellRoomIndex = parseInt(cell.getAttribute('data-room-index'));
      if (cellRoomIndex <= roomIndex) {
        cellsToHighlight.push({ cell, type: 'data' });
      }
    });
    
    // Marcar fila hacia la izquierda usando un selector más eficiente
    const rowCells = tableRef.current.querySelectorAll(`td[data-room-index="${roomIndex}"][data-col-index]`);
    rowCells.forEach(cell => {
      const cellColIndex = parseInt(cell.getAttribute('data-col-index'));
      if (cellColIndex <= colIndex) {
        cellsToHighlight.push({ cell, type: 'data' });
      }
    });
    
    // Marcar nombre de habitación
    const roomNameCell = tableRef.current.querySelector(`td[data-room-index="${roomIndex}"]:not([data-col-index])`);
    if (roomNameCell) {
      cellsToHighlight.push({ cell: roomNameCell, type: 'room' });
    }
    
    // Marcar header de la columna
    const headerCell = tableRef.current.querySelector(`th[data-col-index="${colIndex}"]`);
    if (headerCell) {
      cellsToHighlight.push({ cell: headerCell, type: 'header' });
    }
    
    // Aplicar estilos en batch usando un Map para evitar duplicados
    const uniqueCells = new Map();
    cellsToHighlight.forEach(({ cell, type }) => {
      if (!uniqueCells.has(cell)) {
        uniqueCells.set(cell, type);
      }
    });
    
    uniqueCells.forEach((type, cell) => {
      switch (type) {
        case 'data':
          cell.classList.add(styles['data-highlight']);
          break;
        case 'room':
          cell.classList.add(styles['room-highlight']);
          break;
        case 'header':
          cell.classList.add(styles['header-highlight']);
          break;
      }
    });
  };

  const handleCellLeave = () => {
    if (!tableRef.current) return;
    
    // Limpiar solo las celdas que tienen clases de hover
    const cellsWithHighlight = tableRef.current.querySelectorAll(
      `td.${styles['data-highlight']}, td.${styles['room-highlight']}, th.${styles['header-highlight']}`
    );
    
    cellsWithHighlight.forEach(cell => {
      cell.classList.remove(styles['data-highlight'], styles['room-highlight'], styles['header-highlight']);
    });
  };

  // Función para manejar hover de reservas
  const handleReservationHover = (hoverData) => {
    if (!tableRef.current) return;
    
    // Limpiar estilos anteriores
    handleCellLeave();
    
    const { rowIndex, startColIndex, endColIndex } = hoverData;
    
    // Recolectar todas las celdas a marcar
    const cellsToHighlight = [];
    
    // Marcar todas las columnas de la reserva hacia arriba
    for (let col = startColIndex; col <= endColIndex; col++) {
      for (let row = 0; row <= rowIndex; row++) {
        const cell = tableRef.current.querySelector(`td[data-room-index="${row}"][data-col-index="${col}"]`);
        if (cell) {
          cellsToHighlight.push({ cell, type: 'data' });
        }
      }
    }
    
    // Marcar la fila hacia la izquierda (desde el inicio hasta el final de la reserva)
    for (let col = 0; col <= endColIndex; col++) {
      const cell = tableRef.current.querySelector(`td[data-room-index="${rowIndex}"][data-col-index="${col}"]`);
      if (cell) {
        cellsToHighlight.push({ cell, type: 'data' });
      }
    }
    
    // Marcar nombre de habitación
    const roomNameCell = tableRef.current.querySelector(`td[data-room-index="${rowIndex}"]:not([data-col-index])`);
    if (roomNameCell) {
      cellsToHighlight.push({ cell: roomNameCell, type: 'room' });
    }
    
    // Marcar headers de las columnas de la reserva
    for (let col = startColIndex; col <= endColIndex; col++) {
      const headerCell = tableRef.current.querySelector(`th[data-col-index="${col}"]`);
      if (headerCell) {
        cellsToHighlight.push({ cell: headerCell, type: 'header' });
      }
    }
    
    // Aplicar estilos en batch
    cellsToHighlight.forEach(({ cell, type }) => {
      switch (type) {
        case 'data':
          cell.classList.add(styles['data-highlight']);
          break;
        case 'room':
          cell.classList.add(styles['room-highlight']);
          break;
        case 'header':
          cell.classList.add(styles['header-highlight']);
          break;
      }
    });
    
  };

  const handleReservationLeave = () => {
    handleCellLeave();
  };

  // Función para manejar el click en el score de ocupación
  const handleOccupancyScoreClick = async (date) => {
    console.log('Click en score de ocupación para fecha:', date);
    try {
      const occupancyScore = occupancyScores[date.toISOString()];
      console.log('Occupancy score encontrado:', occupancyScore);
      if (occupancyScore !== undefined) {
        console.log('Obteniendo información detallada...');
        
        // Normalizar fechas a medianoche para evitar problemas de hora
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);
        
        const daysUntilDate = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
        
        console.log('=== DEBUG Frontend handleOccupancyScoreClick ===');
        console.log('Fecha original:', date);
        console.log('Fecha normalizada:', targetDate);
        console.log('Hoy normalizado:', today);
        console.log('Días calculados:', daysUntilDate);
        
        // Usar configuración de días de fin de semana desde el backend
        const weekendDays = dynamicPricingConfig?.weekendDays || [0, 6]; // Por defecto: domingo y sábado
        const isWeekend = weekendDays.includes(getDay(date));
        const isLongWeekendOrHoliday = await checkIfLongWeekendOrHoliday(date); // Consultar si es feriado/fin de semana largo
        
        const requestBody = {
          date: date.toISOString(),
          hotelId: 'default-hotel',
          daysUntilDate,
          currentOccupancy: 0.5, // Valor por defecto
          isWeekend,
          isHoliday: isLongWeekendOrHoliday // Usar la nueva lógica
        };
        
        console.log('Request body para detailed score:', requestBody);
        
        // Obtener información detallada del score
        const detailedData = await getDetailedOccupancyScore(requestBody);
        
        console.log('Información detallada obtenida:', detailedData);
        console.log('=== FIN DEBUG Frontend handleOccupancyScoreClick ===\n');
        
        setSelectedOccupancyData(detailedData);
        setSelectedOccupancyDate(date);
        setIsOccupancyModalOpen(true);
        console.log('Modal abierto');
      } else {
        console.log('No hay occupancy score para esta fecha');
      }
    } catch (error) {
      console.error('Error al obtener información detallada del score:', error);
    }
  };

  // Función para cerrar el modal de ocupación
  const handleCloseOccupancyModal = () => {
    setIsOccupancyModalOpen(false);
    setSelectedOccupancyData(null);
    setSelectedOccupancyDate(null);
  };

  return (
    <>
      <div 
        className={styles.reservationGridContainer} 
        ref={containerRef} 
        onScroll={handleScroll}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        style={{
          overflow: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: '#c1c1c1 #f1f1f1'
        }}
      >
        <table className={styles.reservationGridTable} ref={tableRef}>
          <thead>
            <tr>
              <th className={styles.roomHeader}></th>
              {months.map((monthData, index) => (
                <th 
                  key={index}
                  className={styles.monthHeader} 
                  colSpan={monthData.colSpan}
                  onClick={() => handleMonthClick(monthData.month)}
                >
                  {format(monthData.month, 'MMMM yyyy', { locale: es })}
                </th>
              ))}
            </tr>
            <tr>
              <th></th>
              {days.map((day, colIndex) => {
                const isSunday = getDay(day) === 0; // 0 = domingo
                const isClosed = isDayClosed(day);
                return (
                  <th 
                    key={day.toISOString()} 
                    className={`${styles.dayHeader} ${isSunday ? styles.sunday : ''} ${isClosed ? styles.closedDay : ''}`}
                    data-col-index={colIndex}
                    style={{ width: '50px', minWidth: '50px', boxSizing: 'border-box' }}
                    onClick={() => handleDayClick(day)}
                  >
                    {format(day, 'd')}
                  </th>
                );
              })}
            </tr>
            {dynamicPricingConfig?.enabled && (
              <tr>
                <th className={styles.occupancyHeader}>Ocupación</th>
                {days.map((day, colIndex) => {
                  const occupancyScore = occupancyScores[day.toISOString()];
                  const isClosed = isDayClosed(day);
                  return (
                    <th 
                      key={`occupancy-${day.toISOString()}`}
                      className={`${styles.occupancyCell} ${isClosed ? styles.closedDay : ''}`}
                      data-col-index={colIndex}
                      style={{ 
                        width: '50px', 
                        minWidth: '50px', 
                        boxSizing: 'border-box',
                        fontSize: '10px',
                        padding: '2px'
                      }}
                    >
                      {occupancyScore !== undefined ? (
                        <span 
                          style={{
                            fontWeight: 'bold',
                            fontSize: '12px',
                            color: occupancyScore > 0.7 ? '#dc3545' : occupancyScore > 0.5 ? '#ffc107' : '#28a745',
                            cursor: 'pointer'
                          }}
                          onClick={() => handleOccupancyScoreClick(day)}
                          title="Click para ver detalles del score"
                        >
                          {Math.round(occupancyScore * 100)}%
                        </span>
                      ) : (
                        <span style={{ color: '#6c757d', fontSize: '10px' }}>...</span>
                      )}
                    </th>
                  );
                })}
              </tr>
            )}
          </thead>
          <tbody>
            {rooms.map((room, roomIndex) => (
              <tr key={room.id}>
                <td className={styles.roomNameCell} data-room-index={roomIndex}>
                  <strong>{room.name}</strong>
                </td>
                {days.map((day, colIndex) => {
                  const isClosed = isDayClosed(day);
                  return (
                    <td
                      key={day.toISOString()}
                      className={`${styles.reservationCellFree} ${isClosed ? styles.closedCell : ''}`}
                      data-room-index={roomIndex}
                      data-col-index={colIndex}
                      style={{ 
                        width: '50px', 
                        minWidth: '50px', 
                        height: '30px', 
                        padding: '0', 
                        boxSizing: 'border-box' 
                      }}
                      onMouseEnter={() => handleCellHover(roomIndex, colIndex)}
                      onMouseLeave={handleCellLeave}
                    >
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className={styles.reservationBarsContainer} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
          {/* Barras de reservas */}

          {rooms.map((room, roomIndex) => {
            const roomReservations = reservations.filter(res => res.roomId === room.id);
            return roomReservations.map((reservation) => {
              let displayReservation = reservation;
              if (resizingReservation === reservation.id && resizeData) {
                displayReservation = { ...reservation, ...resizeData };
              }
              return (
                <ReservationBar
                  key={`${room.id}-${reservation.id}`}
                  id={`reservation-bar-${reservation.id}`}
                  reservation={displayReservation}
                  roomIndex={roomIndex}
                  cellWidth={cellWidth}
                  cellHeight={cellHeight}
                  startDate={startDate}
                  headerHeight={headerHeight}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onClick={handleReservationClick}
                  onResizeStart={handleResizeStart}
                  isResizing={isResizing && resizeReservationId === reservation.id}
                  justFinishedResize={justFinishedResize}
                  onReservationHover={handleReservationHover}
                  onReservationLeave={handleReservationLeave}
                />
              );
            });
          })}
          
          {/* Preview de drag and drop */}
          {dragPreview && (
            <div
              className={styles.dragPreview}
              style={{
                position: 'absolute',
                left: `${roomColumnWidth + ((() => {
                  const checkIn = new Date(dragPreview.checkIn);
                  const checkInStr = format(checkIn, 'yyyy-MM-dd');
                  const days = [];
                  let currentDate = new Date(startDate);
                  for (let i = 0; i < 100; i++) {
                    days.push(format(currentDate, 'yyyy-MM-dd'));
                    currentDate.setDate(currentDate.getDate() + 1);
                  }
                  return days.indexOf(checkInStr);
                })() * cellWidth)}px`,
                top: `${headerHeight + (dragPreview.roomIndex * cellHeight)}px`,
                width: `${differenceInDays(new Date(dragPreview.checkOut), new Date(dragPreview.checkIn)) * cellWidth}px`,
                height: `${cellHeight}px`,
                backgroundColor: 'rgba(52, 152, 219, 0.3)',
                border: '2px dashed #3498db',
                borderRadius: '3px',
                zIndex: 15,
                pointerEvents: 'none',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: '0.7rem',
                fontWeight: 'bold',
                color: '#2980b9'
              }}
            >
              <div>{dragPreview.reservation.mainClient?.firstName} {dragPreview.reservation.mainClient?.lastName}</div>
            </div>
          )}
        </div>
      </div>

      {/* Panel de información del día */}
      <DayInfoSidePanel
        selectedDate={selectedDate}
        rooms={rooms}
        reservations={reservations}
        isOpen={isDayInfoPanelOpen}
        onClose={handleDayInfoPanelClose}
      />

      {/* Botón flotante para crear nueva reserva */}
      <FloatingAddButton onClick={handleCreateReservationClick} />

      {/* Panel de creación de reservas */}
      <CreateReservationPanel
        isOpen={isCreateReservationPanelOpen}
        onClose={handleCreateReservationPanelClose}
        onCreateReservation={handleCreateReservation}
        operationalPeriods={operationalPeriods}
      />

      {/* Modal de detalles del score de ocupación */}
      <OccupancyScoreModal
        isOpen={isOccupancyModalOpen}
        onClose={handleCloseOccupancyModal}
        occupancyData={selectedOccupancyData}
        date={selectedOccupancyDate}
      />
    </>
  );
}