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
    API_KEY: 'EXPO_PUBLIC_ABS_API_KEY',
    USERNAME: 'EXPO_PUBLIC_ABS_USERNAME',
    PASSWORD: 'EXPO_PUBLIC_ABS_PASSWORD',
  },
  PROFILE: {
    URL: 'EXPO_PUBLIC_PROFILE_URL',
    API_KEY: 'EXPO_PUBLIC_PROFILE_API_KEY',
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

/**
 * Check multiple env var names and return the first non-empty value.
 * Uses explicit literal property access on process.env so the Expo bundler
 * can statically replace EXPO_PUBLIC_* variables at build time.
 * Dynamic access (process.env[key]) is NOT analyzable by the bundler.
 */
function getEnvMulti(...keys: string[]): string | undefined {
  for (const key of keys) {
    // Explicit literal access — required for static bundler replacement
    const val = key === 'EXPO_PUBLIC_KAVITA_URL' ? process.env.EXPO_PUBLIC_KAVITA_URL
      : key === 'EXPO_PUBLIC_KAVITA_API_KEY' ? process.env.EXPO_PUBLIC_KAVITA_API_KEY
      : key === 'EXPO_PUBLIC_KAVITA_USERNAME' ? process.env.EXPO_PUBLIC_KAVITA_USERNAME
      : key === 'EXPO_PUBLIC_KAVITA_PASSWORD' ? process.env.EXPO_PUBLIC_KAVITA_PASSWORD
      : key === 'EXPO_PUBLIC_ABS_URL' ? process.env.EXPO_PUBLIC_ABS_URL
      : key === 'EXPO_PUBLIC_ABS_API_KEY' ? process.env.EXPO_PUBLIC_ABS_API_KEY
      : key === 'EXPO_PUBLIC_ABS_USERNAME' ? process.env.EXPO_PUBLIC_ABS_USERNAME
      : key === 'EXPO_PUBLIC_ABS_PASSWORD' ? process.env.EXPO_PUBLIC_ABS_PASSWORD
      : key === 'EXPO_PUBLIC_PUBLIC_SERVER_URL' ? process.env.EXPO_PUBLIC_PUBLIC_SERVER_URL
      : key === 'EXPO_PUBLIC_PROFILE_API_KEY' ? process.env.EXPO_PUBLIC_PROFILE_API_KEY
      : key === 'EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY' ? process.env.EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY
      : key === 'EXPO_PUBLIC_OPENLIBRARY_ENABLED' ? process.env.EXPO_PUBLIC_OPENLIBRARY_ENABLED
      : process.env[key];
    if (val !== undefined && val !== '') return val;
  }
  return undefined;
}

function getEnvBool(key: string): boolean {
  const val = getEnvMulti(key);
  return val === 'true' || val === '1';
}

/**
 * Extract server hostname from PUBLIC_SERVER_URL for constructing media server URLs.
 * Falls back to 'localhost' if no PUBLIC_SERVER_URL is configured.
 */
function getServerHost(): string {
  const publicUrl = getEnvMulti('EXPO_PUBLIC_PUBLIC_SERVER_URL', 'PUBLIC_SERVER_URL');
  if (publicUrl) {
    try {
      return new URL(publicUrl).hostname;
    } catch {
      // Invalid URL, fall through
    }
  }
  return 'localhost';
}

/**
 * Construct a server URL from a PORT environment variable.
 * Uses the hostname from PUBLIC_SERVER_URL if available, otherwise localhost.
 */
function buildUrlFromPort(portVar: string): string | undefined {
  const port = getEnvMulti(`EXPO_PUBLIC_${portVar}`, portVar);
  if (!port) return undefined;
  return `http://${getServerHost()}:${port}`;
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
      return getEnvMulti(ENV_VARS.KAVITA.URL, 'KAVITA_URL') ||
             buildUrlFromPort('KAVITA_PORT') ||
             await storage.getItem(STORAGE_KEYS.KAVITA.SERVER_URL);
    },
    
    async setServerUrl(url: string): Promise<void> {
      await storage.setItem(STORAGE_KEYS.KAVITA.SERVER_URL, url);
    },
    
    async getApiKey(): Promise<string | null> {
      return getEnvMulti(ENV_VARS.KAVITA.API_KEY, 'KAVITA_API_KEY') ||
             await storage.getItem(STORAGE_KEYS.KAVITA.API_KEY);
    },
    
    async setApiKey(key: string): Promise<void> {
      await storage.setItem(STORAGE_KEYS.KAVITA.API_KEY, key);
    },

    async getUsername(): Promise<string | null> {
      return getEnvMulti(ENV_VARS.KAVITA.USERNAME, 'KAVITA_JWT_USERNAME', 'KAVITA_USERNAME') ||
             await storage.getItem(STORAGE_KEYS.KAVITA.USERNAME);
    },

    async setUsername(username: string): Promise<void> {
      await storage.setItem(STORAGE_KEYS.KAVITA.USERNAME, username);
    },

    async getPassword(): Promise<string | null> {
      return getEnvMulti(ENV_VARS.KAVITA.PASSWORD, 'KAVITA_JWT_PASSWORD', 'KAVITA_PASSWORD') ||
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
      return getEnvMulti(ENV_VARS.ABS.URL, 'ABS_URL') ||
             buildUrlFromPort('ABS_PORT') ||
             await storage.getItem(STORAGE_KEYS.ABS.SERVER_URL);
    },
    
    async setServerUrl(url: string): Promise<void> {
      await storage.setItem(STORAGE_KEYS.ABS.SERVER_URL, url);
    },
    
    async getApiKey(): Promise<string | null> {
      return getEnvMulti(ENV_VARS.ABS.API_KEY, 'ABS_API_KEY') ||
             await storage.getItem(STORAGE_KEYS.ABS.API_KEY);
    },
    
    async setApiKey(key: string): Promise<void> {
      await storage.setItem(STORAGE_KEYS.ABS.API_KEY, key);
    },
    
    async getUsername(): Promise<string | null> {
      return getEnvMulti(ENV_VARS.ABS.USERNAME, 'ABS_JWT_USERNAME', 'ABS_USERNAME') ||
             await storage.getItem(STORAGE_KEYS.ABS.USERNAME);
    },
    
    async setUsername(username: string): Promise<void> {
      await storage.setItem(STORAGE_KEYS.ABS.USERNAME, username);
    },
    
    async getPassword(): Promise<string | null> {
      return getEnvMulti(ENV_VARS.ABS.PASSWORD, 'ABS_JWT_PASSWORD', 'ABS_PASSWORD') ||
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
   * Profile sync server credentials
   */
  profile: {
    async getServerUrl(): Promise<string | null> {
      return getEnvMulti(ENV_VARS.PROFILE.URL, 'PUBLIC_SERVER_URL') ||
             buildUrlFromPort('PROFILE_PORT') ||
             await storage.getItem('folio_profile_server_url');
    },

    async setServerUrl(url: string): Promise<void> {
      await storage.setItem('folio_profile_server_url', url);
    },

    async getApiKey(): Promise<string | null> {
      return getEnvMulti(ENV_VARS.PROFILE.API_KEY, 'PROFILE_API_KEY', 'FOLIO_API_KEY') ||
             await storage.getItem('folio_profile_api_key');
    },

    async setApiKey(key: string): Promise<void> {
      await storage.setItem('folio_profile_api_key', key);
    },

    async clearAll(): Promise<void> {
      await storage.deleteItem('folio_profile_server_url');
      await storage.deleteItem('folio_profile_api_key');
    },
  },

  googleBooks: {
    async getApiKey(): Promise<string | null> {
      return getEnvMulti(ENV_VARS.GOOGLE_BOOKS.API_KEY, 'GOOGLE_BOOKS_API_KEY') ||
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
    await this.profile.clearAll();
    await this.googleBooks.clear();
  },
};

// ============================================================================
// Legacy Export (for backward compatibility during migration)
// ============================================================================

/** @deprecated Use STORAGE_KEYS from this file instead */
export const LEGACY_STORAGE_KEYS = STORAGE_KEYS.GOOGLE_BOOKS;
