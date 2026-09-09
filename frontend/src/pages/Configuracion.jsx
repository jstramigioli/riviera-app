import React, { useState, useEffect } from 'react';
import styles from '../styles/App.module.css';
import HabitacionesTab from '../components/configuracion/HabitacionesTab';
import CargosTarifasTab from '../components/configuracion/CargosTarifasTab';
import HotelConfigPanel from '../components/configuracion/HotelConfigPanel';
import CalendarioTab from '../components/configuracion/CalendarioTab';
import TipoCambioConfig from '../components/TipoCambioConfig';
import FEATURE_FLAGS from '../config/featureFlags';

const ALL_TABS = [
  { id: 'hotel', label: 'Hotel', icon: '🏨' },
  { id: 'habitaciones', label: 'Habitaciones', icon: '🛏️' },
  { id: 'cargos-tarifas', label: 'Categorías de Cargos', icon: '💰' },
  { id: 'calendario', label: 'Calendario', icon: '📅' },
  { id: 'tipo-cambio', label: 'Tipo de Cambio', icon: '💱' }
];

const VALID_TABS = ALL_TABS.map((t) => t.id);

function ConfiguracionView() {
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('configActiveTab');
    return VALID_TABS.includes(saved) ? saved : 'habitaciones';
  });

  useEffect(() => {
    localStorage.setItem('configActiveTab', activeTab);
  }, [activeTab]);

  const tabs = ALL_TABS;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'hotel':
        return (
          <div style={{ display: 'flex', gap: '16px', padding: '16px' }}>
            <div style={{
              flex: '1',
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden'
            }}>
              <HotelConfigPanel />
            </div>
          </div>
        );
      case 'habitaciones':
        return (
          <div style={{ padding: '16px' }}>
            <HabitacionesTab />
          </div>
        );
      case 'cargos-tarifas':
        return <CargosTarifasTab hideTariffConfig={!FEATURE_FLAGS.DYNAMIC_PRICING_UI} />;
      case 'calendario':
        return <CalendarioTab />;
      case 'tipo-cambio':
        return (
          <div style={{ padding: '16px' }}>
            <TipoCambioConfig />
          </div>
        );
      default:
        return <HabitacionesTab />;
    }
  };

  return (
    <div className={styles.appContainer}>
      <div className={styles.header}>
        <h1 className={styles.title}>Configuración</h1>
        <p className={styles.subtitle}>
          Hotel, habitaciones, categorías de cargos y tipo de cambio
          {!FEATURE_FLAGS.DYNAMIC_PRICING_UI && ' (tarifas automáticas deshabilitadas en este MVP)'}
        </p>
      </div>

      <div className={styles.configShell}>
        <div className={styles.configTabs}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`${styles.configTab} ${activeTab === tab.id ? styles.configTabActive : ''}`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className={`${styles.configTabContainer} ${styles.configPanel}`}>
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}

export default ConfiguracionView;
