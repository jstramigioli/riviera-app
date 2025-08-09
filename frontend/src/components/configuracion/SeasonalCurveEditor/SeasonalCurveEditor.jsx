import React, { useState } from "react";
import { useSeasonalCurveData } from "./hooks/useSeasonalCurveData";
import { useSeasonalCurveInteractions } from "./hooks/useSeasonalCurveInteractions";
import { useSeasonalCurveCalculations } from "./hooks/useSeasonalCurveCalculations";
import CurveCanvas from "./components/CurveCanvas";
import CurveControls from "./components/CurveControls";
import AddPointModal from "./components/AddPointModal";
import EditPointModal from "./components/EditPointModal";
import Notification from "./components/Notification";
import Tooltip from "./components/Tooltip";
import styles from "./SeasonalCurveEditor.module.css";

export default function SeasonalCurveEditor({ 
  keyframes = [], 
  onChange, 
  onSave, 
  hotelId = "default-hotel" 
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPoint, setEditingPoint] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'error' });

  const {
    selectedRoomType,
    selectedPriceType,
    zoomLevel,
    currentPeriod,
    roomTypes,
    roomTypeCoefficients,
    mealRules,
    periodsData,
    setSelectedRoomType,
    setSelectedPriceType,
    setZoomLevel,
    setCurrentPeriod,
    setRoomTypeCoefficients,
    setMealRules
  } = useSeasonalCurveData(hotelId);

  const {
    dragIdx,
    hoveredKeyframe,
    tooltip,
    setDragIdx,
    setHoveredKeyframe,
    setTooltip,
    handleMouseDown,
    handleMouseUp,
    handleMouseMove,
    handleSnapPointClick
  } = useSeasonalCurveInteractions();

  const {
    sortedKeyframes,
    dateRange,
    adjustedValues,
    dateToX,
    valueToY,
    getInterpolatedPrice,
    navigatePeriod
  } = useSeasonalCurveCalculations(keyframes, selectedRoomType, selectedPriceType, roomTypeCoefficients, currentPeriod, zoomLevel);

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'error' }), 3000);
  };

  const handleAddPoint = (newPoint) => {
    const updatedKeyframes = [...sortedKeyframes, newPoint].sort((a, b) => new Date(a.date) - new Date(b.date));
    onChange(updatedKeyframes);
    setShowAddModal(false);
    showNotification('Punto agregado exitosamente');
  };

  const handleEditPoint = (updatedPoint) => {
    const updatedKeyframes = sortedKeyframes.map(k => 
      k.id === updatedPoint.id ? updatedPoint : k
    );
    onChange(updatedKeyframes);
    setEditingPoint(null);
    showNotification('Punto actualizado exitosamente');
  };

  const handleDeletePoint = (pointId) => {
    const updatedKeyframes = sortedKeyframes.filter(k => k.id !== pointId);
    onChange(updatedKeyframes);
    setEditingPoint(null);
    showNotification('Punto eliminado exitosamente');
  };

  const handleSave = async () => {
    try {
      await onSave(sortedKeyframes);
      showNotification('Curva guardada exitosamente');
    } catch (error) {
      showNotification('Error al guardar la curva', 'error');
    }
  };

  return (
    <div className={styles.container}>
      <CurveControls
        selectedRoomType={selectedRoomType}
        selectedPriceType={selectedPriceType}
        zoomLevel={zoomLevel}
        currentPeriod={currentPeriod}
        roomTypes={roomTypes}
        onRoomTypeChange={setSelectedRoomType}
        onPriceTypeChange={setSelectedPriceType}
        onZoomLevelChange={setZoomLevel}
        onPeriodChange={setCurrentPeriod}
        onAddPoint={() => setShowAddModal(true)}
        onSave={handleSave}
        onNavigate={navigatePeriod}
      />

      <div className={styles.canvasContainer}>
        <CurveCanvas
          keyframes={sortedKeyframes}
          adjustedValues={adjustedValues}
          dateRange={dateRange}
          dateToX={dateToX}
          valueToY={valueToY}
          getInterpolatedPrice={getInterpolatedPrice}
          dragIdx={dragIdx}
          hoveredKeyframe={hoveredKeyframe}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onSnapPointClick={handleSnapPointClick}
          onPointEdit={setEditingPoint}
        />

        <Tooltip tooltip={tooltip} />
      </div>

      {showAddModal && (
        <AddPointModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddPoint}
          selectedRoomType={selectedRoomType}
          roomTypes={roomTypes}
        />
      )}

      {editingPoint && (
        <EditPointModal
          point={editingPoint}
          onClose={() => setEditingPoint(null)}
          onSave={handleEditPoint}
          onDelete={handleDeletePoint}
          selectedRoomType={selectedRoomType}
          selectedPriceType={selectedPriceType}
          roomTypes={roomTypes}
        />
      )}

      <Notification notification={notification} />
    </div>
  );
} 