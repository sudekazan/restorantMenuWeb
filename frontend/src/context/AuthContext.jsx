import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { UNAUTHORIZED_EVENT, authApi, getAuthToken, setAuthToken } from '../lib/api.js';

const AuthContext = createContext(null);

export const STAFF_ROLES = Object.freeze(['admin', 'manager', 'waiter', 'kitchen', 'cashier']);
export const ADMIN_ROLES = Object.freeze(['admin', 'manager']);

/** Girişten sonra rol bazlı varsayılan ekran. */
export function defaultPathForRole() {
  return '/staff';
}

/**
 * Personel / yönetici oturum yönetimi.
 * status: 'loading' (token doğrulanıyor) | 'authenticated' | 'anonymous'
 */
export function AuthProvider({ children }) {
  const [state, setState] = useState(() => ({
    status: getAuthToken() ? 'loading' : 'anonymous',
    user: null,
    restaurant: null,
  }));

  const logout = useCallback(() => {
    setAuthToken(null);
    setState({ status: 'anonymous', user: null, restaurant: null });
  }, []);

  // Uygulama açılışında kayıtlı token'ı /auth/me ile doğrula
  useEffect(() => {
    if (!getAuthToken()) return undefined;
    let cancelled = false;
    authApi
      .me()
      .then(({ user, restaurant }) => {
        if (!cancelled) setState({ status: 'authenticated', user, restaurant });
      })
      .catch(() => {
        if (!cancelled) logout();
      });
    return () => {
      cancelled = true;
    };
  }, [logout]);

  // Herhangi bir korumalı istek 401 dönerse oturumu kapat
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, logout);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout);
  }, [logout]);

  const login = useCallback(async ({ email, password }) => {
    const { token, user, restaurant } = await authApi.login({ email, password });
    setAuthToken(token);
    setState({ status: 'authenticated', user, restaurant });
    return user;
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      isAuthenticated: state.status === 'authenticated',
      token: state.status === 'authenticated' ? getAuthToken() : '',
      login,
      logout,
    }),
    [state, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
