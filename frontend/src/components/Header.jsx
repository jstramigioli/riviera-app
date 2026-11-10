import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiLogOut, FiSettings, FiUser, FiUsers } from 'react-icons/fi';
import usePageTitle from '../hooks/usePageTitle';
import logoHotel from '../assets/logo-hotel.png';
import { useAuth } from '../contexts/AuthContext';
import { roleLabel } from '../auth/permissions';
import styles from '../styles/App.module.css';

function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, can, logout, switchUser } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  usePageTitle();

  useEffect(() => {
    function onDocClick(event) {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    navigate('/login', { replace: true });
  }

  async function handleSwitchUser() {
    setMenuOpen(false);
    await switchUser();
    navigate('/login', { replace: true, state: { from: location.pathname } });
  }

  return (
    <nav className={styles.navigation}>
      <div className={styles.navLeft}>
        <div className={styles.logoContainer}>
          <img src={logoHotel} alt="Hotel Riviera" className={styles.logo} />
        </div>
        <div className={styles.navLinks}>
          {can('reservas') ? (
            <Link
              to="/libro-de-reservas"
              className={`${styles.navLink} ${location.pathname === '/libro-de-reservas' ? styles.active : ''}`}
            >
              Libro de Reservas
            </Link>
          ) : null}
          {can('reservas') ? (
            <Link
              to="/consultas-reservas"
              className={`${styles.navLink} ${location.pathname === '/consultas-reservas' ? styles.active : ''}`}
            >
              Consultas y Reservas
            </Link>
          ) : null}
          {can('tarifas') ? (
            <Link
              to="/tarifas"
              className={`${styles.navLink} ${location.pathname === '/tarifas' ? styles.active : ''}`}
            >
              Tarifas
            </Link>
          ) : null}
          {can('tarifas') ? (
            <Link
              to="/precios-inteligentes"
              className={`${styles.navLink} ${location.pathname === '/precios-inteligentes' ? styles.active : ''}`}
            >
              Precios Inteligentes
            </Link>
          ) : null}
          {can('finanzas') ? (
            <Link
              to="/cobros-pagos"
              className={`${styles.navLink} ${location.pathname === '/cobros-pagos' ? styles.active : ''}`}
            >
              Cobros y Pagos
            </Link>
          ) : null}
          {can('reportes') ? (
            <Link
              to="/estadisticas"
              className={`${styles.navLink} ${location.pathname === '/estadisticas' ? styles.active : ''}`}
            >
              Estadísticas
            </Link>
          ) : null}
        </div>
      </div>
      <div className={styles.navRight}>
        {can('settings') ? (
          <Link
            to="/configuracion"
            className={`${styles.navLink} ${styles.configButton} ${location.pathname === '/configuracion' ? styles.active : ''}`}
            title="Configuración"
          >
            <FiSettings aria-hidden="true" />
          </Link>
        ) : null}

        <div className={styles.userMenu} ref={menuRef}>
          <button
            type="button"
            className={styles.userMenuButton}
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title="Cuenta"
          >
            <FiUser aria-hidden="true" />
            <span className={styles.userMenuLabel}>
              {user?.displayName || user?.username || 'Usuario'}
              <small>{roleLabel(user?.role)}</small>
            </span>
          </button>
          {menuOpen ? (
            <div className={styles.userMenuDropdown} role="menu">
              <button type="button" role="menuitem" onClick={handleSwitchUser}>
                <FiUsers aria-hidden="true" />
                Cambiar de usuario
              </button>
              <button type="button" role="menuitem" onClick={handleLogout}>
                <FiLogOut aria-hidden="true" />
                Cerrar sesión
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}

export default Header;
