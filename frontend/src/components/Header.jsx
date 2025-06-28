import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from '../styles/App.module.css';

function Header() {
  const location = useLocation();
  
  return (
    <nav className={styles.navigation}>
      <div className={styles.navLeft}>
        <Link 
          to="/libro-de-reservas" 
          className={`${styles.navLink} ${location.pathname === '/libro-de-reservas' ? styles.active : ''}`}
        >
          Libro de Reservas
        </Link>
        <Link 
          to="/tarifas" 
          className={`${styles.navLink} ${location.pathname === '/tarifas' ? styles.active : ''}`}
        >
          Tarifas
        </Link>
      </div>
      <div className={styles.navRight}>
        <Link 
          to="/configuracion" 
          className={`${styles.navLink} ${styles.configButton} ${location.pathname === '/configuracion' ? styles.active : ''}`}
          title="Configuración"
        >
          ⚙️
        </Link>
      </div>
    </nav>
  );
}

export default Header; 