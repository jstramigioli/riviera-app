import { useState, useEffect } from 'react';
import { differenceInDays } from 'date-fns';

export function useReservationGridInteractions() {
  const [dragPreview, setDragPreview] = useState(null);
  const [draggedReservation, setDraggedReservation] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [resizingReservation, setResizingReservation] = useState(null);
  const [resizeData, setResizeData] = useState(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState(null);
  const [resizeReservationId, setResizeReservationId] = useState(null);
  const [justFinishedResize, setJustFinishedResize] = useState(false);

  const handleDragStart = (e, reservation, offset) => {
    e.preventDefault();
    setDraggedReservation(reservation);
    setDragOffset(offset);
    setDragPreview({
      reservation,
      offset,
      x: e.clientX,
      y: e.clientY
    });
  };

  const handleDragEnd = (reservation) => {
    setDraggedReservation(null);
    setDragPreview(null);
    setDragOffset(0);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!draggedReservation || !dragPreview) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const dayIndex = Math.floor(x / 40); // Asumiendo cellWidth de 40

    setDragPreview(prev => ({
      ...prev,
      x: e.clientX,
      y: e.clientY,
      dayIndex
    }));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (!draggedReservation || !dragPreview) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const dayIndex = Math.floor(x / 40);
    
    // Aquí implementarías la lógica para actualizar la reserva
    console.log('Drop reservation:', draggedReservation, 'at day index:', dayIndex);
    
    handleDragEnd(draggedReservation);
  };

  const handleResizeStart = (reservationId, direction) => {
    setResizingReservation(reservationId);
    setResizeDirection(direction);
    setIsResizing(true);
    setResizeData({
      startX: 0,
      startY: 0,
      originalWidth: 0,
      originalHeight: 0
    });
  };

  const handleResizeEnd = (reservationId, updateData) => {
    setResizingReservation(null);
    setResizeDirection(null);
    setIsResizing(false);
    setResizeData(null);
    setJustFinishedResize(true);
    
    // Aquí implementarías la lógica para actualizar la reserva
    console.log('Resize end:', reservationId, updateData);
  };

  const handleGlobalMouseMove = (e) => {
    if (!isResizing || !resizingReservation) return;

    const deltaX = e.clientX - resizeData.startX;
    const deltaY = e.clientY - resizeData.startY;

    if (resizeDirection === 'right') {
      const newWidth = Math.max(40, resizeData.originalWidth + deltaX);
      setResizeData(prev => ({
        ...prev,
        currentWidth: newWidth
      }));
    } else if (resizeDirection === 'left') {
      const newWidth = Math.max(40, resizeData.originalWidth - deltaX);
      const newX = resizeData.startX + deltaX;
      setResizeData(prev => ({
        ...prev,
        currentWidth: newWidth,
        currentX: newX
      }));
    }
  };

  const handleGlobalMouseUp = () => {
    if (isResizing && resizingReservation) {
      handleResizeEnd(resizingReservation, resizeData);
    }
  };

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isResizing, resizingReservation, resizeData, resizeDirection]);

  return {
    dragPreview,
    draggedReservation,
    dragOffset,
    resizingReservation,
    resizeData,
    isResizing,
    resizeDirection,
    resizeReservationId,
    justFinishedResize,
    setDragPreview,
    setDraggedReservation,
    setDragOffset,
    setResizingReservation,
    setResizeData,
    setIsResizing,
    setResizeDirection,
    setResizeReservationId,
    setJustFinishedResize,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    handleResizeStart,
    handleResizeEnd,
    handleGlobalMouseMove,
    handleGlobalMouseUp
  };
} 