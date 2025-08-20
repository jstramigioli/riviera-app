import React, { useState, useEffect } from 'react';
import styles from '../../styles/TariffDashboard.module.css';

export default function ActiveSeasonBlocks() {
  const [seasonBlocks, setSeasonBlocks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSeasonBlocks = async () => {
      try {
        const response = await fetch('/api/season-blocks');
        const data = await response.json();
        
        // Filtrar solo bloques confirmados (no borradores)
        const confirmedBlocks = data.filter(block => !block.isDraft);
        
        // Ordenar por fecha de inicio (más recientes primero)
        const sortedBlocks = confirmedBlocks.sort((a, b) => 
          new Date(b.startDate) - new Date(a.startDate)
        );
        
        setSeasonBlocks(sortedBlocks);
        setLoading(false);
      } catch (error) {
        console.error('Error loading season blocks:', error);
        setSeasonBlocks([]);
        setLoading(false);
      }
    };

    loadSeasonBlocks();
  }, []);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const isCurrentlyActive = (startDate, endDate) => {
    const today = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    return today >= start && today <= end;
  };

  const isUpcoming = (startDate) => {
    const today = new Date();
    const start = new Date(startDate);
    return start > today;
  };



  if (loading) {
    return (
      <div className={styles.cardContent}>
        <h3 className={styles.cardTitle}>📅 Bloques de Temporada</h3>
        <div className={styles.loading}>Cargando bloques...</div>
      </div>
    );
  }

  return (
    <div className={styles.cardContent}>
      <h3 className={styles.cardTitle}>📅 Bloques de Temporada</h3>
      
      {seasonBlocks.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No hay bloques de temporada configurados</p>
        </div>
      ) : (
        <div className={styles.blocksList}>
          {seasonBlocks.map(block => {
            const isActive = isCurrentlyActive(block.startDate, block.endDate);
            const isUpcomingBlock = isUpcoming(block.startDate);
            
            return (
              <div key={block.id} className={`${styles.blockItem} ${isActive ? styles.active : isUpcomingBlock ? styles.upcoming : styles.past}`}>
                <div className={styles.blockHeader}>
                  <h4 className={styles.blockName}>{block.name}</h4>
                  <span className={`${styles.blockStatus} ${isActive ? styles.active : isUpcomingBlock ? styles.upcoming : styles.past}`}>
                    {isActive ? '🟢 Activo' : isUpcomingBlock ? '🟡 Próximo' : '🔴 Finalizado'}
                  </span>
                </div>
                
                <div className={styles.blockDates}>
                  <span className={styles.dateRange}>
                    {formatDate(block.startDate)} - {formatDate(block.endDate)}
                  </span>
                </div>
                
                <div className={styles.blockDetails}>
                  <span className={styles.adjustmentMode}>
                    Modo: {block.serviceAdjustmentMode === 'PERCENTAGE' ? 'Porcentaje' : 'Monto Fijo'}
                  </span>
                  {block.lastSavedAt && (
                    <span className={styles.lastSaved}>
                      Guardado: {formatDate(block.lastSavedAt)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      <div className={styles.cardFooter}>
        <small className={styles.blockCount}>
          {seasonBlocks.length} bloque{seasonBlocks.length !== 1 ? 's' : ''} configurado{seasonBlocks.length !== 1 ? 's' : ''}
        </small>
      </div>
    </div>
  );
} 