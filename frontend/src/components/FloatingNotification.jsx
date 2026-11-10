import React, { useEffect, useState } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiInfo } from 'react-icons/fi';
import '../styles/FloatingNotification.css';

const FloatingNotification = ({ 
  message, 
  type = 'error', 
  position = { x: 0, y: 0 }, 
  onClose, 
  duration = 3000 
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => {
        if (onClose) onClose();
      }, 300); // Tiempo para la animación de salida
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'error':
      case 'warning':
        return <FiAlertTriangle aria-hidden="true" />;
      case 'success':
        return <FiCheckCircle aria-hidden="true" />;
      case 'info':
        return <FiInfo aria-hidden="true" />;
      default:
        return <FiAlertTriangle aria-hidden="true" />;
    }
  };

  return (
    <div 
      className={`floating-notification ${type} ${isVisible ? 'visible' : 'hidden'}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y - 60}px`, // Aparece arriba del cursor
      }}
    >
      <div className="notification-content">
        <span className="notification-icon">{getIcon()}</span>
        <span className="notification-message">{message}</span>
      </div>
    </div>
  );
};

export default FloatingNotification; 