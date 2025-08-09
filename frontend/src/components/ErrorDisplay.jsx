import React from 'react';
import { FiAlertTriangle, FiRefreshCw, FiWifi, FiServer } from 'react-icons/fi';
import styles from '../styles/ErrorDisplay.module.css';

const ErrorDisplay = ({ error, onRetry, title = "Error de Conexión" }) => {
  const getErrorIcon = () => {
    if (error?.includes('fetch') || error?.includes('network')) {
      return <FiWifi className={styles.errorIcon} />;
    }
    if (error?.includes('500') || error?.includes('servidor')) {
      return <FiServer className={styles.errorIcon} />;
    }
    return <FiAlertTriangle className={styles.errorIcon} />;
  };

  const getErrorMessage = () => {
    if (error?.includes('fetch') || error?.includes('network')) {
      return "No se pudo conectar con el servidor. Verifica tu conexión a internet.";
    }
    if (error?.includes('500') || error?.includes('servidor')) {
      return "El servidor está experimentando problemas temporales. Intenta nuevamente en unos minutos.";
    }
    if (error?.includes('operational periods')) {
      return "El sistema está siendo actualizado. Esta funcionalidad ya no está disponible.";
    }
    return "Ocurrió un error inesperado. Por favor, intenta nuevamente.";
  };

  const getErrorDetails = () => {
    if (error?.includes('operational periods')) {
      return "Hemos migrado a un nuevo sistema de gestión de tarifas que no requiere períodos operacionales.";
    }
    return null;
  };

  return (
    <div className={styles.errorContainer}>
      <div className={styles.errorCard}>
        {getErrorIcon()}
        <h2 className={styles.errorTitle}>{title}</h2>
        <p className={styles.errorMessage}>{getErrorMessage()}</p>
        {getErrorDetails() && (
          <div className={styles.errorDetails}>
            <p>{getErrorDetails()}</p>
          </div>
        )}
        {onRetry && (
          <button onClick={onRetry} className={styles.retryButton}>
            <FiRefreshCw className={styles.retryIcon} />
            Reintentar
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorDisplay; 