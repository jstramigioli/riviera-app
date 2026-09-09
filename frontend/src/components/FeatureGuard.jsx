import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import FEATURE_FLAGS from '../config/featureFlags';

/**
 * Soft-redirect for out-of-scope routes (tarifas auto, precios inteligentes).
 */
export default function FeatureGuard({ flag, children, fallbackTo = '/libro-de-reservas' }) {
  const location = useLocation();
  const enabled = FEATURE_FLAGS[flag];

  if (!enabled) {
    return (
      <Navigate
        to={fallbackTo}
        replace
        state={{ fromDisabledFeature: location.pathname }}
      />
    );
  }

  return children;
}
