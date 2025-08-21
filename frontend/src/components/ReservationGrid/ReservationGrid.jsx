import React, { useState, useEffect } from 'react';
import { createQuery, createReservation, createClient, getDetailedOccupancyScore } from '../../services/api';
import { useReservationGridData } from './hooks/useReservationGridData';
import { useReservationGridInteractions } from './hooks/useReservationGridInteractions';
import { useReservationGridCalculations } from './hooks/useReservationGridCalculations';
import GridCanvas from './components/GridCanvas';
import GridHeader from './components/GridHeader';
import GridControls from './components/GridControls';
import DayInfoSidePanel from '../DayInfoSidePanel';
import FloatingActionButton from '../FloatingActionButton';
import CreateReservationPanel from '../CreateReservationPanel';
import CreateQueryPanel from '../CreateQueryPanel';
import OccupancyScoreModal from '../OccupancyScoreModal';
import styles from './ReservationGrid.module.css';

export default function ReservationGrid({ 
  rooms, 
  reservations, 
  setReservations, 
  updateReservation, 
  onReservationClick,
  operationalPeriods = []
}) {
  console.log('🔍 DEBUG ReservationGrid');
  console.log('📊 rooms:', rooms.length);
  console.log('📊 reservations:', reservations.length);
  console.log('📊 Sample reservation:', reservations[0]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isDayInfoPanelOpen, setIsDayInfoPanelOpen] = useState(false);
  const [isCreateReservationPanelOpen, setIsCreateReservationPanelOpen] = useState(false);
  const [isCreateQueryPanelOpen, setIsCreateQueryPanelOpen] = useState(false);
  
  // Estado para configuración de precios dinámicos
  const [dynamicPricingConfig, setDynamicPricingConfig] = useState(null);
  const [occupancyScores, setOccupancyScores] = useState({});
  
  // Estado para el modal de score de ocupación
  const [isOccupancyModalOpen, setIsOccupancyModalOpen] = useState(false);
  const [selectedOccupancyData, setSelectedOccupancyData] = useState(null);
  const [selectedOccupancyDate, setSelectedOccupancyDate] = useState(null);

  const {
    startDate,
    endDate,
    days,
    months,
    cellWidth,
    cellHeight,
    headerHeight,
    setStartDate,
    setEndDate,
    setDays,
    setMonths,
    setCellWidth,
    setCellHeight,
    setHeaderHeight,
    handleScroll,
    centerOnToday
  } = useReservationGridData();

  const {
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
  } = useReservationGridInteractions();

  const {
    roomColumnWidth,
    getReservationPosition,
    getReservationWidth,
    getReservationStyle,
    getCellStyle,
    getHeaderStyle
  } = useReservationGridCalculations(days, cellWidth, cellHeight, headerHeight);

  const handleReservationClick = (reservation) => {
    if (justFinishedResize) {
      setJustFinishedResize(false);
      return;
    }
    onReservationClick(reservation);
  };

  const handleDayClick = (day) => {
    setSelectedDate(day);
    setIsDayInfoPanelOpen(true);
  };

  const handleDayInfoPanelClose = () => {
    setIsDayInfoPanelOpen(false);
    setSelectedDate(null);
  };

  const handleCreateReservationClick = () => {
    setIsCreateReservationPanelOpen(true);
  };

  const handleCreateReservationPanelClose = () => {
    setIsCreateReservationPanelOpen(false);
  };

  const handleCreateReservation = async (newReservation) => {
    try {
      const createdReservation = await createReservation(newReservation);
      setReservations(prev => [...prev, createdReservation]);
      setIsCreateReservationPanelOpen(false);
    } catch (error) {
      console.error('Error creating reservation:', error);
    }
  };

  const handleCreateQueryClick = () => {
    setIsCreateQueryPanelOpen(true);
  };

  const handleCreateQueryPanelClose = () => {
    setIsCreateQueryPanelOpen(false);
  };

  const handleCreateQuery = async (newQuery) => {
    try {
      const createdQuery = await createQuery(newQuery);
      console.log('Nueva consulta creada:', createdQuery);
      setIsCreateQueryPanelOpen(false);
      // Opcional: mostrar un mensaje de éxito
      alert('Consulta creada exitosamente');
    } catch (error) {
      console.error('Error creating query:', error);
      alert('Error al crear la consulta: ' + error.message);
    }
  };

  return (
    <div className={styles.container}>
      <GridControls
        onCenterToday={centerOnToday}
        onCreateReservation={handleCreateReservationClick}
      />

      <div className={styles.gridContainer}>
        <GridHeader
          months={months}
          cellWidth={cellWidth}
          headerHeight={headerHeight}
          getHeaderStyle={getHeaderStyle}
        />

        <GridCanvas
          rooms={rooms}
          reservations={reservations}
          days={days}
          months={months}
          cellWidth={cellWidth}
          cellHeight={cellHeight}
          headerHeight={headerHeight}
          roomColumnWidth={roomColumnWidth}
          dragPreview={dragPreview}
          draggedReservation={draggedReservation}
          dragOffset={dragOffset}
          resizingReservation={resizingReservation}
          resizeData={resizeData}
          isResizing={isResizing}
          resizeDirection={resizeDirection}
          resizeReservationId={resizeReservationId}
          getReservationPosition={getReservationPosition}
          getReservationWidth={getReservationWidth}
          getReservationStyle={getReservationStyle}
          getCellStyle={getCellStyle}
          getHeaderStyle={getHeaderStyle}
          onScroll={handleScroll}
          onReservationClick={handleReservationClick}
          onDayClick={handleDayClick}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onResizeStart={handleResizeStart}
          onResizeEnd={handleResizeEnd}
          onGlobalMouseMove={handleGlobalMouseMove}
          onGlobalMouseUp={handleGlobalMouseUp}
        />
      </div>

      <FloatingActionButton 
        onCreateReservation={handleCreateReservationClick}
        onCreateQuery={handleCreateQueryClick}
      />

      {isDayInfoPanelOpen && selectedDate && (
        <DayInfoSidePanel
          date={selectedDate}
          onClose={handleDayInfoPanelClose}
        />
      )}

      {isCreateReservationPanelOpen && (
        <CreateReservationPanel
          onClose={handleCreateReservationPanelClose}
          onCreate={handleCreateReservation}
          rooms={rooms}
        />
      )}

      {isCreateQueryPanelOpen && (
        <CreateQueryPanel
          isOpen={isCreateQueryPanelOpen}
          onClose={handleCreateQueryPanelClose}
          onCreateQuery={handleCreateQuery}
          rooms={rooms}
        />
      )}

      {/* Modal de detalles del score de ocupación */}
      <OccupancyScoreModal
        isOpen={isOccupancyModalOpen}
        onClose={() => setIsOccupancyModalOpen(false)}
        occupancyData={selectedOccupancyData}
        date={selectedOccupancyDate}
      />
    </div>
  );
} 