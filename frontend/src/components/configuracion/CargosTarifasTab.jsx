import React, { useState, useEffect } from 'react';
import TariffManagement from './TariffManagement';
import SubcategoriasCargosTab from './SubcategoriasCargosTab';
import styles from './CargosTarifasTab.module.css';

const CargosTarifasTab = ({ hideTariffConfig = false }) => {
  const defaultTab = hideTariffConfig ? 'servicios' : 'alojamiento';
  const [activeSubTab, setActiveSubTab] = useState(() => {
    const saved = localStorage.getItem('cargosTarifasActiveTab');
    if (hideTariffConfig && saved === 'alojamiento') return 'servicios';
    return saved || defaultTab;
  });

  useEffect(() => {
    localStorage.setItem('cargosTarifasActiveTab', activeSubTab);
  }, [activeSubTab]);

  const subTabs = [
    !hideTariffConfig && {
      id: 'alojamiento',
      label: 'Alojamiento',
      descripcion: 'Configurar tarifas por tipo de habitación y servicios'
    },
    {
      id: 'servicios',
      label: 'Servicios',
      descripcion: 'Gestionar subcategorías de servicios adicionales'
    },
    {
      id: 'consumos',
      label: 'Consumos',
      descripcion: 'Configurar categorías de consumos y minibar'
    },
    {
      id: 'otros',
      label: 'Otros',
      descripcion: 'Otros tipos de cargos no clasificados'
    }
  ].filter(Boolean);

  const renderSubTabContent = () => {
    switch (activeSubTab) {
      case 'alojamiento':
        return hideTariffConfig ? <SubcategoriasCargosTab tipo="SERVICIO" /> : <TariffManagement />;
      case 'servicios':
        return <SubcategoriasCargosTab tipo="SERVICIO" />;
      case 'consumos':
        return <SubcategoriasCargosTab tipo="CONSUMO" />;
      case 'otros':
        return <SubcategoriasCargosTab tipo="OTRO" />;
      default:
        return <SubcategoriasCargosTab tipo="SERVICIO" />;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h2>{hideTariffConfig ? 'Categorías de Cargos' : 'Cargos y Tarifas'}</h2>
          <p>
            {hideTariffConfig
              ? 'Subcategorías para cargos manuales de servicios, consumos y otros'
              : 'Configuración de tipos de cargo y estructura de tarifas'}
          </p>
        </div>
      </div>

      <div className={styles.subTabsContainer}>
        <div className={styles.subTabs}>
          {subTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`${styles.subTab} ${activeSubTab === tab.id ? styles.active : ''}`}
              title={tab.descripcion}
            >
              <div className={styles.subTabContent}>
                <div className={styles.subTabLabel}>{tab.label}</div>
                <div className={styles.subTabDescription}>{tab.descripcion}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.subTabContent}>
        {renderSubTabContent()}
      </div>
    </div>
  );
};

export default CargosTarifasTab;
