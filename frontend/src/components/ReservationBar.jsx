import { useState, useRef, useCallback } from 'react';
import { parseISO, differenceInDays } from 'date-fns';
import '../styles/ReservationBar.css';

export default function ReservationBar({ 
  reservation, 
  roomIndex, 
  cellWidth, 
  cellHeight, 
  startDate, 
  headerHeight,
  onDragStart, 
  onDragEnd,
  onClick,
  onResizeStart,
  isResizing,
  justFinishedResize,
  onReservationHover,
  onReservationLeave
}) {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef();
  

  


  // Calcular posición y ancho de la barra
  const checkIn = parseISO(reservation.checkIn);
  const checkOut = parseISO(reservation.checkOut);
  
  // Normalizar las fechas para evitar problemas de zona horaria
  checkIn.setUTCHours(0, 0, 0, 0);
  checkOut.setUTCHours(0, 0, 0, 0);
  
  // Ajustar posiciones considerando headers y columna de habitaciones
  const roomColumnWidth = 120;
  

  
  // Encontrar el índice del día en el array de días usando comparación de timestamps
  const days = [];
  let currentDate = new Date(startDate);
  currentDate.setUTCHours(0, 0, 0, 0);
  
  for (let i = 0; i < 100; i++) { // Generar suficientes días
    days.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  const daysFromStart = days.findIndex(day => day.getTime() === checkIn.getTime());
  


  const duration = differenceInDays(checkOut, checkIn);
  
    // Usar las dimensiones reales del DOM
  const firstRoomCell = document.querySelector('td:first-child');
  const realRoomWidth = firstRoomCell?.offsetWidth || roomColumnWidth;
  
  const left = realRoomWidth + (daysFromStart * cellWidth);
  
  // DEBUG: Mostrar el cálculo corregido
  if (reservation.id === 1) {
    console.log('🎯 CÁLCULO CORREGIDO:', {
      realRoomWidth,
      cellWidth,
      daysFromStart,
      calculo: `${realRoomWidth} + (${daysFromStart} * ${cellWidth}) = ${left}`,
      leftFinal: left
    });
  }
  const width = duration * cellWidth;
  const top = headerHeight + (roomIndex * cellHeight) - 1;
  

  

  

  


  // Memoizar los cálculos de hover para evitar recálculos innecesarios
  const hoverData = useCallback(() => {
    const startColIndex = daysFromStart;
    const endColIndex = startColIndex + duration - 1;
    
    return {
      rowIndex: roomIndex,
      startColIndex,
      endColIndex
    };
  }, [daysFromStart, duration, roomIndex]);

  const handleClick = (e) => {
    // Prevenir que se abra el panel si estamos resizing, si el click viene de un resize handle, o si acabamos de hacer resize
    if (isResizing || e.target.classList.contains('resize-handle') || isDragging || justFinishedResize) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    if (onClick) {
      onClick(reservation);
    }
  };

  const handleDragStart = (e) => {
    if (e.target.classList.contains('resize-handle')) {
      e.preventDefault();
      return;
    }
    
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const dragOffset = Math.max(0, Math.min(duration, relativeX / cellWidth));
    
    setIsDragging(true);
    if (onDragStart) {
      onDragStart(e, reservation, dragOffset);
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    if (onDragEnd) {
      onDragEnd(reservation);
    }
  };

  const handleMouseDown = (e, direction) => {
    e.preventDefault();
    e.stopPropagation();
    if (onResizeStart) onResizeStart(reservation.id, direction);
  };

  const handleMouseUp = () => {
    // Limpiar el estado de dragging después de un pequeño delay
    setTimeout(() => {
      setIsDragging(false);
    }, 100);
  };

  const handleMouseEnter = useCallback(() => {
    if (onReservationHover) {
      onReservationHover(hoverData());
    }
  }, [onReservationHover, hoverData]);

  const handleMouseLeave = useCallback(() => {
    if (onReservationLeave) {
      onReservationLeave();
    }
  }, [onReservationLeave]);

  // Función para calcular el ancho aproximado del texto
  const getTextWidth = (text, barWidth) => {
    // Determinar el tamaño de fuente basado en el ancho de la barra
    let fontSize = '0.75rem';
    if (barWidth < 50) fontSize = '0.65rem';
    if (barWidth < 30) fontSize = '0.55rem';
    
    // Crear un elemento temporal para medir el texto
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = fontSize + ' Arial, sans-serif';
    return context.measureText(text).width;
  };

  // Función para truncar nombres largos basada en el ancho real del texto
  const truncateName = (firstName, lastName, barWidth, guestCount = '') => {
    const fullName = `${firstName || ''} ${lastName || ''}`.trim();
    
    if (!fullName) return 'Sin cliente';
    
    // Calcular anchos de las diferentes opciones
    const fullNameWidth = getTextWidth(fullName, barWidth);
    const lastNameWidth = getTextWidth(lastName || firstName || 'Cliente', barWidth);
    const firstInitial = firstName ? firstName[0] : '';
    const lastInitial = lastName ? lastName[0] : '';
    const initials = `${firstInitial}${lastInitial}`.toUpperCase();
    const initialsWidth = getTextWidth(initials, barWidth);
    
    // Dejar un margen de 8px (4px a cada lado) y espacio para el contador si es necesario
    const guestCountWidth = guestCount ? getTextWidth(guestCount, barWidth) + 8 : 0;
    const availableWidth = barWidth - 8 - guestCountWidth;
    
    // Prioridad 1: Nombre completo si cabe
    if (fullNameWidth <= availableWidth) {
      return fullName;
    }
    
    // Prioridad 2: Solo apellido si cabe
    if (lastNameWidth <= availableWidth) {
      return lastName || firstName || 'Cliente';
    }
    
    // Prioridad 3: Iniciales si cabe
    if (initialsWidth <= availableWidth) {
      return initials;
    }
    
    // Si nada cabe, usar iniciales de todos modos
    return initials;
  };

  // Obtener la cantidad de personas (huéspedes + cliente principal)
  const totalGuests = (reservation.guests?.length || 0) + 1; // +1 por el cliente principal
  const guestCount = `x${totalGuests}`;
  
  // Determinar si hay espacio para mostrar el contador de personas
  const hasSpaceForGuestCount = width > 80; // Mínimo 80px para mostrar el contador
  
  const clientName = truncateName(reservation.mainClient?.firstName, reservation.mainClient?.lastName, width, hasSpaceForGuestCount ? guestCount : '');

  return (
    <div
      id={`reservation-bar-${reservation.id}`}
      data-checkin={reservation.checkIn}
      data-checkout={reservation.checkOut}
      data-startdate={startDate.toISOString()}
      className={`reservation-bar ${isDragging ? 'dragging' : ''}`}
      style={{
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${cellHeight}px`,
        backgroundColor: '#f4e4c1',
        border: '1px solid #d4c4a1',
        borderRadius: '3px',
        cursor: isResizing ? 'ew-resize' : 'grab',
        zIndex: 5,
        userSelect: 'none',
        boxShadow: isDragging ? '0 4px 8px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.2)',
        transform: isDragging ? 'scale(1.02)' : 'scale(1)',
        transition: 'transform 0.1s ease',
        opacity: 1
      }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onMouseUp={handleMouseUp}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      draggable={!isResizing}
      ref={containerRef}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          pointerEvents: 'none'
        }}
        draggable={true}
      />
      <div
        className="resize-handle resize-handle-left"
        style={{
          position: 'absolute',
          left: '0',
          top: '0',
          width: '8px',
          height: '100%',
          cursor: 'ew-resize',
          backgroundColor: 'transparent'
        }}
        onMouseDown={(e) => handleMouseDown(e, 'left')}
        onDragStart={(e) => e.stopPropagation()}
        draggable={false}
      />
      <div
        className="resize-handle resize-handle-right"
        style={{
          position: 'absolute',
          right: '0',
          top: '0',
          width: '8px',
          height: '100%',
          cursor: 'ew-resize',
          backgroundColor: 'transparent'
        }}
        onMouseDown={(e) => handleMouseDown(e, 'right')}
        onDragStart={(e) => e.stopPropagation()}
        draggable={false}
      />
      <div className="reservation-client">
        {clientName}
        {hasSpaceForGuestCount && guestCount && (
          <span style={{ 
            marginLeft: '4px', 
            fontSize: 'inherit',
            fontWeight: 'inherit',
            color: 'inherit'
          }}>
            {guestCount}
          </span>
        )}
      </div>
    </div>
  );
}