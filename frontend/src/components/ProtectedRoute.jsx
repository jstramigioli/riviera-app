import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function ProtectedRoute({ children, permission }) {
  const { loading, isAuthenticated, can } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ padding: '48px 24px', color: '#3a4250', fontFamily: "'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
        Cargando sesión...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (permission && !can(permission)) {
    return <Navigate to="/libro-de-reservas" replace />;
  }

  return children;
}

export default ProtectedRoute;
