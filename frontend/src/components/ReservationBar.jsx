import { useState, useRef, useCallback } from 'react';
import { differenceInDays } from 'date-fns';
import '../styles/ReservationBar.css';

export default function ReservationBar({ 
  reservation, 
  segment,
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
  onReservationLeave,
  getCellPosition,
  hoveredReservationId
}) {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef();
  
  // Usar las fechas del segmento en lugar de las de la reserva
  const checkIn = new Date(segment.startDate);
  const checkOut = new Date(segment.endDate);
  
  // Normalizar las fechas para evitar problemas de zona horaria usando zona horaria local
  checkIn.setHours(0, 0, 0, 0);
  checkOut.setHours(0, 0, 0, 0);
  
  // Usar el ancho fijo de la columna de habitaciones del CSS
  const roomColumnWidth = 140; // Actualizado para coincidir con el CSS
  
  // Encontrar el índice del día en el array de días usando comparación de timestamps
  const days = [];
  let currentDate = new Date(startDate);
  currentDate.setHours(0, 0, 0, 0);
  
  for (let i = 0; i < 100; i++) { // Generar suficientes días
    days.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  const daysFromStart = days.findIndex(day => 
    day.getFullYear() === checkIn.getFullYear() &&
    day.getMonth() === checkIn.getMonth() &&
    day.getDate() === checkIn.getDate()
  );
  const duration = differenceInDays(checkOut, checkIn);
  
  // DEBUG: Verificar el cálculo de daysFromStart
  // if (reservation.id === 1) {
  //   console.log('🔍 DEBUG DAYS FROM START:', {
  //     startDate: startDate.toISOString(),
  //     checkIn: checkIn.toISOString(),
  //     daysGenerated: days.length,
  //     firstDay: days[0]?.toISOString(),
  //     lastDay: days[days.length - 1]?.toISOString(),
  //     daysFromStart,
  //     daysArray: days.slice(0, 10).map(d => d.toISOString().split('T')[0]) // Primeros 10 días
  //   });
  // }
  
  // Calcular posición usando valores fijos del CSS en lugar de consultas al DOM
  // Considerar el margen del contenedor principal (1rem = 16px)
  const containerMargin = 16;
  const left = containerMargin + roomColumnWidth + (daysFromStart * cellWidth);
  
  // DEBUG: Mostrar el cálculo corregido
  // if (reservation.id === 1) {
  //   console.log('🎯 CÁLCULO CORREGIDO:', {
  //     containerMargin,
  //     roomColumnWidth,
  //     cellWidth,
  //     daysFromStart,
  //     calculo: `${containerMargin} + ${roomColumnWidth} + (${daysFromStart} * ${cellWidth}) = ${left}`,
  //     leftFinal: left
  //   });
  // }
  
  const width = duration * cellWidth;
  // Simplificar el cálculo del top - usar solo la altura de los headers + el índice de la habitación
  const top = headerHeight + (roomIndex * cellHeight);

  // Usar getCellPosition si está disponible para un posicionamiento más preciso
  let finalLeft = left;
  let finalTop = top;
  
  if (getCellPosition && daysFromStart >= 0) {
    const cellPos = getCellPosition(roomIndex, daysFromStart);
    if (cellPos.left > 0) {
      finalLeft = cellPos.left;
      finalTop = cellPos.top;
      // console.log('🎯 USANDO POSICIÓN REAL DE CELDA:', {
      //   reservationId: reservation.id,
      //   cellPos,
      //   finalLeft,
      //   finalTop
      // });
    }
  }

  // DEBUG: Mostrar todos los valores de posicionamiento para todas las reservas
  // console.log('🔍 DEBUG POSICIONAMIENTO:', {
  //   reservationId: reservation.id,
  //   checkIn: checkIn.toISOString(),
  //   checkOut: checkOut.toISOString(),
  //   startDate: startDate.toISOString(),
  //   daysFromStart,
  //   roomIndex,
  //   containerMargin,
  //   roomColumnWidth,
  //   cellWidth,
  //   cellHeight,
  //   headerHeight,
  //   left,
  //   top,
  //   width,
  //   duration
  // });

  // Memoizar los cálculos de hover para evitar recálculos innecesarios
  const hoverData = useCallback(() => {
    const startColIndex = daysFromStart;
    const endColIndex = startColIndex + duration - 1;
    
    return {
      reservation,
      segment,
      rowIndex: roomIndex,
      startColIndex,
      endColIndex
    };
  }, [daysFromStart, duration, roomIndex, reservation, segment]);

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

  // Validar que se encontró la fecha después de los hooks
  if (daysFromStart === -1) {
    console.error('❌ ERROR: No se pudo encontrar la fecha de check-in en el array de días:', {
      checkIn: checkIn.toISOString(),
      startDate: startDate.toISOString(),
      reservationId: reservation.id,
      status: reservation.status
    });
    
    // Debug adicional para la reserva 978
    if (reservation.id === 978) {
      console.log('🔍 DEBUG RESERVA 978:', {
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        startDate: startDate.toISOString(),
        daysGenerated: days.length,
        firstDay: days[0]?.toISOString(),
        lastDay: days[days.length - 1]?.toISOString(),
        daysArray: days.slice(0, 10).map(d => d.toISOString().split('T')[0])
      });
    }
    
    // En lugar de retornar null, mostrar una barra de error
    return (
      <div
        style={{
          position: 'absolute',
          left: `${containerMargin + roomColumnWidth}px`,
          top: `${headerHeight + (roomIndex * cellHeight)}px`,
          width: '200px',
          height: `${cellHeight}px`,
          backgroundColor: '#ff6b6b',
          border: '1px solid #ff4757',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.7rem',
          color: 'white',
          zIndex: 10,
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(255, 107, 107, 0.3)'
        }}
        onClick={() => onClick && onClick(reservation)}
        onMouseEnter={() => onReservationHover && onReservationHover({
          rowIndex: roomIndex,
          startColIndex: 0,
          endColIndex: 0
        })}
        onMouseLeave={() => onReservationLeave && onReservationLeave()}
        title={`Error: Reserva ${reservation.id} fuera del rango visible (${checkIn.toISOString().split('T')[0]} - ${checkOut.toISOString().split('T')[0]})`}
      >
        ⚠️ Fuera de rango
      </div>
    );
  }
  


  // Función para medir el ancho real del texto
  const measureTextWidth = (text, fontSize = '1rem') => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    // Usar la misma fuente que se usa en el CSS (bold para reservation-client)
    context.font = `bold ${fontSize} Arial, sans-serif`;
    const metrics = context.measureText(text);
    
    // DEBUG: Log para María González
    if (text.includes('Maria') || text.includes('Gonzalez')) {
      console.log('🔍 MEDICIÓN TEXTO:', {
        text,
        fontSize,
        width: metrics.width,
        actualBoundingBoxLeft: metrics.actualBoundingBoxLeft,
        actualBoundingBoxRight: metrics.actualBoundingBoxRight,
        fontBoundingBoxAscent: metrics.fontBoundingBoxAscent,
        fontBoundingBoxDescent: metrics.fontBoundingBoxDescent
      });
    }
    
    return metrics.width;
  };

  // Función para truncar nombres largos basada en el ancho real disponible
  const truncateName = (firstName, lastName, barWidth, guestCount = '') => {
    const fullName = `${firstName || ''} ${lastName || ''}`.trim();
    
    if (!fullName) return 'Sin cliente';
    
    // Determinar el tamaño de fuente basado en el ancho de la barra (igual que el CSS)
    let fontSize = '1rem'; // var(--font-size-small)
    if (barWidth < 50) fontSize = '0.8rem';
    if (barWidth < 30) fontSize = '0.7rem';
    
    // Calcular el espacio disponible (dejar margen de 8px)
    let availableWidth = barWidth - 8;
    
    // Si hay contador de huéspedes, reservar espacio para él
    let guestCountSpace = 0;
    if (guestCount) {
      guestCountSpace = measureTextWidth(guestCount, fontSize) + 4; // 4px de margen
      availableWidth -= guestCountSpace;
    }
    
    // Opciones de texto en orden de preferencia
    const options = [
      fullName, // Nombre completo
      lastName || firstName || 'Cliente', // Solo apellido
      firstName || 'Cliente', // Solo nombre
      `${firstName ? firstName[0] : ''}${lastName ? lastName[0] : ''}`.toUpperCase() || 'C', // Iniciales
      firstName ? firstName[0].toUpperCase() : 'C' // Primera inicial
    ];
    
    // DEBUG: Log detallado para María González
    if (firstName === 'Maria' && lastName === 'Gonzalez') {
      console.log('🔍 DEBUG MARÍA GONZÁLEZ:', {
        barWidth,
        availableWidth,
        guestCount,
        guestCountSpace,
        fontSize,
        options: options.map(option => ({
          text: option,
          width: measureTextWidth(option, fontSize),
          fits: measureTextWidth(option, fontSize) <= availableWidth
        }))
      });
    }
    
    // Probar cada opción hasta encontrar una que quepa
    for (const option of options) {
      const textWidth = measureTextWidth(option, fontSize);
      if (textWidth <= availableWidth) {
        return option;
      }
    }
    
    // Si nada cabe, usar la primera inicial
    return firstName ? firstName[0].toUpperCase() : 'C';
  };

  // Obtener la cantidad de personas (huéspedes + cliente principal)
  const totalGuests = (reservation.guests?.length || 0) + 1; // +1 por el cliente principal
  const guestCount = `x${totalGuests}`;
  
  // Determinar si hay espacio para mostrar el contador de personas
  const hasSpaceForGuestCount = width > 80; // Mínimo 80px para mostrar el contador
  
  const clientName = truncateName(
    reservation.mainClient?.firstName, 
    reservation.mainClient?.lastName, 
    width, 
    hasSpaceForGuestCount ? guestCount : ''
  );

  // DEBUG: Verificar dimensiones de la barra
  if (reservation.id === 1) {
    console.log('🔍 DIMENSIONES BARRA:', {
      reservationId: reservation.id,
      width,
      height: `${cellHeight}px (real)`,
      cellHeight,
      clientName,
      barWidth: width,
      firstName: reservation.mainClient?.firstName,
      lastName: reservation.mainClient?.lastName,
      truncateResult: clientName,
      guestCount,
      hasSpaceForGuestCount,
      finalLeft,
      finalTop,
      roomIndex,
      daysFromStart
    });
    
    // Verificar las dimensiones reales del DOM después del render
    setTimeout(() => {
      const barElement = document.getElementById(`reservation-bar-${reservation.id}`);
      if (barElement) {
        const rect = barElement.getBoundingClientRect();
        console.log('🔍 DIMENSIONES REALES DOM:', {
          reservationId: reservation.id,
          offsetHeight: barElement.offsetHeight,
          clientHeight: barElement.clientHeight,
          scrollHeight: barElement.scrollHeight,
          getBoundingClientRect: {
            height: rect.height,
            width: rect.width,
            top: rect.top,
            left: rect.left
          },
          computedStyle: {
            height: window.getComputedStyle(barElement).height,
            width: window.getComputedStyle(barElement).width,
            padding: window.getComputedStyle(barElement).padding,
            border: window.getComputedStyle(barElement).border
          }
        });
      }
    }, 100);
  }

  return (
    <div
      id={`reservation-bar-${reservation.id}`}
      data-checkin={reservation.checkIn}
      data-checkout={reservation.checkOut}
      data-startdate={startDate?.toISOString() || ''}
      className={`reservation-bar reservation-bar-fixed-height ${isDragging ? 'dragging' : ''} ${hoveredReservationId === reservation.id ? 'hovered' : ''}`}
      style={{
        position: 'absolute',
        left: `${finalLeft}px`,
        top: `${finalTop}px`,
        width: `${width}px`,
        height: `${cellHeight}px`,
        cursor: isResizing ? 'ew-resize' : 'grab',
        zIndex: 5,
        userSelect: 'none',
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