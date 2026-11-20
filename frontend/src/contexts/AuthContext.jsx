import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loginRequest, logoutRequest, meRequest } from '../services/authApi';
import { hasPermission } from '../auth/permissions';
import { ROLES } from '../auth/roles';
import {
  clearSimulatedRole,
  getSimulatedRole,
  subscribeSimulatedRole
} from '../utils/simulatedRole';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState(null);
  const [simulatedRole, setSimulatedRoleState] = useState(() => getSimulatedRole());

  const applySession = useCallback((payload) => {
    setUser(payload?.user || null);
    setPermissions(payload?.permissions || []);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await meRequest();
      applySession(data);
      setBootError(null);
      return data.user;
    } catch (error) {
      applySession(null);
      if (error.status !== 401) {
        setBootError(error.message);
      }
      return null;
    }
  }, [applySession]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await refresh();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    const onUnauthorized = () => {
      applySession(null);
    };
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, [applySession]);

  useEffect(() => {
    return subscribeSimulatedRole(setSimulatedRoleState);
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await loginRequest(username, password);
    applySession(data);
    return data.user;
  }, [applySession]);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // Aunque falle el backend, limpiamos la sesión local
    }
    clearSimulatedRole();
    applySession(null);
  }, [applySession]);

  const switchUser = useCallback(async () => {
    await logout();
  }, [logout]);

  const isRealAdmin = user?.role === ROLES.ADMIN;
  const activeSimulatedRole =
    isRealAdmin && simulatedRole && simulatedRole !== user?.role
      ? simulatedRole
      : null;

  const effectiveUser = useMemo(() => {
    if (!user) return null;
    if (!activeSimulatedRole) return user;
    return { ...user, role: activeSimulatedRole };
  }, [user, activeSimulatedRole]);

  const can = useCallback((permission) => {
    if (activeSimulatedRole) {
      return hasPermission(activeSimulatedRole, permission);
    }
    if (permissions.includes(permission)) return true;
    return hasPermission(user?.role, permission);
  }, [permissions, user, activeSimulatedRole]);

  const value = useMemo(() => ({
    user: effectiveUser,
    realUser: user,
    simulatedRole: activeSimulatedRole,
    permissions,
    loading,
    bootError,
    isAuthenticated: Boolean(user),
    login,
    logout,
    switchUser,
    refresh,
    can
  }), [
    effectiveUser,
    user,
    activeSimulatedRole,
    permissions,
    loading,
    bootError,
    login,
    logout,
    switchUser,
    refresh,
    can
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return ctx;
}
