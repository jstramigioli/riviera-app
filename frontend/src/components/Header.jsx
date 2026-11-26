import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiLogOut, FiSettings, FiUser, FiUsers } from 'react-icons/fi';
import usePageTitle from '../hooks/usePageTitle';
import logoHotel from '../assets/logo-hotel.png';
import { useAuth } from '../contexts/AuthContext';
import { roleLabel } from '../auth/permissions';
import GlobalNavSearch from './GlobalNavSearch';
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

  const showConfig = can('settings') || can('auditoria');
  const showAlojamiento = can('reservas') || can('clientes');
  const consultasSection = new URLSearchParams(location.search).get('section');
  const alojamientoActive =
    location.pathname === '/libro-de-reservas' ||
    location.pathname === '/consultas-reservas' ||
    location.pathname.startsWith('/habitaciones') ||
    location.pathname.startsWith('/rooms/') ||
    location.pathname.startsWith('/clientes') ||
    location.pathname.startsWith('/clients/');

  return (
    <nav className={styles.navigation}>
      <div className={styles.navLeft}>
        <div className={styles.logoContainer}>
          <img src={logoHotel} alt="Hotel Riviera" className={styles.logo} />
        </div>
        <div className={styles.navLinks}>
          {can('reservas') ? (
            <Link
              to="/dashboard"
              className={`${styles.navLink} ${location.pathname === '/' || location.pathname === '/dashboard' ? styles.active : ''}`}
            >
              Dashboard
            </Link>
          ) : null}
          {showAlojamiento ? (
            <div className={styles.navDropdown}>
              <span
                className={`${styles.navLink} ${styles.navDropdownTrigger} ${alojamientoActive ? styles.active : ''}`}
                aria-haspopup="true"
              >
                Alojamiento
              </span>
              <div className={styles.navDropdownMenu} role="menu">
                {can('reservas') ? (
                  <Link
                    to="/libro-de-reservas"
                    role="menuitem"
                    className={`${styles.navDropdownItem} ${location.pathname === '/libro-de-reservas' ? styles.navDropdownItemActive : ''}`}
                  >
                    Libro de reservas
                  </Link>
                ) : null}
                {can('reservas') ? (
                  <Link
                    to="/consultas-reservas?section=consultas"
                    role="menuitem"
                    className={`${styles.navDropdownItem} ${location.pathname === '/consultas-reservas' && consultasSection !== 'reservas' ? styles.navDropdownItemActive : ''}`}
                  >
                    Consultas
                  </Link>
                ) : null}
                {can('reservas') ? (
                  <Link
                    to="/consultas-reservas?section=reservas"
                    role="menuitem"
                    className={`${styles.navDropdownItem} ${location.pathname === '/consultas-reservas' && consultasSection === 'reservas' ? styles.navDropdownItemActive : ''}`}
                  >
                    Reservas
                  </Link>
                ) : null}
                {can('reservas') ? (
                  <Link
                    to="/habitaciones"
                    role="menuitem"
                    className={`${styles.navDropdownItem} ${location.pathname.startsWith('/habitaciones') || location.pathname.startsWith('/rooms/') ? styles.navDropdownItemActive : ''}`}
                  >
                    Habitaciones
                  </Link>
                ) : null}
                {can('clientes') ? (
                  <Link
                    to="/clientes"
                    role="menuitem"
                    className={`${styles.navDropdownItem} ${location.pathname.startsWith('/clientes') || location.pathname.startsWith('/clients/') ? styles.navDropdownItemActive : ''}`}
                  >
                    Clientes
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
          {can('reservas') ? (
            <Link
              to="/comedor"
              className={`${styles.navLink} ${location.pathname.startsWith('/comedor') ? styles.active : ''}`}
            >
              Comedor
            </Link>
          ) : null}
          {can('finanzas') ? (
            <Link
              to="/estado-de-cuentas"
              className={`${styles.navLink} ${location.pathname === '/estado-de-cuentas' || location.pathname === '/cobros' ? styles.active : ''}`}
            >
              Estado de cuentas
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
          {can('gastronomia') ? (
            <Link
              to="/gastronomia"
              className={`${styles.navLink} ${location.pathname.startsWith('/gastronomia') ? styles.active : ''}`}
            >
              Gastronomía
            </Link>
          ) : null}
        </div>
      </div>
      <div className={styles.navRight}>
        <GlobalNavSearch />
        {showConfig ? (
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
