import React, { useState, useEffect } from 'react';
import { getReservationPricingDetails } from '../services/api';
import styles from './ReservationPricingDetails.module.css';

const ReservationPricingDetails = ({ reservationId, onClose, isExpanded }) => {
  const [pricingData, setPricingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (reservationId && isExpanded) {
      loadPricingDetails();
    }
  }, [reservationId, isExpanded]);

  const loadPricingDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getReservationPricingDetails(reservationId);
      setPricingData(data);
    } catch (err) {
      console.error('Error cargando detalles de tarifas:', err);
      setError('Error al cargar los detalles de tarifas');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(price);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDynamicPricingModifications = (nightRate) => {
    const modifications = [];
    
    if (nightRate.occupancyAdjustment && nightRate.occupancyAdjustment !== 0) {
      const sign = nightRate.occupancyAdjustment > 0 ? '+' : '';
      const color = nightRate.occupancyAdjustment > 0 ? 'green' : 'red';
      modifications.push({
        text: `Ocupación ${sign}${formatPrice(nightRate.occupancyAdjustment)}`,
        color
      });
    }
    
    if (nightRate.weekendAdjustment && nightRate.weekendAdjustment !== 0) {
      const sign = nightRate.weekendAdjustment > 0 ? '+' : '';
      const color = nightRate.weekendAdjustment > 0 ? 'green' : 'red';
      modifications.push({
        text: `Fin de semana ${sign}${formatPrice(nightRate.weekendAdjustment)}`,
        color
      });
    }
    
    if (nightRate.holidayAdjustment && nightRate.holidayAdjustment !== 0) {
      const sign = nightRate.holidayAdjustment > 0 ? '+' : '';
      const color = nightRate.holidayAdjustment > 0 ? 'green' : 'red';
      modifications.push({
        text: `Feriado ${sign}${formatPrice(nightRate.holidayAdjustment)}`,
        color
      });
    }
    
    if (nightRate.gapPromotionAmount && nightRate.gapPromotionAmount !== 0) {
      modifications.push({
        text: `Promoción hueco ${formatPrice(nightRate.gapPromotionAmount)}`,
        color: 'red' // Las promociones siempre restan
      });
    }
    
    if (nightRate.serviceAdjustment && nightRate.serviceAdjustment !== 0) {
      const sign = nightRate.serviceAdjustment > 0 ? '+' : '';
      const color = nightRate.serviceAdjustment > 0 ? 'green' : 'red';
      modifications.push({
        text: `Servicio ${sign}${formatPrice(nightRate.serviceAdjustment)}`,
        color
      });
    }
    
    return modifications.length > 0 ? modifications : [{ text: 'Sin modificaciones', color: 'gray' }];
  };

  if (!isExpanded) {
    return null;
  }

  if (loading) {
    return (
      <div className={styles.expandedContent}>
        <div className={styles.loading}>Cargando detalles de tarifas...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.expandedContent}>
        <div className={styles.error}>{error}</div>
        <button onClick={onClose} className={styles.closeButton}>
          Cerrar
        </button>
      </div>
    );
  }

  if (!pricingData) {
    return null;
  }

  const { reservation } = pricingData;

  // Calcular totales
  const totalBasePrice = reservation.nightRates.reduce((sum, night) => sum + night.basePrice, 0);
  const totalDynamicModifications = reservation.nightRates.reduce((sum, night) => {
    const modifications = (night.occupancyAdjustment || 0) + 
                        (night.weekendAdjustment || 0) + 
                        (night.holidayAdjustment || 0) + 
                        (night.gapPromotionAmount || 0) + 
                        (night.serviceAdjustment || 0);
    return sum + modifications;
  }, 0);
  const totalFinalPrice = reservation.nightRates.reduce((sum, night) => sum + night.finalRate, 0);

  return (
    <div className={styles.expandedContent}>
      <div className={styles.header}>
        <h3>Detalles de Tarifas - Reserva #{reservation.id}</h3>
        <button onClick={onClose} className={styles.closeButton}>
          ×
        </button>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.pricingTable}>
          <thead>
            <tr>
              <th>Noche</th>
              <th>Precio Base</th>
              <th>Modificación por precios inteligentes</th>
              <th>Total Noche</th>
            </tr>
          </thead>
          <tbody>
            {reservation.nightRates.map((nightRate, index) => (
              <tr key={nightRate.id} className={styles.nightRow}>
                <td className={styles.nightCell}>
                  <div className={styles.nightInfo}>
                    <span className={styles.nightNumber}>Noche {index + 1}</span>
                    <span className={styles.nightDate}>{formatDate(nightRate.date)}</span>
                  </div>
                </td>
                <td className={styles.basePriceCell}>
                  {formatPrice(nightRate.basePrice)}
                </td>
                <td className={styles.modificationsCell}>
                  <div className={styles.modificationsList}>
                    {getDynamicPricingModifications(nightRate).map((modification, index) => (
                      <div 
                        key={index} 
                        className={styles.modificationItem}
                        data-color={modification.color}
                      >
                        {modification.text}
                      </div>
                    ))}
                  </div>
                </td>
                <td className={styles.totalCell}>
                  {formatPrice(nightRate.finalRate)}
                </td>
              </tr>
            ))}
            <tr className={styles.totalsRow}>
              <td className={styles.totalsLabel}>
                <strong>TOTALES</strong>
              </td>
              <td className={styles.totalsBasePrice}>
                <strong>{formatPrice(totalBasePrice)}</strong>
              </td>
              <td className={styles.totalsModifications}>
                <strong>{formatPrice(totalDynamicModifications)}</strong>
              </td>
              <td className={styles.totalsFinal}>
                <strong>{formatPrice(totalFinalPrice)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={styles.summary}>
        <div className={styles.summaryCard}>
          <h4>Resumen</h4>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>
              <span className={styles.label}>Total final:</span>
              <span className={styles.value}>{formatPrice(totalFinalPrice)}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.label}>Noches:</span>
              <span className={styles.value}>{reservation.nightRates.length}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.label}>Promedio por noche:</span>
              <span className={styles.value}>{formatPrice(totalFinalPrice / reservation.nightRates.length)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReservationPricingDetails; 