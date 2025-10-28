import React, { useState, useEffect } from 'react';
import TariffManagement from './TariffManagement'; // Componente actual de tarifas
import SubcategoriasCargosTab from './SubcategoriasCargosTab';
import styles from './CargosTarifasTab.module.css';

const CargosTarifasTab = () => {
  const [activeSubTab, setActiveSubTab] = useState(() => {
    return localStorage.getItem('cargosTarifasActiveTab') || 'alojamiento';
  });

  // Guardar sub-pestaña activa
  useEffect(() => {
    localStorage.setItem('cargosTarifasActiveTab', activeSubTab);
  }, [activeSubTab]);

  const subTabs = [
    { 
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
      {/* Header principal */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h2>Cargos y Tarifas</h2>
          <p>Configuración de tipos de cargo y estructura de tarifas</p>
        </div>
      </div>

      {/* Sub-pestañas */}
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

      {/* Contenido de la sub-pestaña activa */}
      <div className={styles.subTabContent}>
        {renderSubTabContent()}
      </div>
    </div>
  );
};

export default CargosTarifasTab;
