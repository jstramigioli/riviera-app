import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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

const VALID_TABS = new Set([
  'hotel',
  'habitaciones',
  'cargos-tarifas',
  'calendario',
  'tipo-cambio',
  'usuarios',
  'sistema'
]);

function ConfiguracionView() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('tab');
    if (fromUrl && VALID_TABS.has(fromUrl)) return fromUrl;
    return localStorage.getItem('configActiveTab') || 'habitaciones';
  });

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && VALID_TABS.has(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    localStorage.setItem('configActiveTab', activeTab);
  }, [activeTab]);

  const tabs = [
    { id: 'hotel', label: 'Hotel', icon: '🏨' },
    { id: 'habitaciones', label: 'Habitaciones', icon: '🛏️' },
    { id: 'cargos-tarifas', label: 'Cargos y Tarifas', icon: '💰' },
    { id: 'calendario', label: 'Calendario', icon: '📅' },
    { id: 'tipo-cambio', label: 'Tipo de Cambio', icon: '💱' },
    { id: 'usuarios', label: 'Usuarios', icon: '👥' },
    { id: 'sistema', label: 'Sistema', icon: '⚙️' }
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
            <h3>Gestión de Usuarios</h3>
            <p>Esta funcionalidad estará disponible próximamente.</p>
          </div>
        );
      case 'sistema':
        return (
          <div style={{ padding: '20px', textAlign: 'center', color: '#6c757d' }}>
            <h3>Configuración del Sistema</h3>
            <p>Esta funcionalidad estará disponible próximamente.</p>
          </div>
        );
      default:
        return <HabitacionesTab />;
    }
  };

  return (
    <div className={styles.appContainer}>
      <div className={styles.header}>
        <h1 className={styles.title}>Hotel Riviera - Configuración</h1>
        <p className={styles.subtitle}>Gestiona la configuración del sistema</p>
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
              <span>{tab.icon}</span>
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