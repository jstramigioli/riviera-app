import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const APP_NAME = 'Hotel Riviera';

const ROUTE_TITLES = {
  '/': 'Dashboard',
  '/dashboard': 'Dashboard',
  '/libro-de-reservas': 'Libro de Reservas',
  '/consultas-reservas': 'Consultas y Reservas',
  '/habitaciones': 'Habitaciones',
  '/clientes': 'Clientes',
  '/comedor': 'Comedor',
  '/cobros': 'Estado de cuentas',
  '/estado-de-cuentas': 'Estado de cuentas',
  '/estadisticas': 'Estadísticas',
  '/configuracion': 'Configuración'
};

/** Título de la página para la pestaña del navegador; null si no hay uno específico. */
export function getPageTitle(pathname) {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  if (pathname.startsWith('/habitaciones/') || pathname.startsWith('/rooms/')) return 'Habitación';
  if (pathname.startsWith('/clients/')) return 'Cliente';
  if (pathname.startsWith('/reservations/')) return 'Reserva';
  if (pathname === '/consulta' || pathname.startsWith('/consulta/')) return 'Consulta';
  return null;
}

/** «Página - Hotel Riviera», o solo «Hotel Riviera» (antes quedaba «Hotel Riviera - Hotel Riviera»). */
export function documentTitleFor(pathname) {
  const page = getPageTitle(pathname);
  return page ? `${page} - ${APP_NAME}` : APP_NAME;
}

const usePageTitle = () => {
  const location = useLocation();

  useEffect(() => {
    document.title = documentTitleFor(location.pathname);
  }, [location.pathname]);

  return getPageTitle(location.pathname) || APP_NAME;
};

export default usePageTitle;
