import React, { useState, useEffect } from 'react';
import TariffManagement from './TariffManagement';
import SubcategoriasCargosTab from './SubcategoriasCargosTab';
import styles from './CargosTarifasTab.module.css';

const CargosTarifasTab = () => {
  const [activeSubTab, setActiveSubTab] = useState(() => {
    return localStorage.getItem('cargosTarifasActiveTab') || 'alojamiento';
  });

  useEffect(() => {
    localStorage.setItem('cargosTarifasActiveTab', activeSubTab);
  }, [activeSubTab]);

  const subTabs = [
    { id: 'alojamiento', label: 'Alojamiento' },
    { id: 'servicios', label: 'Servicios' },
    { id: 'consumos', label: 'Consumos' },
    { id: 'otros', label: 'Otros' }
  ];

  const renderSubTabContent = () => {
    switch (activeSubTab) {
      case 'alojamiento':
        return <TariffManagement />;
      case 'servicios':
        return <SubcategoriasCargosTab tipo="SERVICIO" />;
      case 'consumos':
        return <SubcategoriasCargosTab tipo="CONSUMO" />;
      case 'otros':
        return <SubcategoriasCargosTab tipo="OTRO" />;
      default:
        return <TariffManagement />;
    }
  };

  return (
    <div className={styles.container}>
      <nav className={styles.typeTabs} aria-label="Tipos de cargo">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSubTab(tab.id)}
            className={`${styles.typeTab} ${activeSubTab === tab.id ? styles.active : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className={styles.body}>{renderSubTabContent()}</div>
    </div>
  );
};

export default CargosTarifasTab;
