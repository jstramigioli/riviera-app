import React, { useEffect, useState, useRef } from 'react';
import { addDays, format, differenceInDays, subDays, getDay } from 'date-fns';
import ReservationBar from './ReservationBar';
import styles from '../styles/ReservationGrid.module.css';

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

export default function ReservationGrid({ rooms, reservations, setReservations, updateReservation, onReservationClick }) {
  const today = new Date();
  const [startDate, setStartDate] = useState(addDays(today, -30));
  const [endDate, setEndDate] = useState(addDays(today, 30));
  const [days, setDays] = useState(getDaysArray(addDays(today, -30), addDays(today, 30)));
  const [months, setMonths] = useState(groupDaysByMonth(getDaysArray(addDays(today, -30), addDays(today, 30))));
  const [cellWidth, setCellWidth] = useState(40); // Ancho inicial, se ajustará dinámicamente
  const [cellHeight, setCellHeight] = useState(25); // Alto inicial, se ajustará dinámicamente
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
  const [hoveredCell, setHoveredCell] = useState(null); // { rowIndex, colIndex }
  const [hoveredReservation, setHoveredReservation] = useState(null); // { rowIndex, startColIndex, endColIndex }
  
  const tableRef = useRef();
  const containerRef = useRef();
  const resizingReservationRef = useRef(null);
  const resizeDataRef = useRef(null);

  // Constantes para el cálculo de posiciones
  const roomColumnWidth = 120;

  function handleScroll() {
    if (!containerRef.current) return;
  
    const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
  
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
        return newStartDate;
      });
    }
  }

  function handleMonthClick(month) {
    // TODO: Implementar navegación a estadísticas del mes
    console.log('Click en mes:', format(month, 'MMMM yyyy'));
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

  function handleReservationHover(reservationData) {
    setHoveredReservation(reservationData);
  }

  function handleReservationLeave() {
    setHoveredReservation(null);
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
    if (rooms.length > 0 && containerRef.current) {
      setTimeout(centerOnToday, 100);
    }
  }, [rooms, days]);

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
        });
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

  return (
    <div 
      className={styles.reservationGridContainer} 
      ref={containerRef} 
      onScroll={handleScroll}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
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
                {format(monthData.month, 'MMMM yyyy')}
              </th>
            ))}
          </tr>
          <tr>
            <th></th>
            {days.map((day, colIndex) => {
              const isSunday = getDay(day) === 0; // 0 = domingo
              const highlightDay = (hoveredCell && colIndex === hoveredCell.colIndex) || 
                                 (hoveredReservation && colIndex >= hoveredReservation.startColIndex && colIndex <= hoveredReservation.endColIndex);
              return (
                <th 
                  key={day.toISOString()} 
                  className={`${styles.dayHeader} ${isSunday ? styles.sunday : ''} ${highlightDay ? styles.highlight : ''}`}
                  style={{ width: '50px', minWidth: '50px', boxSizing: 'border-box' }}
                >
                  {format(day, 'd')}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rooms.map((room, roomIndex) => (
            <tr key={room.id}>
              <td className={`${styles.roomNameCell} ${(hoveredCell && roomIndex === hoveredCell.rowIndex) || (hoveredReservation && roomIndex === hoveredReservation.rowIndex) ? styles.highlight : ''}`}>
                <strong>{room.name}</strong>
              </td>
              {days.map((day, colIndex) => {
                let highlight = false;
                if (hoveredCell) {
                  // Resaltar columna hacia arriba
                  if (colIndex === hoveredCell.colIndex && roomIndex <= hoveredCell.rowIndex) highlight = true;
                  // Resaltar fila hacia la izquierda
                  if (roomIndex === hoveredCell.rowIndex && colIndex <= hoveredCell.colIndex) highlight = true;
                }
                if (hoveredReservation) {
                  // Resaltar rango de columnas de la reserva hacia arriba
                  if (colIndex >= hoveredReservation.startColIndex && colIndex <= hoveredReservation.endColIndex && roomIndex <= hoveredReservation.rowIndex) highlight = true;
                  // Resaltar fila hacia la izquierda
                  if (roomIndex === hoveredReservation.rowIndex && colIndex <= hoveredReservation.endColIndex) highlight = true;
                }
                return (
                  <td
                    key={day.toISOString()}
                    className={
                      styles.reservationCellFree + (highlight ? ' ' + styles.cellHighlight : '')
                    }
                    style={{ 
                      width: '50px', 
                      minWidth: '50px', 
                      height: '30px', 
                      padding: '0', 
                      boxSizing: 'border-box' 
                    }}
                    onMouseEnter={() => setHoveredCell({ rowIndex: roomIndex, colIndex })}
                    onMouseLeave={() => setHoveredCell(null)}
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
                resizeDirection={resizeDirection}
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
              left: `${roomColumnWidth + (differenceInDays(new Date(dragPreview.checkIn), startDate) * cellWidth)}px`,
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
  );
}