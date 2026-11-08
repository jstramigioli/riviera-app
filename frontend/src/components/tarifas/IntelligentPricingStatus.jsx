import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/TariffDashboard.module.css';

export default function IntelligentPricingStatus() {
  const navigate = useNavigate();
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const response = await fetch('/api/dynamic-pricing/config/default-hotel');
        const config = await response.json();
        setIsEnabled(Boolean(config.enabled));
      } catch (error) {
        console.error('Error loading intelligent pricing status:', error);
        setIsEnabled(false);
      } finally {
        setLoading(false);
      }
    };

    loadStatus();
  }, []);

  if (loading) {
    return (
      <div className={styles.cardContent}>
        <h3 className={styles.cardTitle}>Precios inteligentes</h3>
        <div className={styles.loading}>Cargando estado...</div>
      </div>
    );
  }

  return (
    <div className={styles.cardContent}>
      <h3 className={styles.cardTitle}>Precios inteligentes</h3>
      
      <div className={styles.statusContainer}>
        <div className={styles.statusIndicator}>
          <div className={`${styles.statusDot} ${styles.disabled}`}></div>
          <span className={styles.statusText}>Fuera del path canónico</span>
        </div>
      </div>

      <div className={styles.statusDescription}>
        <p>
          Configuración experimental
          {isEnabled ? ' (flag interno activo)' : ''}.
          No se aplica en Consulta, confirmación de reserva ni cargos.
          El precio operativo sale de bloques de temporada + % servicio + redondeo.
        </p>
      </div>

      <div className={styles.cardFooter}>
        <button
          className={styles.toggleButton}
          onClick={() => navigate('/precios-inteligentes')}
          type="button"
        >
          Ver laboratorio
        </button>
      </div>
    </div>
  );
}
