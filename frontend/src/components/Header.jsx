import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import usePageTitle from '../hooks/usePageTitle';
import logoHotel from '../assets/logo-hotel.png';
import styles from '../styles/App.module.css';

const PRIMARY_LINKS = [
  { to: '/libro-de-reservas', label: 'Libro de Reservas', match: ['/', '/libro-de-reservas'] },
  { to: '/consultas-reservas', label: 'Consultas y Reservas', match: ['/consultas-reservas', '/consulta'] },
  { to: '/tarifas', label: 'Tarifas', match: ['/tarifas', '/tarifas/calendario'] },
  { to: '/cobros-pagos', label: 'Cobros y Pagos', match: ['/cobros-pagos'] },
  { to: '/estadisticas', label: 'Clientes', match: ['/estadisticas'] },
  { to: '/precios-inteligentes', label: 'Precios', match: ['/precios-inteligentes'] },
];

function Header() {
  const location = useLocation();
  usePageTitle();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const isActive = (match) => match.some((path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  });

  return (
    <nav className={styles.navigation}>
      <div className={styles.navLeft}>
        <Link to="/libro-de-reservas" className={styles.logoContainer} title="Hotel Riviera">
          <img src={logoHotel} alt="Hotel Riviera" className={styles.logo} />
        </Link>
        <button
          type="button"
          className={styles.menuToggle}
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
        <div className={`${styles.navLinks} ${menuOpen ? styles.navLinksOpen : ''}`}>
          {PRIMARY_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`${styles.navLink} ${isActive(link.match) ? styles.active : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
      <div className={styles.navRight}>
        <Link
          to="/configuracion"
          className={`${styles.navLink} ${styles.configButton} ${isActive(['/configuracion']) ? styles.active : ''}`}
          title="Configuración"
          aria-label="Configuración"
        >
          ⚙️
        </Link>
      </div>
    </nav>
  );
}

export default Header;
