import { useState, useRef } from 'react';
import { parseISO, differenceInDays } from 'date-fns';
import '../styles/ReservationBar.css';

export default function ReservationBar({ 
  reservation, 
  roomIndex, 
  cellWidth, 
  cellHeight, 
  startDate, 
  roomName,
  onDragStart, 
  onDragEnd,
  onClick,
  onResizeStart,
  isResizing,
  // resizeDirection (no se usa directamente)
}) {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef();


  // Calcular posición y ancho de la barra
  const checkIn = parseISO(reservation.checkIn);
  const checkOut = parseISO(reservation.checkOut);
  
  const daysFromStart = differenceInDays(checkIn, startDate);
  const duration = differenceInDays(checkOut, checkIn);
  
  // Ajustar posiciones considerando headers y columna de habitaciones
  const headerHeight = 70; // Altura de los dos headers (40px del header de meses + 30px del header de días)
  const roomColumnWidth = 120; // Ancho fijo de la columna de habitaciones
  
  const left = roomColumnWidth + (daysFromStart * cellWidth) + cellWidth;
  const width = duration * cellWidth;
  const top = headerHeight + (roomIndex * cellHeight) + 1; // +1 para compensar el offset


  const handleClick = () => {
    if (!isDragging && !isResizing && onClick) {
      onClick(reservation);
    }
  };

  const handleDragStart = (e) => {
    // No permitir drag si estamos en un handle de resize
    if (e.target.classList.contains('resize-handle')) {
      e.preventDefault();
      return;
    }
    
    // Calcular la posición relativa dentro de la barra
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const dragOffset = Math.max(0, Math.min(duration, relativeX / cellWidth)); // Offset en días desde el inicio de la barra
    
    console.log(`Drag start: relativeX=${relativeX}, cellWidth=${cellWidth}, duration=${duration}, dragOffset=${dragOffset} días`);
    
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
    if (direction === 'right') {
      console.log('Inicio resize derecho. Fecha de finalización:', reservation.checkOut);
    } else if (direction === 'left') {
      console.log('Inicio resize izquierdo. Fecha de inicio:', reservation.checkIn);
    }
  };

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
        height: `${cellHeight - 2}px`,
        backgroundColor: '#f4e4c1',
        border: '1px solid #d4c4a1',
        borderRadius: '3px',
        cursor: isResizing ? 'ew-resize' : 'grab',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: '0.7rem',
        fontWeight: 'bold',
        color: '#8b7355',
        userSelect: 'none',
        boxShadow: isDragging ? '0 4px 8px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.2)',
        transform: isDragging ? 'scale(1.02)' : 'scale(1)',
        transition: 'transform 0.1s ease',
        opacity: 1
      }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      draggable={!isResizing}
      ref={containerRef}
    >
      {/* Elemento draggable dummy */}
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
      {/* Handle de resize izquierdo */}
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
      {/* Handle de resize derecho */}
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
        {reservation.mainClient?.firstName} {reservation.mainClient?.lastName}
      </div>
      <div className="reservation-room">
        {roomName}
      </div>
    </div>
  );
} 