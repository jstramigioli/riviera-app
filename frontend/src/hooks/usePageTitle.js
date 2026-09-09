import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const usePageTitle = () => {
  const location = useLocation();

  const getPageTitle = (pathname) => {
    if (pathname.startsWith('/reservations/')) return 'Detalle de Reserva';
    if (pathname.startsWith('/clients/')) return 'Detalle de Cliente';
    if (pathname.startsWith('/rooms/')) return 'Detalle de Habitación';
    if (pathname.startsWith('/tarifas')) return 'Tarifas';

    const routes = {
      '/': 'Libro de Reservas',
      '/libro-de-reservas': 'Libro de Reservas',
      '/consultas-reservas': 'Consultas y Reservas',
      '/consulta': 'Nueva Reserva',
      '/tarifas': 'Tarifas',
      '/cobros-pagos': 'Cobros y Pagos',
      '/estadisticas': 'Clientes',
      '/configuracion': 'Configuración',
      '/precios-inteligentes': 'Precios Inteligentes'
    };

    return routes[pathname] || 'Hotel Riviera';
  };

  useEffect(() => {
    const pageTitle = getPageTitle(location.pathname);
    document.title = `${pageTitle} - Hotel Riviera`;
  }, [location.pathname]);

  return getPageTitle(location.pathname);
};

export default usePageTitle;
