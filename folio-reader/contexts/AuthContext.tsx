import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { kavitaAPI } from '../services/kavitaAPI';
import { absAPI } from '../services/audiobookshelfAPI';
import { storage } from '../services/storage';
import { Platform } from 'react-native';
import { PROXY_PATH } from '../config/proxy';

export type ServerType = 'kavita' | 'abs' | null;

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  serverType: ServerType;
  serverUrl: string;
  kavitaConnected: boolean;
  absConnected: boolean;
  setActiveServer: (type: ServerType) => void;
  login: (serverUrl: string, apiKey: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  logoutKavita: () => Promise<void>;
  logoutABS: () => Promise<void>;
  recheckConnections: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  serverType: null,
  serverUrl: '',
  kavitaConnected: false,
  absConnected: false,
  setActiveServer: () => {},
  login: async () => ({ success: false }),
  logout: async () => {},
  logoutKavita: async () => {},
  logoutABS: async () => {},
  recheckConnections: async () => {},
});

/** On web the app is always cross-origin relative to the backend servers.
 *  Always route through the local proxy endpoint to bypass CORS. */
function enableWebProxy() {
  if (Platform.OS === 'web') {
    kavitaAPI.setProxy(PROXY_PATH);
    absAPI.setProxy(PROXY_PATH);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [serverUrl, setServerUrl] = useState('');
  const [serverType, setServerType] = useState<ServerType>(null);
  const [kavitaConnected, setKavitaConnected] = useState(false);
  const [absConnected, setAbsConnected] = useState(false);

  // Derived: authenticated if at least one server is connected
  const isAuthenticated = kavitaConnected || absConnected;

  useEffect(() => {
    initializeAuth();
  }, []);

  async function initializeAuth() {
    try {
      const storedType = await storage.getItem('folio_active_server_type');

      // Enable proxy before initializing APIs so every call is routed correctly
      enableWebProxy();

      // Initialize both APIs (loads credentials from storage)
      await kavitaAPI.initialize();
      await absAPI.initialize();

      // Try to connect to Kavita if credentials exist
      let kavitaSuccess = false;
      if (kavitaAPI.hasCredentials()) {
        // Try JWT login first (for progress tracking users)
        kavitaSuccess = await kavitaAPI.login();
        // If JWT login fails, fall back to API key validation (API key-only mode)
        if (!kavitaSuccess) {
          kavitaSuccess = await kavitaAPI.validateApiKey();
        }
        setKavitaConnected(kavitaSuccess);
        console.log('[AuthContext] Kavita connection:', kavitaSuccess ? 'connected' : 'failed');
      }

      // ABS auto-connects on initialize() if it has credentials
      const absSuccess = absAPI.hasCredentials();
      setAbsConnected(absSuccess);
      console.log('[AuthContext] ABS connection:', absSuccess ? 'connected' : 'no credentials');

      // Set active server based on stored preference or availability
      if (storedType === 'abs' && absSuccess) {
        setServerType('abs');
        setServerUrl(absAPI.getServerUrl());
      } else if (storedType === 'kavita' && kavitaSuccess) {
        setServerType('kavita');
        setServerUrl(kavitaAPI.getServerUrl());
      } else if (kavitaSuccess) {
        // Default to Kavita if both available and no preference
        setServerType('kavita');
        setServerUrl(kavitaAPI.getServerUrl());
      } else if (absSuccess) {
        setServerType('abs');
        setServerUrl(absAPI.getServerUrl());
      }

    } catch (e) {
      console.error('Auth initialization failed', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function setActiveServer(type: ServerType) {
    if (type === 'kavita' && kavitaConnected) {
      setServerType('kavita');
      setServerUrl(kavitaAPI.getServerUrl());
      await storage.setItem('folio_active_server_type', 'kavita');
    } else if (type === 'abs' && absConnected) {
      setServerType('abs');
      setServerUrl(absAPI.getServerUrl());
      await storage.setItem('folio_active_server_type', 'abs');
    } else if (type === null) {
      setServerType(null);
      setServerUrl('');
    }
  }

  async function login(url: string, apiKey: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Always enable proxy on web before attempting connection
      enableWebProxy();

      const isJwt = apiKey.startsWith('eyJ');
      console.log('[AuthContext] Login attempt - URL:', url, 'isJWT:', isJwt);

      // --- TEST 1: ABS (JWT token format) ---
      if (isJwt) {
        try {
          await absAPI.saveCredentials(url.trim(), apiKey);
          const ok = await absAPI.ping();
          if (ok) {
            const libraries = await absAPI.getLibraries();
            if (libraries) {
              setAbsConnected(true);
              await storage.setItem('folio_active_server_type', 'abs');
              setServerType('abs');
              setServerUrl(absAPI.getServerUrl());
              return { success: true };
            }
          }
        } catch (absErr) {
          // Fall through to Kavita test
        }
      }

      // --- TEST 2: KAVITA ---
      try {
        console.log('[AuthContext] Trying Kavita login...');
        await kavitaAPI.saveCredentials(url.trim(), '', '', apiKey);
        const isKavita = await kavitaAPI.login();
        console.log('[AuthContext] Kavita login result:', isKavita);
        if (isKavita) {
          setKavitaConnected(true);
          await storage.setItem('folio_active_server_type', 'kavita');
          setServerType('kavita');
          setServerUrl(kavitaAPI.getServerUrl());
          return { success: true };
        }
      } catch (kavitaErr: any) {
        console.error('[AuthContext] Kavita login error:', kavitaErr?.response?.status, kavitaErr?.message);
      }

      // --- TEST 3: ABS FALLBACK (if not JWT or Kavita failed) ---
      if (!isJwt) {
        try {
          await absAPI.saveCredentials(url.trim(), apiKey);
          const ok = await absAPI.ping();
          if (ok) {
            const libraries = await absAPI.getLibraries();
            if (libraries) {
              setAbsConnected(true);
              await storage.setItem('folio_active_server_type', 'abs');
              setServerType('abs');
              setServerUrl(absAPI.getServerUrl());
              return { success: true };
            }
          }
        } catch {
          // Both failed
        }
      }
    } catch (e) { 
      console.error('Login process exception', e);
    }

    return { success: false, error: 'Could not connect. Please check your Server URL, API Token, and CORS settings.' };
  }

  async function logout() {
    await kavitaAPI.logout();
    await absAPI.clearCredentials();
    await storage.deleteItem('folio_active_server_type');
    
    setKavitaConnected(false);
    setAbsConnected(false);
    setServerUrl('');
    setServerType(null);
  }

  async function logoutKavita() {
    await kavitaAPI.logout();
    setKavitaConnected(false);
    if (serverType === 'kavita') {
      // Switch to ABS if available, otherwise clear
      if (absConnected) {
        setServerType('abs');
        setServerUrl(absAPI.getServerUrl());
        await storage.setItem('folio_active_server_type', 'abs');
      } else {
        setServerType(null);
        setServerUrl('');
        await storage.deleteItem('folio_active_server_type');
      }
    }
  }

  async function logoutABS() {
    await absAPI.clearCredentials();
    setAbsConnected(false);
    if (serverType === 'abs') {
      // Switch to Kavita if available, otherwise clear
      if (kavitaConnected) {
        setServerType('kavita');
        setServerUrl(kavitaAPI.getServerUrl());
        await storage.setItem('folio_active_server_type', 'kavita');
      } else {
        setServerType(null);
        setServerUrl('');
        await storage.deleteItem('folio_active_server_type');
      }
    }
  }

  async function recheckConnections() {
    console.log('[AuthContext] Rechecking connections...');
    let kavitaSuccess = false;
    let absSuccess = false;

    if (kavitaAPI.hasCredentials()) {
      // Try JWT login first, then fall back to API key validation
      kavitaSuccess = await kavitaAPI.login();
      if (!kavitaSuccess) {
        kavitaSuccess = await kavitaAPI.validateApiKey();
      }
      setKavitaConnected(kavitaSuccess);
      console.log('[AuthContext] Kavita recheck:', kavitaSuccess ? 'connected' : 'failed');
    } else {
      setKavitaConnected(false);
    }
    
    if (absAPI.hasCredentials()) {
      absSuccess = await absAPI.ping();
      setAbsConnected(absSuccess);
      console.log('[AuthContext] ABS recheck:', absSuccess ? 'connected' : 'failed');
    } else {
      setAbsConnected(false);
    }
    
    // Update active server if needed
    if (!kavitaSuccess && serverType === 'kavita') {
      if (absSuccess) {
        setServerType('abs');
        setServerUrl(absAPI.getServerUrl());
        await storage.setItem('folio_active_server_type', 'abs');
      } else {
        setServerType(null);
        setServerUrl('');
        await storage.deleteItem('folio_active_server_type');
      }
    }
  }

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      isLoading, 
      serverType, 
      serverUrl, 
      kavitaConnected, 
      absConnected, 
      setActiveServer,
      login, 
      logout,
      logoutKavita,
      logoutABS,
      recheckConnections,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
