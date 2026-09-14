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

    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const me = await apiGetMe();
      setUser(me);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      queryClient.clear();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDemoUsers();
    refreshUser();

    // Sincronización de sesión multi-pestaña
    const handleStorage = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY) {
        if (!e.newValue) {
          setUser(null);
          queryClient.clear();
        } else {
          refreshUser();
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await apiLogin(email, pass);
    localStorage.setItem(TOKEN_KEY, res.token);
    setUser(res.usuario);
    queryClient.clear();
  };

  const register = async (nombre: string, email: string, pass: string, avatar = '🚀') => {
    const res = await apiRegister(nombre, email, pass, avatar);
    localStorage.setItem(TOKEN_KEY, res.token);
    setUser(res.usuario);
    await loadDemoUsers();
    queryClient.clear();
  };

  const switchDemoUser = async (userId: number) => {
    const res = await apiSwitchDemo(userId);
    localStorage.setItem(TOKEN_KEY, res.token);
    setUser(res.usuario);
    queryClient.clear();
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
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
