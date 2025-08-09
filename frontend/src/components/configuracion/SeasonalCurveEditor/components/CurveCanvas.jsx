import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import styles from '../SeasonalCurveEditor.module.css';

function getMonthName(date) {
  const months = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ];
  return months[date.getMonth()];
}

export default function CurveCanvas({
  keyframes,
  adjustedValues,
  dateRange,
  dateToX,
  valueToY,
  getInterpolatedPrice,
  dragIdx,
  hoveredKeyframe,
  onMouseDown,
  onMouseUp,
  onMouseMove,
  onSnapPointClick,
  onPointEdit
}) {
  const { minDate, maxDate } = dateRange;
  const canvasWidth = 800;
  const canvasHeight = 400;

  // Generar puntos de la curva interpolada
  const curvePoints = [];
  const steps = 100;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const date = new Date(minDate.getTime() + t * (maxDate - minDate));
    const price = getInterpolatedPrice(date);
    const x = dateToX(date);
    const y = valueToY(price);
    curvePoints.push({ x, y, date, price });
  }

  // Generar puntos de snap (días exactos)
  const snapPoints = [];
  const currentDate = new Date(minDate);
  while (currentDate <= maxDate) {
    const price = getInterpolatedPrice(currentDate);
    const x = dateToX(currentDate);
    const y = valueToY(price);
    snapPoints.push({ x, y, date: new Date(currentDate), price });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const handleMouseMove = (e) => {
    onMouseMove(e, dateToX, valueToY, getInterpolatedPrice);
  };

  const handleClick = (e) => {
    onSnapPointClick(e, dateToX, valueToY, keyframes);
  };

  return (
    <div className={styles.canvasWrapper}>
      <svg
        width={canvasWidth}
        height={canvasHeight}
        className={styles.curveCanvas}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onMouseLeave={() => onMouseUp()}
      >
        {/* Grid de fondo */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e0e0e0" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Ejes */}
        <line x1="0" y1="400" x2="800" y2="400" stroke="#333" strokeWidth="2" />
        <line x1="0" y1="0" x2="0" y2="400" stroke="#333" strokeWidth="2" />

        {/* Etiquetas del eje X (fechas) */}
        {Array.from({ length: 12 }, (_, i) => {
          const date = new Date(minDate.getTime() + (i / 12) * (maxDate - minDate));
          const x = dateToX(date);
          return (
            <g key={i}>
              <text x={x} y="420" textAnchor="middle" fontSize="12" fill="#666">
                {getMonthName(date)}
              </text>
              <line x1={x} y1="400" x2={x} y2="395" stroke="#333" strokeWidth="1" />
            </g>
          );
        })}

        {/* Etiquetas del eje Y (precios) */}
        {Array.from({ length: 5 }, (_, i) => {
          const value = Math.max(...adjustedValues) * (i / 4);
          const y = valueToY(value);
          return (
            <g key={i}>
              <text x="-10" y={y + 4} textAnchor="end" fontSize="12" fill="#666">
                ${Math.round(value)}
              </text>
              <line x1="0" y1={y} x2="5" y2={y} stroke="#333" strokeWidth="1" />
            </g>
          );
        })}

        {/* Curva interpolada */}
        <path
          d={curvePoints.map((point, i) => 
            `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
          ).join(' ')}
          stroke="#007bff"
          strokeWidth="3"
          fill="none"
        />

        {/* Puntos de snap */}
        {snapPoints.map((point, i) => (
          <circle
            key={i}
            cx={point.x}
            cy={point.y}
            r="2"
            fill="#007bff"
            opacity="0.6"
          />
        ))}

        {/* Keyframes */}
        {keyframes.map((keyframe, idx) => {
          const x = dateToX(keyframe.date);
          const y = valueToY(adjustedValues[idx]);
          const isDragging = dragIdx === idx;
          const isHovered = hoveredKeyframe === idx;

          return (
            <g key={keyframe.id || idx}>
              <circle
                cx={x}
                cy={y}
                r={isDragging || isHovered ? "8" : "6"}
                fill={isDragging ? "#ff4444" : "#007bff"}
                stroke="#fff"
                strokeWidth="2"
                style={{ cursor: 'pointer' }}
                onMouseDown={() => onMouseDown(idx)}
                onMouseUp={onMouseUp}
                onDoubleClick={() => onPointEdit(keyframe)}
              />
              
              {/* Etiqueta del keyframe */}
              {(isDragging || isHovered) && (
                <text
                  x={x}
                  y={y - 15}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#333"
                  fontWeight="bold"
                >
                  ${Math.round(adjustedValues[idx])}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
} 