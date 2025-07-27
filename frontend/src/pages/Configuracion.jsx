import React, { useState, useEffect } from 'react';
import styles from '../styles/App.module.css';
import HabitacionesTab from '../components/configuracion/HabitacionesTab';
import EtiquetasTab from '../components/configuracion/EtiquetasTab';
import DynamicPricingConfigPanel from '../components/configuracion/DynamicPricingConfigPanel';
import SeasonalCurveWrapper from '../components/configuracion/SeasonalCurveWrapper';
import MealPricingEditor from '../components/configuracion/MealPricingEditor';
import CoefficientsPanel from '../components/configuracion/CoefficientsPanel';
import OperationalPeriodsPanel from '../components/configuracion/OperationalPeriodsPanel';
import TarifasPreviewPanel from '../components/configuracion/TarifasPreviewPanel';

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
    { id: 'habitaciones', label: 'Habitaciones', icon: '🏨' },
    { id: 'tarifas', label: 'Tarifas', icon: '💰' },
    { id: 'usuarios', label: 'Usuarios', icon: '👥' },
    { id: 'sistema', label: 'Sistema', icon: '⚙️' }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'habitaciones':
        return (
          <div style={{ 
            display: 'flex', 
            gap: '24px',
            minHeight: 'calc(100vh - 300px)'
          }}>
            {/* Columna izquierda - Gestión de Habitaciones */}
            <div style={{ 
              flex: '2',
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden'
            }}>
              <div style={{ padding: '24px', overflow: 'auto', maxHeight: 'calc(100vh - 400px)' }}>
                <HabitacionesTab />
              </div>
            </div>

            {/* Columna derecha - Gestión de Etiquetas */}
            <div style={{ 
              flex: '1',
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden'
            }}>
              <div style={{ 
                padding: '24px 24px 0 24px',
                borderBottom: '2px solid #e9ecef'
              }}>
                <h2 style={{ 
                  margin: '0 0 16px 0', 
                  color: '#2c3e50', 
                  fontSize: '1.5rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span>🏷️</span>
                  Gestión de Etiquetas
                </h2>
              </div>
              
              <div style={{ 
                padding: '24px',
                overflow: 'auto',
                maxHeight: 'calc(100vh - 400px)'
              }}>
                <EtiquetasTab />
              </div>
            </div>
          </div>
        );
      case 'tarifas':
        return (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: '24px',
            padding: '24px',
            paddingBottom: '50px'
          }}>
            {/* Configuración de tarifas dinámicas */}
            <div style={{ 
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}>
              <DynamicPricingConfigPanel />
            </div>

            {/* Editor de curva estacional */}
            <div style={{ 
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}>
              <SeasonalCurveWrapper />
            </div>

            {/* Fila con previsualización de tarifas y configuración de coeficientes */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', // Reducir minmax
              gap: '24px',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              {/* Previsualización de tarifas */}
              <TarifasPreviewPanel />

              {/* Configuración de coeficientes */}
              <CoefficientsPanel />
            </div>

            {/* Fila con configuración de comidas y períodos de apertura */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', // Reducir minmax
              gap: '24px',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              {/* Configuración de comidas */}
              <div style={{ 
                backgroundColor: 'white',
                borderRadius: '12px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
              }}>
                <MealPricingEditor />
              </div>

              {/* Períodos de apertura */}
              <OperationalPeriodsPanel />
            </div>
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
        padding: '20px',
        height: 'calc(100vh - 200px)', // Altura fija
        display: 'flex',
        flexDirection: 'column',
        marginRight: '20px', // Margin derecho para ver la scrollbar
        boxSizing: 'border-box', // Incluir padding en el ancho
        maxWidth: '100vw', // Máximo ancho de la ventana
        overflow: 'hidden' // Evitar overflow horizontal
      }}>
        {/* Pestañas principales */}
        <div style={{ 
          display: 'flex', 
          borderBottom: '2px solid #e9ecef',
          marginBottom: '24px',
          backgroundColor: 'white',
          borderRadius: '12px 12px 0 0',
          padding: '0 24px',
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
          marginRight: '10px', // Margin derecho para ver la scrollbar
          width: '100%', // Ancho completo
          boxSizing: 'border-box', // Incluir padding en el ancho
          maxWidth: 'calc(100% - 10px)' // Ajustar por el margin
        }}>
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}

export default ConfiguracionView; 