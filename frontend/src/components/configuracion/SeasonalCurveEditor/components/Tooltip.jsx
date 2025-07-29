import React from 'react';
import styles from '../SeasonalCurveEditor.module.css';

export default function Tooltip({ tooltip }) {
  if (!tooltip.show) return null;

  return (
    <div 
      className={styles.tooltip}
      style={{
        position: 'fixed',
        left: tooltip.x + 10,
        top: tooltip.y - 10,
        zIndex: 1000
      }}
    >
      <div className={styles.tooltipContent}>
        <div className={styles.tooltipDate}>
          <strong>Fecha:</strong> {tooltip.date}
        </div>
        <div className={styles.tooltipPrice}>
          <strong>Precio:</strong> ${tooltip.price}
        </div>
      </div>
    </div>
  );
} 