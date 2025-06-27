import React, { useEffect, useState } from 'react';
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
        return '⚠️';
      case 'warning':
        return '⚠️';
      case 'success':
        return '✅';
      case 'info':
        return 'ℹ️';
      default:
        return '⚠️';
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