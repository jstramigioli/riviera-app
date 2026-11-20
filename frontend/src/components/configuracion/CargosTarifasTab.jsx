import React, { useState, useEffect } from 'react';
import TariffManagement from './TariffManagement';
import SubcategoriasCargosTab from './SubcategoriasCargosTab';
import { CARGOS_SUBTABS } from '../../pages/configNav';
import styles from './CargosTarifasTab.module.css';

const CargosTarifasTab = ({ forcedSubTab, onSubTabChange }) => {
  const [activeSubTab, setActiveSubTab] = useState(() => {
    if (forcedSubTab) return forcedSubTab;
    return localStorage.getItem('cargosTarifasActiveTab') || 'alojamiento';
  });

  useEffect(() => {
    if (forcedSubTab && forcedSubTab !== activeSubTab) {
      setActiveSubTab(forcedSubTab);
    }
  }, [forcedSubTab, activeSubTab]);

  useEffect(() => {
    localStorage.setItem('cargosTarifasActiveTab', activeSubTab);
  }, [activeSubTab]);

  const selectSubTab = (id) => {
    setActiveSubTab(id);
    if (typeof onSubTabChange === 'function') {
      onSubTabChange(id);
    }
  };

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
        {CARGOS_SUBTABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => selectSubTab(tab.id)}
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
