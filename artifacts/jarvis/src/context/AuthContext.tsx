import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import { apiGetDemoUsers, apiGetMe, apiLogin, apiRegister, apiSwitchDemo } from '../api/customApi';
import type { DemoUserItem, Usuario } from '../types/custom';

interface AuthContextType {
  user: Usuario | null;
  loading: boolean;
  demoUsers: DemoUserItem[];
  login: (email: string, pass: string) => Promise<void>;
  register: (nombre: string, email: string, pass: string, avatar?: string) => Promise<void>;
  switchDemoUser: (userId: number) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'jarvis_auth_token';

// Configure authTokenGetter globally
setAuthTokenGetter(() => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoUsers, setDemoUsers] = useState<DemoUserItem[]>([]);

  const loadDemoUsers = async () => {
    try {
      const list = await apiGetDemoUsers();
      setDemoUsers(list);
    } catch {
      // Ignorar error inicial
    }
  };

  const refreshUser = async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    const hasLoggedOut = localStorage.getItem('jarvis_has_logged_out') === 'true';

    if (!token) {
      if (hasLoggedOut) {
        setUser(null);
        setLoading(false);
        return;
      }
      // Primera vez: auto-login con Tomás en modo demo
      try {
        const res = await apiSwitchDemo(1);
        localStorage.setItem(TOKEN_KEY, res.token);
        setUser(res.usuario);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const me = await apiGetMe();
      setUser(me);
    } catch {
      // Token expirado o inválido, reiniciar con demo si no ha cerrado sesión explícitamente
      if (!hasLoggedOut) {
        try {
          const res = await apiSwitchDemo(1);
          localStorage.setItem(TOKEN_KEY, res.token);
          setUser(res.usuario);
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDemoUsers();
    refreshUser();
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await apiLogin(email, pass);
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.removeItem('jarvis_has_logged_out');
    setUser(res.usuario);
    queryClient.clear();
  };

  const register = async (nombre: string, email: string, pass: string, avatar = '🚀') => {
    const res = await apiRegister(nombre, email, pass, avatar);
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.removeItem('jarvis_has_logged_out');
    setUser(res.usuario);
    await loadDemoUsers();
    queryClient.clear();
  };

  const switchDemoUser = async (userId: number) => {
    const res = await apiSwitchDemo(userId);
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.removeItem('jarvis_has_logged_out');
    setUser(res.usuario);
    queryClient.clear();
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.setItem('jarvis_has_logged_out', 'true');
    setUser(null);
    queryClient.clear();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        demoUsers,
        login,
        register,
        switchDemoUser,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
};
