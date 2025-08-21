import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import styles from '../ReservationGrid.module.css';

export default function GridHeader({ months, cellWidth, headerHeight, getHeaderStyle }) {
  return (
    <div className={styles.gridHeader} style={{ height: headerHeight }}>
      <table className={styles.gridTable}>
        <thead>
          <tr>
            <th className={styles.roomNameHeader} style={{ width: '120px' }}>
              Habitaciones
            </th>
            {months.map((month, index) => (
              <th
                key={index}
                colSpan={month.colSpan}
                style={getHeaderStyle(month.days[0], month.colSpan)}
              >
                <div className={styles.monthHeader}>
                  <div className={styles.monthName}>
                    {format(month.month, 'MMMM yyyy', { locale: es })}
                  </div>
                  <div className={styles.daysCount}>
                    {month.days.length} días
                  </div>
                </div>
              </th>
            ))}
          </tr>
          <tr>
            <th className={styles.roomNameHeader} style={{ width: '120px' }}>
              &nbsp;
            </th>
            {months.map((month) =>
              month.days.map((day, dayIndex) => (
                <th
                  key={`${month.month.toISOString()}-${dayIndex}`}
                  style={{
                    width: `${cellWidth}px`,
                    minWidth: `${cellWidth}px`,
                    height: '30px',
                    padding: '0',
                    boxSizing: 'border-box'
                  }}
                >
                  <div className={styles.dayHeader}>
                    <div className={styles.dayNumber}>
                      {format(day, 'd')}
                    </div>
                    <div className={styles.dayName}>
                      {format(day, 'EEE', { locale: es })}
                    </div>
                  </div>
                </th>
              ))
            )}
          </tr>
        </thead>
      </table>
    </div>
  );
} 