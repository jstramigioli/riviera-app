import React, { useState, useEffect } from 'react';
import { FiSettings, FiSave, FiInfo } from 'react-icons/fi';
import styles from './RoundingConfigPanel.module.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const RoundingConfigPanel = ({ hotelId = 'default-hotel' }) => {
  const [config, setConfig] = useState({
    multiple: 1,
    mode: 'nearest'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  const multipleOptions = [
    { value: 1, label: 'Sin redondeo (1)' },
    { value: 10, label: 'Decenas (10)' },
    { value: 100, label: 'Centenas (100)' },
    { value: 500, label: 'Quinientos (500)' },
    { value: 1000, label: 'Miles (1000)' }
  ];

  const modeOptions = [
    { value: 'nearest', label: 'Al más cercano', description: 'Redondea al múltiplo más cercano' },
    { value: 'ceil', label: 'Hacia arriba', description: 'Siempre redondea hacia arriba' },
    { value: 'floor', label: 'Hacia abajo', description: 'Siempre redondea hacia abajo' }
  ];

  useEffect(() => {
    loadConfig();
  }, [hotelId]);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/rounding-config?hotelId=${hotelId}`);
      if (!response.ok) {
        throw new Error('Error al cargar la configuración de redondeo');
      }

      const result = await response.json();
      if (result.data) {
        setConfig({
          multiple: result.data.multiple,
          mode: result.data.mode
        });
      }
    } catch (err) {
      console.error('Error loading rounding config:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/rounding-config?hotelId=${hotelId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.errors?.[0] || 'Error al guardar la configuración');
      }

      showNotification('Configuración de redondeo guardada correctamente');
    } catch (err) {
      console.error('Error saving rounding config:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 3000);
  };

  const updateConfig = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  // Función de ejemplo para mostrar cómo funciona el redondeo
  const getExampleRounding = (price) => {
    const { multiple, mode } = config;
    
    if (multiple === 1) return price;
    
    switch (mode) {
      case 'ceil':
        return Math.ceil(price / multiple) * multiple;
      case 'floor':
        return Math.floor(price / multiple) * multiple;
      case 'nearest':
      default:
        return Math.round(price / multiple) * multiple;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className={styles.panel}>
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}></div>
          <span>Cargando configuración...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      {/* Notificación */}
      {notification.show && (
        <div className={`${styles.notification} ${styles[notification.type]}`}>
          {notification.message}
        </div>
      )}

      <div className={styles.header}>
        <h3>
          <FiSettings />
          Configuración de Redondeo
        </h3>
        <p>Define cómo se redondean los precios calculados en todo el sistema de tarifas.</p>
      </div>

      {error && (
        <div className={styles.error}>
          <span>{error}</span>
          <button onClick={() => setError(null)} className={styles.errorClose}>×</button>
        </div>
      )}

      <div className={styles.content}>
        {/* Configuración de múltiplo */}
        <div className={styles.configSection}>
          <label className={styles.sectionLabel}>Múltiplo de Redondeo</label>
          <p className={styles.sectionDescription}>
            Selecciona a qué múltiplo se deben redondear los precios.
          </p>
          
          <div className={styles.optionsGrid}>
            {multipleOptions.map(option => (
              <label key={option.value} className={styles.radioOption}>
                <input
                  type="radio"
                  name="multiple"
                  value={option.value}
                  checked={config.multiple === option.value}
                  onChange={(e) => updateConfig('multiple', parseInt(e.target.value))}
                />
                <span className={styles.radioLabel}>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Configuración de modo */}
        <div className={styles.configSection}>
          <label className={styles.sectionLabel}>Modo de Redondeo</label>
          <p className={styles.sectionDescription}>
            Define la dirección del redondeo cuando el precio no es exacto.
          </p>
          
          <div className={styles.modeOptions}>
            {modeOptions.map(option => (
              <label key={option.value} className={styles.modeOption}>
                <input
                  type="radio"
                  name="mode"
                  value={option.value}
                  checked={config.mode === option.value}
                  onChange={(e) => updateConfig('mode', e.target.value)}
                />
                <div className={styles.modeContent}>
                  <span className={styles.modeLabel}>{option.label}</span>
                  <span className={styles.modeDescription}>{option.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Ejemplos de redondeo */}
        {config.multiple > 1 && (
          <div className={styles.examplesSection}>
            <div className={styles.examplesHeader}>
              <FiInfo />
              <span>Ejemplos de Redondeo</span>
            </div>
            
            <div className={styles.examplesGrid}>
              {[1250, 1275, 1499, 1850, 2340].map(price => {
                const rounded = getExampleRounding(price);
                const wasRounded = price !== rounded;
                
                return (
                  <div key={price} className={styles.exampleItem}>
                    <span className={styles.originalPrice}>{formatCurrency(price)}</span>
                    <span className={styles.arrow}>→</span>
                    <span className={`${styles.roundedPrice} ${wasRounded ? styles.changed : styles.unchanged}`}>
                      {formatCurrency(rounded)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Botones de acción */}
        <div className={styles.actions}>
          <button
            onClick={saveConfig}
            disabled={saving}
            className={styles.saveButton}
          >
            <FiSave />
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoundingConfigPanel; 