import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { kavitaAPI } from '../services/kavitaAPI';
import { absAPI } from '../services/audiobookshelfAPI';
import { storage } from '../services/storage';
import { Platform } from 'react-native';

export type ServerType = 'kavita' | 'abs' | null;

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  serverType: ServerType;
  serverUrl: string;
  login: (serverUrl: string, apiKey: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  serverType: null,
  serverUrl: '',
  login: async () => ({ success: false }),
  logout: async () => {},
});

/** On web the app is always cross-origin relative to the backend servers.
 *  Always route through the local /proxy?url= endpoint to bypass CORS. */
function enableWebProxy() {
  if (Platform.OS === 'web') {
    kavitaAPI.setProxy('/proxy?url=');
    absAPI.setProxy('/proxy?url=');
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [serverUrl, setServerUrl] = useState('');
  const [serverType, setServerType] = useState<ServerType>(null);

  useEffect(() => {
    initializeAuth();
  }, []);

  async function initializeAuth() {
    try {
      const storedType = await storage.getItem('folio_active_server_type');

      // Enable proxy before initializing APIs so every call is routed correctly
      enableWebProxy();

      await kavitaAPI.initialize();
      await absAPI.initialize();

      // Audiobookshelf Priority
      if (storedType === 'abs' && absAPI.hasCredentials()) {
        setIsAuthenticated(true);
        setServerUrl(absAPI.getServerUrl());
        setServerType('abs');
      } 
      // Kavita Priority
      else if (storedType === 'kavita' && kavitaAPI.hasCredentials()) {
        const success = await kavitaAPI.login();
        if (success) {
          setIsAuthenticated(true);
          setServerUrl(kavitaAPI.getServerUrl());
          setServerType('kavita');
        }
      }
      // Fallback Discovery
      else if (kavitaAPI.hasCredentials()) {
         const success = await kavitaAPI.login();
         if (success) {
           setIsAuthenticated(true);
           setServerUrl(kavitaAPI.getServerUrl());
           setServerType('kavita');
         }
      }
      else if (absAPI.hasCredentials()) {
        setIsAuthenticated(true);
        setServerUrl(absAPI.getServerUrl());
        setServerType('abs');
      }

    } catch (e) {
      console.error('Auth initialization failed', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(url: string, apiKey: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Always enable proxy on web before attempting connection
      enableWebProxy();

      const isJwt = apiKey.startsWith('eyJ');
      console.log('[AuthContext] Login attempt - URL:', url, 'isJWT:', isJwt);

      // --- TEST 1: Preferred by Token Format ---
      if (isJwt) {
        // Looks like an ABS token
        try {
          await absAPI.saveCredentials(url.trim(), apiKey);
          const ok = await absAPI.ping();
          if (ok) {
            try {
              const libraries = await absAPI.getLibraries();
              if (libraries) {
                await kavitaAPI.logout(); 
                await storage.setItem('folio_active_server_type', 'abs');
                setServerType('abs');
                setServerUrl(absAPI.getServerUrl());
                setIsAuthenticated(true);
                return { success: true };
              }
            } catch (apiErr) {
               // Ping worked, but libraries failed (likely CORS or wrong key)
            }
          }
        } catch (absErr) {
          // Fall through
        }
      }

      // --- TEST 2: KAVITA ---
      try {
        console.log('[AuthContext] Trying Kavita login...');
        await kavitaAPI.saveCredentials(url.trim(), apiKey);
        const isKavita = await kavitaAPI.login();
        console.log('[AuthContext] Kavita login result:', isKavita);
        if (isKavita) {
          await absAPI.clearCredentials(); 
          await storage.setItem('folio_active_server_type', 'kavita');
          setServerType('kavita');
          setServerUrl(kavitaAPI.getServerUrl());
          setIsAuthenticated(true);
          return { success: true };
        }
      } catch (kavitaErr: any) {
        console.error('[AuthContext] Kavita login error:', kavitaErr?.response?.status, kavitaErr?.message);
        // --- TEST 3: ABS FALLBACK (If not JWT or if Kavita failed) ---
        if (!isJwt) {
           try {
             await absAPI.saveCredentials(url.trim(), apiKey);
             const ok = await absAPI.ping();
             if (ok) {
               const libraries = await absAPI.getLibraries();
               if (libraries) {
                 await kavitaAPI.logout();
                 await storage.setItem('folio_active_server_type', 'abs');
                 setServerType('abs');
                 setServerUrl(absAPI.getServerUrl());
                 setIsAuthenticated(true);
                 return { success: true };
               }
             }
           } catch {
             // Both failed
           }
        }
      }
    } catch (e) { 
      console.error('Login process exception', e);
    }

    // If we've reached this far, neither token was accepted.
    await kavitaAPI.logout();
    await absAPI.clearCredentials();
    return { success: false, error: 'Could not connect. Please check your Server URL, API Token, and CORS settings.' };
  }

  async function logout() {
    await kavitaAPI.logout();
    await absAPI.clearCredentials();
    await storage.deleteItem('folio_active_server_type');
    
    setIsAuthenticated(false);
    setServerUrl('');
    setServerType(null);
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, serverType, serverUrl, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
