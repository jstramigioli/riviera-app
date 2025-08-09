import { useMemo } from 'react';
import { differenceInDays } from 'date-fns';

export function useReservationGridCalculations(days, cellWidth, cellHeight, headerHeight) {
  const roomColumnWidth = 120;

  const getReservationPosition = useMemo(() => {
    return (reservation) => {
      console.log('🔍 DEBUG getReservationPosition para reserva:', reservation.id);
      console.log('📅 Fecha original checkIn:', reservation.checkIn);
      
      // Normalizar la fecha de check-in para evitar problemas de zona horaria
      const startDate = new Date(reservation.checkIn);
      console.log('📅 startDate antes de normalizar:', startDate.toISOString());
      startDate.setHours(0, 0, 0, 0);
      console.log('📅 startDate después de normalizar:', startDate.toISOString());
      
      console.log('📊 Total de días en el grid:', days.length);
      console.log('📊 Primeros 5 días del grid:', days.slice(0, 5).map(d => d.toISOString()));
      
      const dayIndex = days.findIndex(day => {
        // Normalizar el día del grid también
        const normalizedDay = new Date(day);
        normalizedDay.setHours(0, 0, 0, 0);
        const isMatch = normalizedDay.getTime() === startDate.getTime();
        
        if (isMatch) {
          console.log('✅ Coincidencia encontrada en día:', day.toISOString());
        }
        
        return isMatch;
      });
      
      console.log('🎯 dayIndex encontrado:', dayIndex);
      
      if (dayIndex === -1) {
        console.log('❌ No se encontró el día en el grid');
        return { x: 0, y: 0 };
      }
      
      const position = {
        x: roomColumnWidth + (dayIndex * cellWidth),
        y: (reservation.roomId - 1) * cellHeight + headerHeight
      };
      
      console.log('📍 Posición calculada:', position);
      console.log('📏 Parámetros:', { roomColumnWidth, cellWidth, cellHeight, headerHeight });
      
      return position;
    };
  }, [days, cellWidth, cellHeight, headerHeight, roomColumnWidth]);

  const getReservationWidth = useMemo(() => {
    return (reservation) => {
      // Normalizar las fechas para evitar problemas de zona horaria
      const startDate = new Date(reservation.checkIn);
      const endDate = new Date(reservation.checkOut);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);
      
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