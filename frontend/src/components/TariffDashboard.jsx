import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CurrentRatesSummary from './tarifas/CurrentRatesSummary';
import IntelligentPricingStatus from './tarifas/IntelligentPricingStatus';
import ActiveSeasonBlocks from './tarifas/ActiveSeasonBlocks';
import QuickActions from './tarifas/QuickActions';
import styles from '../styles/TariffDashboard.module.css';

export default function TariffDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Simular carga inicial
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className={styles.dashboardContainer}>
        <div className={styles.loading}>Cargando información de tarifas...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.dashboardContainer}>
        <div className={styles.error}>
          Error al cargar las tarifas: {error}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.header}>
        <h1 className={styles.title}>💰 Gestión de Tarifas</h1>
        <p className={styles.subtitle}>
          Consulta y gestiona las tarifas del hotel, precios inteligentes y bloques de temporada
        </p>
      </div>

      <div className={styles.grid}>
        {/* Resumen de tarifas actuales */}
        <div className={styles.card}>
          <CurrentRatesSummary />
        </div>

        {/* Estado de precios inteligentes */}
        <div className={styles.card}>
          <IntelligentPricingStatus />
        </div>

        {/* Bloques de temporada activos */}
        <div className={styles.card}>
          <ActiveSeasonBlocks />
        </div>

        {/* Acciones rápidas */}
        <div className={styles.card}>
          <QuickActions />
        </div>
      </div>
    </div>
  );
} 