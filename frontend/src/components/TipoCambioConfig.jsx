import React, { useState, useEffect } from 'react';
import { FiDollarSign, FiSave, FiRefreshCw, FiInfo } from 'react-icons/fi';
import { getTipoCambioUSD, setTipoCambioUSD } from '../services/api';
import styles from './TipoCambioConfig.module.css';

const TipoCambioConfig = () => {
  const [formData, setFormData] = useState({
    tipoCambio: '',
    descripcion: 'Tipo de cambio del dólar estadounidense'
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [currentConfig, setCurrentConfig] = useState(null);

  useEffect(() => {
    loadCurrentConfig();
  }, []);

  const loadCurrentConfig = async () => {
    try {
      setLoading(true);
      const response = await getTipoCambioUSD();
      if (response.tipoCambio) {
        setCurrentConfig(response);
        setFormData(prev => ({
          ...prev,
          tipoCambio: response.tipoCambio.toString(),
          descripcion: response.descripcion || prev.descripcion
        }));
      }
    } catch (error) {
      console.error('Error cargando configuración actual:', error);
      setError('Error al cargar la configuración actual');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.tipoCambio || parseFloat(formData.tipoCambio) <= 0) {
      setError('El tipo de cambio debe ser mayor a 0');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await setTipoCambioUSD(
        parseFloat(formData.tipoCambio),
        formData.descripcion
      );
      
      setSuccess('Tipo de cambio actualizado exitosamente');
      await loadCurrentConfig();
    } catch (err) {
      setError(err.message || 'Error al actualizar el tipo de cambio');
      console.error('Error updating exchange rate:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(price);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>
          <FiDollarSign />
          Configuración de Tipo de Cambio
        </h2>
        <p className={styles.description}>
          Establece el tipo de cambio del dólar estadounidense que se usará por defecto 
          en los nuevos pagos en USD.
        </p>
      </div>

      <div className={styles.content}>
        {/* Configuración actual */}
        {currentConfig && (
          <div className={styles.currentConfig}>
            <h3>Configuración Actual</h3>
            <div className={styles.configInfo}>
              <div className={styles.configRow}>
                <span className={styles.label}>Tipo de cambio:</span>
                <span className={styles.value}>
                  {formatPrice(currentConfig.tipoCambio)} por USD
                </span>
              </div>
              <div className={styles.configRow}>
                <span className={styles.label}>Descripción:</span>
                <span className={styles.value}>{currentConfig.descripcion}</span>
              </div>
              <div className={styles.configRow}>
                <span className={styles.label}>Última actualización:</span>
                <span className={styles.value}>
                  {new Date(currentConfig.actualizado).toLocaleString('es-AR')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Formulario de actualización */}
        <div className={styles.formSection}>
          <h3>Actualizar Tipo de Cambio</h3>
          
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="tipoCambio">
                Nuevo Tipo de Cambio (ARS por USD) *
              </label>
              <input
                id="tipoCambio"
                type="number"
                value={formData.tipoCambio}
                onChange={(e) => handleInputChange('tipoCambio', e.target.value)}
                placeholder="1000.00"
                step="0.01"
                min="0"
                required
              />
              <small className={styles.helpText}>
                <FiInfo />
                Ingresa cuántos pesos argentinos equivalen a 1 dólar estadounidense
              </small>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="descripcion">Descripción</label>
              <input
                id="descripcion"
                type="text"
                value={formData.descripcion}
                onChange={(e) => handleInputChange('descripcion', e.target.value)}
                placeholder="Descripción del tipo de cambio"
              />
            </div>

            {error && (
              <div className={styles.errorMessage}>
                {error}
              </div>
            )}

            {success && (
              <div className={styles.successMessage}>
                {success}
              </div>
            )}

            <div className={styles.actions}>
              <button
                type="button"
                onClick={loadCurrentConfig}
                className={styles.refreshButton}
                disabled={loading}
              >
                <FiRefreshCw />
                Recargar
              </button>
              <button
                type="submit"
                className={styles.submitButton}
                disabled={loading}
              >
                <FiSave />
                {loading ? 'Guardando...' : 'Actualizar Tipo de Cambio'}
              </button>
            </div>
          </form>
        </div>

        {/* Información adicional */}
        <div className={styles.infoSection}>
          <h3>Información Importante</h3>
          <div className={styles.infoList}>
            <div className={styles.infoItem}>
              <FiInfo />
              <span>
                El tipo de cambio se aplicará automáticamente a los nuevos pagos en USD
              </span>
            </div>
            <div className={styles.infoItem}>
              <FiInfo />
              <span>
                Los usuarios pueden sobrescribir este valor al crear un pago específico
              </span>
            </div>
            <div className={styles.infoItem}>
              <FiInfo />
              <span>
                Una vez guardado un pago, el tipo de cambio queda congelado y no se recalcula
              </span>
            </div>
            <div className={styles.infoItem}>
              <FiInfo />
              <span>
                Todos los cálculos de saldos y reportes se realizan en pesos argentinos
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TipoCambioConfig;
