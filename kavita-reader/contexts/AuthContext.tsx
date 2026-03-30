import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { kavitaAPI } from '../services/kavitaAPI';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (serverUrl: string, apiKey: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  serverUrl: string;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  login: async () => ({ success: false }),
  logout: async () => {},
  serverUrl: '',
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [serverUrl, setServerUrl] = useState('');

  useEffect(() => {
    initializeAuth();
  }, []);

  async function initializeAuth() {
    try {
      await kavitaAPI.initialize();
      if (kavitaAPI.hasCredentials()) {
        try {
          const success = await kavitaAPI.login();
          setIsAuthenticated(success);
          if (success) setServerUrl(kavitaAPI.getServerUrl());
        } catch {
          setIsAuthenticated(false);
        }
      }
    } catch (e) {
      console.error('Auth init failed', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(url: string, apiKey: string): Promise<{ success: boolean; error?: string }> {
    try {
      await kavitaAPI.saveCredentials(url, apiKey);
      const success = await kavitaAPI.login();
      if (success) {
        setIsAuthenticated(true);
        setServerUrl(kavitaAPI.getServerUrl());
        return { success: true };
      } else {
        return { success: false, error: 'Invalid server URL or API key. Check your Kavita settings.' };
      }
    } catch (e: any) {
      const msg: string = e?.message ?? '';
      const status: number = e?.response?.status ?? 0;
      if (status === 401 || status === 403) {
        return { success: false, error: 'Invalid API key.' };
      }
      if (status >= 400) {
        return { success: false, error: `Server error (${status}). Check the URL.` };
      }
      if (msg.includes('Network Error') || msg.includes('ERR_NETWORK') || e?.code === 'ERR_NETWORK') {
        return { success: false, error: 'Could not reach server — check the URL and that Kavita is running.' };
      }
      // CORS errors appear as network errors with no status; give a specific hint
      if (!status && !msg.includes('timeout')) {
        return { success: false, error: 'Request blocked — this is likely a CORS error. In Kavita → Admin → Settings, add your app\'s URL to the allowed origins.' };
      }
      return { success: false, error: `Connection failed: ${msg || 'unknown error'}` };
    }
  }

  async function logout() {
    await kavitaAPI.logout();
    setIsAuthenticated(false);
    setServerUrl('');
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, login, logout, serverUrl }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
