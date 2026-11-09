import React, { useState, useEffect } from 'react';
import { FiHome, FiGrid, FiDollarSign, FiCalendar, FiRefreshCw, FiUsers, FiSettings } from 'react-icons/fi';
import styles from '../styles/App.module.css';
import HabitacionesTab from '../components/configuracion/HabitacionesTab';
import DynamicPricingConfigPanel from '../components/configuracion/DynamicPricingConfigPanel';

import TarifasPreviewPanelV2 from '../components/configuracion/TarifasPreviewPanelV2';
import TarifasPreviewPanelV3 from '../components/configuracion/TarifasPreviewPanelV3';
import TariffManagement from '../components/configuracion/TariffManagement';
import CargosTarifasTab from '../components/configuracion/CargosTarifasTab';
import HotelConfigPanel from '../components/configuracion/HotelConfigPanel';
import CalendarioTab from '../components/configuracion/CalendarioTab';
import TipoCambioConfig from '../components/TipoCambioConfig';

function ConfiguracionView() {
  const [activeTab, setActiveTab] = useState(() => {
    // Recuperar la pestaña activa del localStorage o usar 'habitaciones' por defecto
    return localStorage.getItem('configActiveTab') || 'habitaciones';
  });

  // Guardar la pestaña activa en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem('configActiveTab', activeTab);
  }, [activeTab]);

  const tabs = [
    { id: 'hotel', label: 'Hotel', icon: FiHome },
    { id: 'habitaciones', label: 'Habitaciones', icon: FiGrid },
    { id: 'cargos-tarifas', label: 'Cargos y Tarifas', icon: FiDollarSign },
    { id: 'calendario', label: 'Calendario', icon: FiCalendar },
    { id: 'tipo-cambio', label: 'Tipo de Cambio', icon: FiRefreshCw },
    { id: 'usuarios', label: 'Usuarios', icon: FiUsers },
    { id: 'sistema', label: 'Sistema', icon: FiSettings }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'hotel':
        return (
          <div style={{ 
            display: 'flex', 
            gap: '16px',
            padding: '16px'
          }}>
            {/* Panel de configuración del hotel */}
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
      case 'usuarios':
        return (
          <div style={{ padding: '20px', textAlign: 'center', color: '#6c757d' }}>
            <h3> Gestión de Usuarios</h3>
            <p> Esta funcionalidad estará disponible próximamente.</p>
          </div>
        );
      case 'sistema':
        return (
          <div style={{ padding: '20px', textAlign: 'center', color: '#6c757d' }}>
            <h3> Configuración del Sistema</h3>
            <p> Esta funcionalidad estará disponible próximamente.</p>
          </div>
        );
      default:
        return <HabitacionesTab />;
    }
  };

  return (
    <div className={styles.appContainer}>
      <div className={styles.header}>
        <h1 className={styles.title}> Hotel Riviera - Configuración</h1>
        <p className={styles.subtitle}> Gestiona la configuración del sistema</p>
      </div>
      
      <div style={{ 
        width: '100%', 
        padding: '16px',
        height: 'calc(100vh - 180px)', // Altura ajustada
        display: 'flex',
        flexDirection: 'column',
        marginRight: '16px', // Margin derecho reducido
        boxSizing: 'border-box', // Incluir padding en el ancho
        maxWidth: '100vw', // Máximo ancho de la ventana
        overflow: 'hidden' // Evitar overflow horizontal
      }}>
        {/* Pestañas principales */}
        <div style={{ 
          display: 'flex', 
          borderBottom: '2px solid #e9ecef',
          marginBottom: '16px',
          backgroundColor: 'white',
          borderRadius: '12px 12px 0 0',
          padding: '0 20px',
          flexShrink: 0 // No se encoja
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '16px 24px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: activeTab === tab.id ? '600' : '400',
                color: activeTab === tab.id ? '#667eea' : '#6c757d',
                borderBottom: activeTab === tab.id ? '3px solid #667eea' : '3px solid transparent',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span aria-hidden="true">{tab.icon ? React.createElement(tab.icon) : null}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Contenido de la pestaña activa */}
        <div className={styles.configTabContainer} style={{ 
          backgroundColor: 'white',
          borderRadius: '0 0 12px 12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          overflow: 'auto',
          flex: 1, // Toma el espacio restante
          minHeight: 0, // Permite que se encoja
          width: '100%', // Ancho completo
          boxSizing: 'border-box' // Incluir padding en el ancho
        }}>
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}

export default ConfiguracionView; 