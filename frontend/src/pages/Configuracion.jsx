import React, { useState, useEffect } from 'react';
import styles from '../styles/App.module.css';
import HabitacionesTab from '../components/configuracion/HabitacionesTab';
import CargosTarifasTab from '../components/configuracion/CargosTarifasTab';
import HotelConfigPanel from '../components/configuracion/HotelConfigPanel';
import CalendarioTab from '../components/configuracion/CalendarioTab';
import TipoCambioConfig from '../components/TipoCambioConfig';

const VALID_TABS = ['hotel', 'habitaciones', 'cargos-tarifas', 'calendario', 'tipo-cambio'];

function ConfiguracionView() {
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('configActiveTab');
    return VALID_TABS.includes(saved) ? saved : 'habitaciones';
  });

  useEffect(() => {
    localStorage.setItem('configActiveTab', activeTab);
  }, [activeTab]);

  const tabs = [
    { id: 'hotel', label: 'Hotel', icon: '🏨' },
    { id: 'habitaciones', label: 'Habitaciones', icon: '🛏️' },
    { id: 'cargos-tarifas', label: 'Cargos y Tarifas', icon: '💰' },
    { id: 'calendario', label: 'Calendario', icon: '📅' },
    { id: 'tipo-cambio', label: 'Tipo de Cambio', icon: '💱' }
  ];

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
        return <CargosTarifasTab />;
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
        <p className={styles.subtitle}>Hotel, habitaciones, tarifas operativas y tipo de cambio</p>
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
