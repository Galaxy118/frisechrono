/* ═══════════════════════════════════════════════════════════
   context/AuthContext.jsx — Contexte d'authentification global
   
   Fournit : user, token, login(), register(), logout(), updateUser()
   Persiste la session via localStorage.
   ═══════════════════════════════════════════════════════════ */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('fc_token'));
  const [loading, setLoading] = useState(true);

  // ─── Vérifier la session au démarrage ───
  useEffect(() => {
    const checkAuth = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { user: me } = await authService.getMe();
        setUser(me);
      } catch {
        // Token invalide → nettoyer
        localStorage.removeItem('fc_token');
        localStorage.removeItem('fc_user');
        setToken(null);
        setUser(null);
      }
      setLoading(false);
    };
    checkAuth();
  }, [token]);

  const login = useCallback(async (email, password, twoFactorCode) => {
    const data = await authService.login(email, password, twoFactorCode);
    if (data.requiresTwoFactor) {
      return data; // pas encore connecté, 2FA requis
    }
    localStorage.setItem('fc_token', data.token);
    localStorage.setItem('fc_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const register = useCallback(async (username, email, password) => {
    const data = await authService.register(username, email, password);
    localStorage.setItem('fc_token', data.token);
    localStorage.setItem('fc_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('fc_token');
    localStorage.removeItem('fc_user');
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('fc_user', JSON.stringify(updatedUser));
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      updateUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return ctx;
}
