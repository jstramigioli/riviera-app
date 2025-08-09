import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FaChevronLeft, FaChevronRight, FaPlus, FaSave } from 'react-icons/fa';
import styles from '../SeasonalCurveEditor.module.css';

const priceTypeOptions = [
  { value: 'base', label: 'Precio Base' },
  { value: 'breakfast', label: 'Con Desayuno' },
  { value: 'halfBoard', label: 'Media Pensión' }
];

const zoomLevels = [
  { value: 'month', label: 'Mes' },
  { value: 'quarter', label: '3 Meses' }
];

export default function CurveControls({
  selectedRoomType,
  selectedPriceType,
  zoomLevel,
  currentPeriod,
  roomTypes,
  onRoomTypeChange,
  onPriceTypeChange,
  onZoomLevelChange,
  onPeriodChange,
  onAddPoint,
  onSave,
  onNavigate
}) {
  const handlePreviousPeriod = () => {
    const newPeriod = onNavigate('prev');
    onPeriodChange(newPeriod);
  };

  const handleNextPeriod = () => {
    const newPeriod = onNavigate('next');
    onPeriodChange(newPeriod);
  };

  return (
    <div className={styles.controls}>
      <div className={styles.controlGroup}>
        <label>Tipo de Habitación:</label>
        <select
          value={selectedRoomType}
          onChange={(e) => onRoomTypeChange(e.target.value)}
          className={styles.select}
        >
          {roomTypes.map(type => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.controlGroup}>
        <label>Tipo de Precio:</label>
        <select
          value={selectedPriceType}
          onChange={(e) => onPriceTypeChange(e.target.value)}
          className={styles.select}
        >
          {priceTypeOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.controlGroup}>
        <label>Vista:</label>
        <select
          value={zoomLevel}
          onChange={(e) => onZoomLevelChange(e.target.value)}
          className={styles.select}
        >
          {zoomLevels.map(level => (
            <option key={level.value} value={level.value}>
              {level.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.periodNavigation}>
        <button
          onClick={handlePreviousPeriod}
          className={styles.navButton}
          title="Período anterior"
        >
          <FaChevronLeft />
        </button>
        
        <span className={styles.periodDisplay}>
          {format(currentPeriod, 'MMMM yyyy', { locale: es })}
        </span>
        
        <button
          onClick={handleNextPeriod}
          className={styles.navButton}
          title="Período siguiente"
        >
          <FaChevronRight />
        </button>
      </div>

      <div className={styles.actionButtons}>
        <button
          onClick={onAddPoint}
          className={`${styles.button} ${styles.addButton}`}
          title="Agregar punto"
        >
          <FaPlus /> Agregar Punto
        </button>
        
        <button
          onClick={onSave}
          className={`${styles.button} ${styles.saveButton}`}
          title="Guardar curva"
        >
          <FaSave /> Guardar
        </button>
      </div>
    </div>
  );
} 