/**
 * Unified Credentials Configuration
 * 
 * This module centralizes ALL credentials and configuration for the Folio app.
 * It supports both environment variables (for deployed/production) and 
 * local storage (for development/multi-profile use cases).
 * 
 * Environment variables take precedence over stored values for deployment scenarios.
 * Local storage is used for multi-profile support and user-managed credentials.
 * 
 * Usage:
 *   import { credentials } from '@/config/credentials';
 *   const kavitaUrl = await credentials.kavita.getServerUrl();
 *   await credentials.kavita.setApiKey('new-key');
 */

import { storage } from '@/services/storage';

// ============================================================================
// Environment Variable Names
// ============================================================================

export const ENV_VARS = {
  KAVITA: {
    URL: 'EXPO_PUBLIC_KAVITA_URL',
    API_KEY: 'EXPO_PUBLIC_KAVITA_API_KEY',
    USERNAME: 'EXPO_PUBLIC_KAVITA_USERNAME',
    PASSWORD: 'EXPO_PUBLIC_KAVITA_PASSWORD',
  },
  ABS: {
    URL: 'EXPO_PUBLIC_ABS_URL',
    API_KEY: 'EXPO_PUBLIC_ABS_TOKEN',
    USERNAME: 'EXPO_PUBLIC_ABS_USERNAME',
    PASSWORD: 'EXPO_PUBLIC_ABS_PASSWORD',
  },
  GOOGLE_BOOKS: {
    API_KEY: 'EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY',
  },
  OPENLIBRARY: {
    ENABLED: 'EXPO_PUBLIC_OPENLIBRARY_ENABLED',
  },
} as const;

// ============================================================================
// Storage Keys (all centralized here)
// ============================================================================

export const STORAGE_KEYS = {
  KAVITA: {
    SERVER_URL: 'folio_kavita_server_url',
    API_KEY: 'folio_kavita_api_key',
    USERNAME: 'folio_kavita_username',
    PASSWORD: 'folio_kavita_password',
    JWT_TOKEN: 'folio_kavita_jwt_token',
    PROGRESS_TRACKING: 'folio_kavita_progress_tracking',
    ON_DECK_CACHE: 'folio_kavita_on_deck_cache',
    METADATA_CACHE: 'folio_kavita_metadata_cache',
  },
  ABS: {
    SERVER_URL: 'folio_abs_server_url',
    API_KEY: 'folio_abs_api_key',
    USERNAME: 'folio_abs_username',
    PASSWORD: 'folio_abs_password',
    JWT_TOKEN: 'folio_abs_jwt_token',
    PROGRESS_TRACKING: 'folio_abs_progress_tracking',
    CONTINUE_LISTENING_CACHE: 'folio_abs_continue_listening_cache',
    AUTO_PLAY: 'folio_abs_auto_play',
  },
  GOOGLE_BOOKS: {
    API_KEY: 'folio_google_books_api_key',
  },
  SETTINGS: {
    ACTIVE_PROFILE: 'folio_active_profile_id',
    THEME: 'folio_theme_preference',
    READER_SETTINGS: 'folio_reader_settings',
  },
} as const;

// ============================================================================
// Profile Support
// ============================================================================

let activeProfileId: string | null = null;

/**
 * Get the currently active profile ID
 */
export async function getActiveProfile(): Promise<string | null> {
  if (activeProfileId) return activeProfileId;
  activeProfileId = await storage.getItem(STORAGE_KEYS.SETTINGS.ACTIVE_PROFILE);
  return activeProfileId;
}

/**
 * Set the active profile ID
 */
export async function setActiveProfile(profileId: string | null): Promise<void> {
  activeProfileId = profileId;
  if (profileId) {
    await storage.setItem(STORAGE_KEYS.SETTINGS.ACTIVE_PROFILE, profileId);
  } else {
    await storage.deleteItem(STORAGE_KEYS.SETTINGS.ACTIVE_PROFILE);
  }
}

/**
 * Get a profile-scoped storage key
 */
function getProfileScopedKey(baseKey: string): string {
  const profile = activeProfileId;
  if (profile) {
    return `folio_${profile}_${baseKey}`;
  }
  return baseKey;
}

// ============================================================================
// Environment Helpers
// ============================================================================

function getEnv(key: string): string | undefined {
  return process.env[key];
}

function getEnvBool(key: string): boolean {
  const val = process.env[key];
  return val === 'true' || val === '1';
}

// ============================================================================
// Credentials API
// ============================================================================

export const credentials = {
  /**
   * Kavita server credentials
   */
  kavita: {
    async getServerUrl(): Promise<string | null> {
      return getEnv(ENV_VARS.KAVITA.URL) || 
             await storage.getItem(STORAGE_KEYS.KAVITA.SERVER_URL);
    },
    
    async setServerUrl(url: string): Promise<void> {
      await storage.setItem(STORAGE_KEYS.KAVITA.SERVER_URL, url);
    },
    
    async getApiKey(): Promise<string | null> {
      return getEnv(ENV_VARS.KAVITA.API_KEY) || 
             await storage.getItem(STORAGE_KEYS.KAVITA.API_KEY);
    },
    
    async setApiKey(key: string): Promise<void> {
      await storage.setItem(STORAGE_KEYS.KAVITA.API_KEY, key);
    },

    async getUsername(): Promise<string | null> {
      return getEnv(ENV_VARS.KAVITA.USERNAME) ||
             await storage.getItem(STORAGE_KEYS.KAVITA.USERNAME);
    },

    async setUsername(username: string): Promise<void> {
      await storage.setItem(STORAGE_KEYS.KAVITA.USERNAME, username);
    },

    async getPassword(): Promise<string | null> {
      return getEnv(ENV_VARS.KAVITA.PASSWORD) ||
             await storage.getItem(STORAGE_KEYS.KAVITA.PASSWORD);
    },

    async setPassword(password: string): Promise<void> {
      await storage.setItem(STORAGE_KEYS.KAVITA.PASSWORD, password);
    },

    async getJwtToken(): Promise<string | null> {
      const key = getProfileScopedKey(STORAGE_KEYS.KAVITA.JWT_TOKEN);
      return await storage.getItem(key);
    },
    
    async setJwtToken(token: string): Promise<void> {
      const key = getProfileScopedKey(STORAGE_KEYS.KAVITA.JWT_TOKEN);
      await storage.setItem(key, token);
    },
    
    async clearJwtToken(): Promise<void> {
      const key = getProfileScopedKey(STORAGE_KEYS.KAVITA.JWT_TOKEN);
      await storage.deleteItem(key);
    },
    
    async isProgressTrackingEnabled(): Promise<boolean> {
      const stored = await storage.getItem(STORAGE_KEYS.KAVITA.PROGRESS_TRACKING);
      return stored !== 'false'; // Default to true
    },
    
    async setProgressTracking(enabled: boolean): Promise<void> {
      await storage.setItem(STORAGE_KEYS.KAVITA.PROGRESS_TRACKING, String(enabled));
    },
    
    async clearAll(): Promise<void> {
      await storage.deleteItem(STORAGE_KEYS.KAVITA.SERVER_URL);
      await storage.deleteItem(STORAGE_KEYS.KAVITA.API_KEY);
      await storage.deleteItem(STORAGE_KEYS.KAVITA.USERNAME);
      await storage.deleteItem(STORAGE_KEYS.KAVITA.PASSWORD);
      await this.clearJwtToken();
    },
  },

  /**
   * Audiobookshelf server credentials
   */
  abs: {
    async getServerUrl(): Promise<string | null> {
      return getEnv(ENV_VARS.ABS.URL) || 
             await storage.getItem(STORAGE_KEYS.ABS.SERVER_URL);
    },
    
    async setServerUrl(url: string): Promise<void> {
      await storage.setItem(STORAGE_KEYS.ABS.SERVER_URL, url);
    },
    
    async getApiKey(): Promise<string | null> {
      return getEnv(ENV_VARS.ABS.API_KEY) || 
             await storage.getItem(STORAGE_KEYS.ABS.API_KEY);
    },
    
    async setApiKey(key: string): Promise<void> {
      await storage.setItem(STORAGE_KEYS.ABS.API_KEY, key);
    },
    
    async getUsername(): Promise<string | null> {
      return getEnv(ENV_VARS.ABS.USERNAME) || 
             await storage.getItem(STORAGE_KEYS.ABS.USERNAME);
    },
    
    async setUsername(username: string): Promise<void> {
      await storage.setItem(STORAGE_KEYS.ABS.USERNAME, username);
    },
    
    async getPassword(): Promise<string | null> {
      return getEnv(ENV_VARS.ABS.PASSWORD) || 
             await storage.getItem(STORAGE_KEYS.ABS.PASSWORD);
    },
    
    async setPassword(password: string): Promise<void> {
      await storage.setItem(STORAGE_KEYS.ABS.PASSWORD, password);
    },
    
    async getJwtToken(): Promise<string | null> {
      return await storage.getItem(STORAGE_KEYS.ABS.JWT_TOKEN);
    },
    
    async setJwtToken(token: string): Promise<void> {
      await storage.setItem(STORAGE_KEYS.ABS.JWT_TOKEN, token);
    },
    
    async isProgressTrackingEnabled(): Promise<boolean> {
      const stored = await storage.getItem(STORAGE_KEYS.ABS.PROGRESS_TRACKING);
      return stored !== 'false'; // Default to true
    },
    
    async setProgressTracking(enabled: boolean): Promise<void> {
      await storage.setItem(STORAGE_KEYS.ABS.PROGRESS_TRACKING, String(enabled));
    },
    
    async isAutoPlayEnabled(): Promise<boolean> {
      const stored = await storage.getItem(STORAGE_KEYS.ABS.AUTO_PLAY);
      return stored !== 'false'; // Default to true
    },
    
    async setAutoPlay(enabled: boolean): Promise<void> {
      await storage.setItem(STORAGE_KEYS.ABS.AUTO_PLAY, String(enabled));
    },
    
    async clearAll(): Promise<void> {
      await storage.deleteItem(STORAGE_KEYS.ABS.SERVER_URL);
      await storage.deleteItem(STORAGE_KEYS.ABS.API_KEY);
      await storage.deleteItem(STORAGE_KEYS.ABS.USERNAME);
      await storage.deleteItem(STORAGE_KEYS.ABS.PASSWORD);
      await storage.deleteItem(STORAGE_KEYS.ABS.JWT_TOKEN);
    },
  },

  /**
   * Google Books API credentials
   */
  googleBooks: {
    async getApiKey(): Promise<string | null> {
      return getEnv(ENV_VARS.GOOGLE_BOOKS.API_KEY) || 
             await storage.getItem(STORAGE_KEYS.GOOGLE_BOOKS.API_KEY);
    },
    
    async setApiKey(key: string): Promise<void> {
      await storage.setItem(STORAGE_KEYS.GOOGLE_BOOKS.API_KEY, key);
    },
    
    async clear(): Promise<void> {
      await storage.deleteItem(STORAGE_KEYS.GOOGLE_BOOKS.API_KEY);
    },
  },

  /**
   * Clear all credentials (logout all services)
   */
  async clearAll(): Promise<void> {
    await this.kavita.clearAll();
    await this.abs.clearAll();
    await this.googleBooks.clear();
  },
};

// ============================================================================
// Legacy Export (for backward compatibility during migration)
// ============================================================================

/** @deprecated Use STORAGE_KEYS from this file instead */
export const LEGACY_STORAGE_KEYS = STORAGE_KEYS.GOOGLE_BOOKS;
