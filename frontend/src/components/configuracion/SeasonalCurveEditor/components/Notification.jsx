import React from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaInfoCircle } from 'react-icons/fa';
import styles from '../SeasonalCurveEditor.module.css';

export default function Notification({ notification }) {
  if (!notification.show) return null;

  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <FaCheckCircle />;
      case 'error':
        return <FaExclamationTriangle />;
      default:
        return <FaInfoCircle />;
    }
  };

  const getClassName = () => {
    return `${styles.notification} ${styles[notification.type]}`;
  };

  return (
    <div className={getClassName()}>
      <span className={styles.notificationIcon}>
        {getIcon()}
      </span>
      <span className={styles.notificationMessage}>
        {notification.message}
      </span>
    </div>
  );
} 