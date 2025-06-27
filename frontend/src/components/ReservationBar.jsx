import { useState, useRef } from 'react';
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
  justFinishedResize
}) {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef();

  // Calcular posición y ancho de la barra
  const checkIn = parseISO(reservation.checkIn);
  const checkOut = parseISO(reservation.checkOut);
  
  const daysFromStart = differenceInDays(checkIn, startDate);
  const duration = differenceInDays(checkOut, checkIn); // Quitado el +1 para corregir el ancho
  
  // Ajustar posiciones considerando headers y columna de habitaciones
  const roomColumnWidth = 120;
  
  const left = roomColumnWidth + (daysFromStart * cellWidth);
  const width = duration * cellWidth;
  const top = headerHeight + (roomIndex * cellHeight) - 1;

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
  const truncateName = (firstName, lastName, barWidth) => {
    const fullName = `${firstName || ''} ${lastName || ''}`.trim();
    
    if (!fullName) return 'Sin cliente';
    
    // Calcular anchos de las diferentes opciones
    const fullNameWidth = getTextWidth(fullName, barWidth);
    const lastNameWidth = getTextWidth(lastName || firstName || 'Cliente', barWidth);
    const firstInitial = firstName ? firstName[0] : '';
    const lastInitial = lastName ? lastName[0] : '';
    const initials = `${firstInitial}${lastInitial}`.toUpperCase();
    const initialsWidth = getTextWidth(initials, barWidth);
    
    // Dejar un margen de 8px (4px a cada lado)
    const availableWidth = barWidth - 8;
    
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

  const clientName = truncateName(reservation.mainClient?.firstName, reservation.mainClient?.lastName, width);

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
      </div>
    </div>
  );
}