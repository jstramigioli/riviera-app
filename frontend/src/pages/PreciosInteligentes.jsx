import React, { useState, useEffect } from 'react';
import DynamicPricingConfigPanel from '../components/configuracion/DynamicPricingConfigPanel';
import MealPricingEditor from '../components/configuracion/MealPricingEditor';
import styles from '../styles/App.module.css';

function PreciosInteligentesView() {
  const [activeTab, setActiveTab] = useState('config');

  const tabs = [
    { id: 'config', label: 'Configuración General', icon: '⚙️' },
    { id: 'meals', label: 'Precios de Comidas', icon: '🍽️' },
    { id: 'preview', label: 'Vista Previa', icon: '👁️' }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'config':
        return <DynamicPricingConfigPanel hotelId="default-hotel" />;
      case 'meals':
        return <MealPricingEditor hotelId="default-hotel" />;
      case 'preview':
        return (
          <div style={{ padding: '20px', textAlign: 'center', color: '#6c757d' }}>
            <h3>Vista Previa de Precios Inteligentes</h3>
            <p>Esta funcionalidad estará disponible próximamente.</p>
          </div>
        );
      default:
        return <DynamicPricingConfigPanel hotelId="default-hotel" />;
    }
  };

  return (
    <div className={styles.appContainer}>
      <div className={styles.header}>
        <h1 className={styles.title}>Precios Inteligentes</h1>
        <p className={styles.subtitle}>Configura el sistema de precios dinámicos</p>
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
                fontWeight: '500',
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
        <div style={{ 
          flex: 1, 
          overflow: 'auto',
          backgroundColor: 'white',
          borderRadius: '0 0 12px 12px',
          padding: '20px'
        }}>
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}

export default PreciosInteligentesView;
