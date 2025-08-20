import React, { useState, useEffect } from 'react';
import styles from '../../styles/TariffDashboard.module.css';

export default function IntelligentPricingStatus() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        // Cargar estado de precios inteligentes
        const response = await fetch('/api/dynamic-pricing/config/default-hotel');
        const config = await response.json();
        
        setIsEnabled(config.enabled || false);
        setLastUpdate(config.updatedAt || new Date().toISOString());
        setLoading(false);
      } catch (error) {
        console.error('Error loading intelligent pricing status:', error);
        setIsEnabled(false);
        setLoading(false);
      }
    };

    loadStatus();
  }, []);

  const handleToggle = async () => {
    try {
      const newStatus = !isEnabled;
      
      const response = await fetch('/api/dynamic-pricing/config/default-hotel', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled: newStatus
        }),
      });

      if (response.ok) {
        setIsEnabled(newStatus);
        setLastUpdate(new Date().toISOString());
      } else {
        throw new Error('Error al actualizar el estado');
      }
    } catch (error) {
      console.error('Error toggling intelligent pricing:', error);
      alert('Error al cambiar el estado de precios inteligentes');
    }
  };

  if (loading) {
    return (
      <div className={styles.cardContent}>
        <h3 className={styles.cardTitle}>🧠 Precios Inteligentes</h3>
        <div className={styles.loading}>Cargando estado...</div>
      </div>
    );
  }

  return (
    <div className={styles.cardContent}>
      <h3 className={styles.cardTitle}>🧠 Precios Inteligentes</h3>
      
      <div className={styles.statusContainer}>
        <div className={styles.statusIndicator}>
          <div className={`${styles.statusDot} ${isEnabled ? styles.enabled : styles.disabled}`}></div>
          <span className={styles.statusText}>
            {isEnabled ? 'Activado' : 'Desactivado'}
          </span>
        </div>
        
        <button 
          className={`${styles.toggleButton} ${isEnabled ? styles.enabled : styles.disabled}`}
          onClick={handleToggle}
        >
          {isEnabled ? 'Desactivar' : 'Activar'}
        </button>
      </div>

      <div className={styles.statusDescription}>
        <p>
          {isEnabled 
            ? 'Los precios se ajustan automáticamente según la demanda y temporada.'
            : 'Los precios se mantienen fijos según la configuración manual.'
          }
        </p>
      </div>

      {lastUpdate && (
        <div className={styles.cardFooter}>
          <small className={styles.lastUpdate}>
            Última actualización: {new Date(lastUpdate).toLocaleDateString('es-AR')}
          </small>
        </div>
      )}
    </div>
  );
} 