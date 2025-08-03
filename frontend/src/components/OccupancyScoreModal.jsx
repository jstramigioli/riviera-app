import React from 'react';
import styles from './OccupancyScoreModal.module.css';

export default function OccupancyScoreModal({ isOpen, onClose, occupancyData, date }) {
  if (!isOpen || !occupancyData) return null;

  console.log('=== DEBUG OccupancyScoreModal ===');
  console.log('occupancyData recibido:', occupancyData);
  console.log('anticipationFactor:', occupancyData.anticipationFactor);
  console.log('occupancyScore:', occupancyData.occupancyScore);
  console.log('=== FIN DEBUG OccupancyScoreModal ===\n');

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getScoreLevel = (score) => {
    if (score > 0.7) return { level: 'Alta', color: '#dc3545' };
    if (score > 0.5) return { level: 'Media', color: '#ffc107' };
    return { level: 'Baja', color: '#28a745' };
  };

  const scoreLevel = getScoreLevel(occupancyData.occupancyScore);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Desglose del Score de Ocupación</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className={styles.modalBody}>
          <div className={styles.dateInfo}>
            <strong>Fecha:</strong> {formatDate(date)}
          </div>
          
          <div className={styles.scoreSummary}>
            <div className={styles.mainScore}>
              <span className={styles.scoreValue} style={{ color: scoreLevel.color }}>
                {Math.round(occupancyData.occupancyScore * 100)}%
              </span>
              <span className={styles.scoreLevel} style={{ color: scoreLevel.color }}>
                ({scoreLevel.level})
              </span>
            </div>
          </div>

          <div className={styles.factorsSection}>
            <h3>Desglose de factores:</h3>
            
            <div className={styles.factorsTable}>
              <div className={styles.tableHeader}>
                <div className={styles.factorColumn}>Factor</div>
                <div className={styles.weightColumn}>Peso</div>
                <div className={styles.valueColumn}>Valor</div>
                <div className={styles.resultColumn}>Resultado</div>
              </div>
              
              <div className={styles.tableRow}>
                <div className={styles.factorColumn}>Ocupación Global</div>
                <div className={styles.weightColumn}>{Math.round(occupancyData.globalOccupancyWeight * 100)}%</div>
                <div className={styles.valueColumn}>{Math.round(occupancyData.currentOccupancy * 100)}%</div>
                <div className={styles.resultColumn}>{((occupancyData.currentOccupancy * occupancyData.globalOccupancyWeight) * 100).toFixed(2)}%</div>
              </div>
              
              <div className={styles.tableRow}>
                <div className={styles.factorColumn}>Anticipación</div>
                <div className={styles.weightColumn}>{Math.round(occupancyData.anticipationWeight * 100)}%</div>
                <div className={styles.valueColumn}>{occupancyData.daysUntilDate} días</div>
                <div className={styles.resultColumn}>{((occupancyData.anticipationFactor !== undefined ? occupancyData.anticipationFactor : 0) * occupancyData.anticipationWeight * 100).toFixed(2)}%</div>
              </div>
              
              <div className={styles.tableRow}>
                <div className={styles.factorColumn}>Fin de Semana</div>
                <div className={styles.weightColumn}>{Math.round(occupancyData.isWeekendWeight * 100)}%</div>
                <div className={styles.valueColumn}>{occupancyData.isWeekend ? 'Sí' : 'No'}</div>
                <div className={styles.resultColumn}>{((occupancyData.isWeekend ? 1 : 0) * occupancyData.isWeekendWeight * 100).toFixed(2)}%</div>
              </div>
              
              <div className={styles.tableRow}>
                <div className={styles.factorColumn}>Feriado</div>
                <div className={styles.weightColumn}>{Math.round(occupancyData.isHolidayWeight * 100)}%</div>
                <div className={styles.valueColumn}>{occupancyData.isHoliday ? 'Sí' : 'No'}</div>
                <div className={styles.resultColumn}>{((occupancyData.isHoliday ? 1 : 0) * occupancyData.isHolidayWeight * 100).toFixed(2)}%</div>
              </div>
              
              <div className={styles.tableRow}>
                <div className={styles.factorColumn}>Índice de Demanda</div>
                <div className={styles.weightColumn}>{Math.round(occupancyData.demandIndexWeight * 100)}%</div>
                <div className={styles.valueColumn}>{occupancyData.demandIndex || 0.5}</div>
                <div className={styles.resultColumn}>{((occupancyData.demandIndex || 0.5) * occupancyData.demandIndexWeight * 100).toFixed(2)}%</div>
              </div>
              
              <div className={styles.tableRow}>
                <div className={styles.factorColumn}>Clima</div>
                <div className={styles.weightColumn}>{Math.round(occupancyData.weatherScoreWeight * 100)}%</div>
                <div className={styles.valueColumn}>{occupancyData.weatherScore || 0.5}</div>
                <div className={styles.resultColumn}>{((occupancyData.weatherScore || 0.5) * occupancyData.weatherScoreWeight * 100).toFixed(2)}%</div>
              </div>
              
              <div className={styles.tableRow}>
                <div className={styles.factorColumn}>Impacto de Eventos</div>
                <div className={styles.weightColumn}>{Math.round(occupancyData.eventImpactWeight * 100)}%</div>
                <div className={styles.valueColumn}>{occupancyData.eventImpact || 0.5}</div>
                <div className={styles.resultColumn}>{((occupancyData.eventImpact || 0.5) * occupancyData.eventImpactWeight * 100).toFixed(2)}%</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 