import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const usePageTitle = () => {
  const location = useLocation();

  const getPageTitle = (pathname) => {
    const routes = {
      '/': 'Libro de Reservas',
      '/libro-de-reservas': 'Libro de Reservas',
      '/consultas-reservas': 'Consultas y Reservas',
      '/tarifas': 'Tarifas',
      '/cobros-pagos': 'Cobros y Pagos',
      '/estadisticas': 'Estadísticas',
      '/configuracion': 'Configuración'
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