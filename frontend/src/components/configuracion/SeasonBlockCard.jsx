import React from 'react';
import { FiEdit, FiTrash2, FiCalendar, FiDollarSign, FiSettings } from 'react-icons/fi';
import styles from './SeasonBlockCard.module.css';

export default function SeasonBlockCard({ block, onEdit, onDelete }) {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getServiceAdjustmentSummary = () => {
    const adjustmentsByService = {};
    
    // Agrupar ajustes por tipo de servicio
    block.seasonServiceAdjustments?.forEach(adj => {
      if (!adjustmentsByService[adj.serviceTypeId]) {
        adjustmentsByService[adj.serviceTypeId] = {
          serviceType: adj.serviceType,
          adjustments: []
        };
      }
      adjustmentsByService[adj.serviceTypeId].adjustments.push(adj);
    });

    return Object.values(adjustmentsByService).slice(0, 3); // Mostrar máximo 3
  };

  const getPriceSummary = () => {
    if (!block.seasonPrices || block.seasonPrices.length === 0) {
      return 'Sin precios configurados';
    }

    const prices = block.seasonPrices.slice(0, 2); // Mostrar máximo 2
    const summary = prices.map(price => 
      `${price.roomType.name}: ${formatCurrency(price.basePrice)}`
    ).join(', ');

    if (block.seasonPrices.length > 2) {
      return `${summary} y ${block.seasonPrices.length - 2} más`;
    }

    return summary;
  };

  const adjustmentSummary = getServiceAdjustmentSummary();
  const priceSummary = getPriceSummary();

  return (
    <div className={styles.card}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <h3 className={styles.title}>{block.name}</h3>
          <div className={styles.dateRange}>
            <FiCalendar className={styles.dateIcon} />
            <span>
              {formatDate(block.startDate)} - {formatDate(block.endDate)}
            </span>
          </div>
        </div>
        <div className={styles.actions}>
          <button
            className={styles.editButton}
            onClick={() => onEdit(block)}
            title="Editar bloque"
          >
            <FiEdit />
          </button>
          <button
            className={styles.deleteButton}
            onClick={() => onDelete(block)}
            title="Eliminar bloque"
          >
            <FiTrash2 />
          </button>
        </div>
      </div>

      {/* Description */}
      {block.description && (
        <div className={styles.description}>
          {block.description}
        </div>
      )}

      {/* Price Summary */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <FiDollarSign className={styles.sectionIcon} />
          <span className={styles.sectionTitle}>Tarifas Base</span>
        </div>
        <div className={styles.sectionContent}>
          {priceSummary}
        </div>
      </div>

      {/* Service Adjustments Summary */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <FiSettings className={styles.sectionIcon} />
          <span className={styles.sectionTitle}>Ajustes por Servicio</span>
        </div>
        <div className={styles.sectionContent}>
          {adjustmentSummary.length === 0 ? (
            <span className={styles.noAdjustments}>Sin ajustes configurados</span>
          ) : (
            <div className={styles.adjustmentsList}>
              {adjustmentSummary.map(({ serviceType, adjustments }) => {
                // Calcular resumen de ajustes para este servicio
                const fixedAdjustments = adjustments.filter(adj => adj.mode === 'FIXED');
                const percentageAdjustments = adjustments.filter(adj => adj.mode === 'PERCENTAGE');
                
                let summary = serviceType.name + ': ';
                const summaryParts = [];

                if (fixedAdjustments.length > 0) {
                  const avgFixed = fixedAdjustments.reduce((sum, adj) => sum + adj.value, 0) / fixedAdjustments.length;
                  summaryParts.push(`${avgFixed >= 0 ? '+' : ''}${formatCurrency(avgFixed)} fijo`);
                }

                if (percentageAdjustments.length > 0) {
                  const avgPercentage = percentageAdjustments.reduce((sum, adj) => sum + adj.value, 0) / percentageAdjustments.length;
                  summaryParts.push(`${avgPercentage >= 0 ? '+' : ''}${avgPercentage}%`);
                }

                return (
                  <div key={serviceType.id} className={styles.adjustmentItem}>
                    {summary}{summaryParts.join(', ')}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{block.seasonPrices?.length || 0}</span>
          <span className={styles.statLabel}>Habitaciones</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {new Set(block.seasonServiceAdjustments?.map(adj => adj.serviceTypeId)).size || 0}
          </span>
          <span className={styles.statLabel}>Servicios</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{block.seasonServiceAdjustments?.length || 0}</span>
          <span className={styles.statLabel}>Ajustes</span>
        </div>
      </div>

      {/* Status */}
      <div className={styles.footer}>
        <div className={`${styles.status} ${block.isActive ? styles.active : styles.inactive}`}>
          {block.isActive ? '✅ Activo' : '❌ Inactivo'}
        </div>
        <div className={styles.orderIndex}>
          Orden: {block.orderIndex}
        </div>
      </div>
    </div>
  );
} 