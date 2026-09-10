import React, { useState } from 'react';
import DynamicPricingConfigPanel from '../components/configuracion/DynamicPricingConfigPanel';
import styles from '../styles/App.module.css';

function PreciosInteligentesView() {
  const [activeTab, setActiveTab] = useState('config');

  const tabs = [
    { id: 'config', label: 'Configuración', icon: '⚙️' },
    { id: 'info', label: 'Estado MVP', icon: 'ℹ️' }
  ];

  const renderTabContent = () => {
    if (activeTab === 'info') {
      return (
        <div style={{ padding: '8px 4px', color: '#495057', maxWidth: 720 }}>
          <h3 style={{ marginTop: 0 }}>Precios inteligentes (beta)</h3>
          <p>
            Podés ajustar pesos y factores de ocupación aquí. La cotización del MVP
            usa los <strong>bloques de temporada</strong> (Tarifas / Configuración → Cargos y Tarifas).
          </p>
          <p style={{ color: '#6c757d' }}>
            Reglas de comidas y curvas operacionales legacy no están disponibles en el esquema actual.
          </p>
        </div>
      );
    }
    return <DynamicPricingConfigPanel hotelId="default-hotel" />;
  };

  return (
    <div className={styles.appContainer}>
      <div className={styles.header}>
        <h1 className={styles.title}>Precios Inteligentes</h1>
        <p className={styles.subtitle}>Ajustes dinámicos opcionales sobre la tarifa base</p>
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
        <div className={styles.configPanel} style={{ padding: 20, overflow: 'auto' }}>
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}

export default PreciosInteligentesView;
