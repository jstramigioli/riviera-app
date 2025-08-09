import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import usePageTitle from '../hooks/usePageTitle';
import logoHotel from '../assets/logo-hotel.png';
import styles from '../styles/App.module.css';

function Header() {
  const location = useLocation();
  usePageTitle(); // Esto manejará el título dinámico de la página
  
  return (
    <nav className={styles.navigation}>
      <div className={styles.navLeft}>
        <div className={styles.logoContainer}>
          <img src={logoHotel} alt="Hotel Riviera" className={styles.logo} />
        </div>
        <div className={styles.navLinks}>
          <Link 
            to="/libro-de-reservas" 
            className={`${styles.navLink} ${location.pathname === '/libro-de-reservas' ? styles.active : ''}`}
          >
            Libro de Reservas
          </Link>
          <Link 
            to="/consultas-reservas" 
            className={`${styles.navLink} ${location.pathname === '/consultas-reservas' ? styles.active : ''}`}
          >
            Consultas y Reservas
          </Link>
          <Link 
            to="/tarifas" 
            className={`${styles.navLink} ${location.pathname === '/tarifas' ? styles.active : ''}`}
          >
            Tarifas
          </Link>
          <Link 
            to="/cobros-pagos" 
            className={`${styles.navLink} ${location.pathname === '/cobros-pagos' ? styles.active : ''}`}
          >
            Cobros y Pagos
          </Link>
          <Link 
            to="/estadisticas" 
            className={`${styles.navLink} ${location.pathname === '/estadisticas' ? styles.active : ''}`}
          >
            Estadísticas
          </Link>
        </div>
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