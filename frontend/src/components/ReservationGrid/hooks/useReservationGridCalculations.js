import { useMemo } from 'react';
import { differenceInDays, format } from 'date-fns';

export function useReservationGridCalculations(days, cellWidth, cellHeight, headerHeight) {
  const roomColumnWidth = 120;

  const getReservationPosition = useMemo(() => {
    return (reservation) => {
      const startDate = new Date(reservation.checkIn);
      const dayIndex = days.findIndex(day => 
        format(day, 'yyyy-MM-dd') === format(startDate, 'yyyy-MM-dd')
      );
      
      if (dayIndex === -1) return { x: 0, y: 0 };
      
      return {
        x: dayIndex * cellWidth,
        y: (reservation.roomId - 1) * cellHeight + headerHeight
      };
    };
  }, [days, cellWidth, cellHeight, headerHeight]);

  const getReservationWidth = useMemo(() => {
    return (reservation) => {
      const startDate = new Date(reservation.checkIn);
      const endDate = new Date(reservation.checkOut);
      const duration = differenceInDays(endDate, startDate);
      return Math.max(cellWidth, duration * cellWidth);
    };
  }, [cellWidth]);

  const getReservationStyle = useMemo(() => {
    return (reservation, isDragging = false, isResizing = false) => {
      const position = getReservationPosition(reservation);
      const width = getReservationWidth(reservation);
      
      return {
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${width}px`,
        height: `${cellHeight - 2}px`,
        zIndex: isDragging || isResizing ? 1000 : 1,
        opacity: isDragging ? 0.7 : 1,
        cursor: isDragging ? 'grabbing' : 'grab'
      };
    };
  }, [getReservationPosition, getReservationWidth, cellHeight]);

  const getCellStyle = useMemo(() => {
    return (dayIndex, roomIndex) => {
      return {
        width: `${cellWidth}px`,
        height: `${cellHeight}px`,
        border: '1px solid #e0e0e0',
        backgroundColor: roomIndex % 2 === 0 ? '#f8f9fa' : '#fff',
        position: 'relative',
        cursor: 'pointer'
      };
    };
  }, [cellWidth, cellHeight]);

  const getHeaderStyle = useMemo(() => {
    return (month) => {
      return {
        width: `${month.colSpan * cellWidth}px`,
        height: `${headerHeight}px`,
        border: '1px solid #e0e0e0',
        backgroundColor: '#f8f9fa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: '14px'
      };
    };
  }, [cellWidth, headerHeight]);

  return {
    roomColumnWidth,
    getReservationPosition,
    getReservationWidth,
    getReservationStyle,
    getCellStyle,
    getHeaderStyle
  };
} 