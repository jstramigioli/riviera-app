import React, { useRef } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ReservationBar from '../../ReservationBar';
import styles from '../ReservationGrid.module.css';

export default function GridCanvas({
  rooms,
  reservations,
  days,
  months,
  cellWidth,
  cellHeight,
  headerHeight,
  roomColumnWidth,
  dragPreview,
  draggedReservation,
  dragOffset,
  resizingReservation,
  resizeData,
  isResizing,
  resizeDirection,
  resizeReservationId,
  getReservationPosition,
  getReservationWidth,
  getReservationStyle,
  getCellStyle,
  getHeaderStyle,
  onScroll,
  onReservationClick,
  onDayClick,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onResizeStart,
  onResizeEnd,
  onGlobalMouseMove,
  onGlobalMouseUp
}) {

  const containerRef = useRef();

  const handleReservationMouseDown = (e, reservation) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const offset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    onDragStart(e, reservation, offset);
  };

  const handleReservationMouseUp = (e, reservation) => {
    onDragEnd(reservation);
  };

  const handleCellClick = (e, day) => {
    e.stopPropagation();
    onDayClick(day);
  };

  const handleResizeStart = (e, reservationId, direction) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    onResizeStart(reservationId, direction);
  };

  return (
    <div 
      ref={containerRef}
      className={styles.gridCanvas}
      onScroll={onScroll}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <table className={styles.gridTable}>
        <thead>
          <tr>
            <th style={{ width: `${roomColumnWidth}px`, height: `${headerHeight}px` }}>
              Habitaciones
            </th>
            {months.map((month, monthIndex) => (
              <th 
                key={monthIndex}
                style={getHeaderStyle(month)}
                colSpan={month.colSpan}
              >
                {format(month.month, 'MMMM yyyy', { locale: es })}
              </th>
            ))}
          </tr>
          <tr>
            <th style={{ width: `${roomColumnWidth}px`, height: `${headerHeight}px` }}>
              &nbsp;
            </th>
            {days.map((day, dayIndex) => (
              <th 
                key={dayIndex}
                style={{
                  width: `${cellWidth}px`,
                  height: `${headerHeight}px`,
                  border: '1px solid #e0e0e0',
                  backgroundColor: '#f8f9fa',
                  fontSize: '12px',
                  textAlign: 'center'
                }}
              >
                {format(day, 'dd')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rooms.map((room, roomIndex) => (
            <tr key={room.id}>
              <td 
                style={{
                  width: `${roomColumnWidth}px`,
                  height: `${cellHeight}px`,
                  border: '1px solid #e0e0e0',
                  backgroundColor: '#f8f9fa',
                  fontWeight: 'bold',
                  padding: '4px',
                  fontSize: '12px'
                }}
              >
                {room.name}
              </td>
              {days.map((day, dayIndex) => (
                <td
                  key={dayIndex}
                  style={getCellStyle(dayIndex, roomIndex)}
                  onClick={(e) => handleCellClick(e, day)}
                >
                  {/* Aquí se renderizarían las reservas que coinciden con este día y habitación */}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Renderizar reservas como elementos absolutos */}
      <div className={styles.reservationsLayer}>
        {console.log('🎯 DEBUG: Renderizando', reservations.length, 'reservas')}
        {reservations.map((reservation) => {
          const isDragging = draggedReservation?.id === reservation.id;
          const isResizing = resizingReservation === reservation.id;
          
          const style = getReservationStyle(reservation, isDragging, isResizing);
          console.log('🎨 DEBUG estilo para reserva', reservation.id, ':', style);
          
          return (
            <div
              key={reservation.id}
              style={style}
              className={styles.reservationBar}
              onMouseDown={(e) => handleReservationMouseDown(e, reservation)}
              onMouseUp={(e) => handleReservationMouseUp(e, reservation)}
              onClick={(e) => {
                e.stopPropagation();
                onReservationClick(reservation);
              }}
            >
              <ReservationBar
                reservation={reservation}
                isDragging={isDragging}
                isResizing={isResizing}
                onResizeStart={(direction) => handleResizeStart(null, reservation.id, direction)}
              />
            </div>
          );
        })}
      </div>

      {/* Preview de drag */}
      {dragPreview && draggedReservation && (
        <div
          style={{
            position: 'absolute',
            left: dragPreview.x - dragOffset.x,
            top: dragPreview.y - dragOffset.y,
            width: `${getReservationWidth(draggedReservation)}px`,
            height: `${cellHeight - 2}px`,
            backgroundColor: 'rgba(0, 123, 255, 0.3)',
            border: '2px dashed #007bff',
            pointerEvents: 'none',
            zIndex: 1001
          }}
        />
      )}
    </div>
  );
} 