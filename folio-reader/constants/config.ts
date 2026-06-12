/**
 * Central configuration for storage keys and external services.
 * 
 * @deprecated Use imports from '@/config/credentials' instead
 */

// Re-export from centralized location for backward compatibility
export { 
  STORAGE_KEYS, 
  credentials, 
  ENV_VARS,
  getActiveProfile,
  setActiveProfile,
} from '@/config/credentials';

// Legacy individual export for backward compatibility
export const STORAGE_KEYS_LEGACY = {
  GOOGLE_BOOKS_API_KEY: 'folio_google_books_api_key',
};
