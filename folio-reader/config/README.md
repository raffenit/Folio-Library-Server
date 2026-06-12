# Unified Credentials Configuration

## Overview

All credentials and configuration for the Folio app are now centralized in `/config/credentials.ts`.

This provides:
- **Single source of truth** for all storage keys
- **Environment variable support** for deployed/production builds
- **Local storage** for development and multi-profile use cases
- **Profile-scoped storage** for JWT tokens and user-specific data

## Quick Reference

### Import the Credentials API

```typescript
import { credentials, STORAGE_KEYS, ENV_VARS } from '@/config/credentials';
// or
import { credentials } from '@/config/credentials';
```

### Use the Credentials API

```typescript
// Kavita credentials
const url = await credentials.kavita.getServerUrl();
const key = await credentials.kavita.getApiKey();
await credentials.kavita.setApiKey('new-key');

// Audiobookshelf credentials
const url = await credentials.abs.getServerUrl();
const jwt = await credentials.abs.getJwtToken();
await credentials.abs.setUsername('user');

// Google Books API key
const apiKey = await credentials.googleBooks.getApiKey();
await credentials.googleBooks.setApiKey('new-key');
```

## Environment Variables

These environment variables are checked first, before falling back to local storage:

| Service | Variable | Purpose |
|---------|----------|---------|
| Kavita | `EXPO_PUBLIC_KAVITA_URL` | Server URL |
| Kavita | `EXPO_PUBLIC_KAVITA_API_KEY` | API key |
| ABS | `EXPO_PUBLIC_ABS_URL` | Server URL |
| ABS | `EXPO_PUBLIC_ABS_TOKEN` | API key/token |
| ABS | `EXPO_PUBLIC_ABS_USERNAME` | JWT username |
| ABS | `EXPO_PUBLIC_ABS_PASSWORD` | JWT password |
| Google Books | `EXPO_PUBLIC_GOOGLE_BOOKS_API_KEY` | API key |

## Migration Guide

### Old Pattern (❌ Don't use)

```typescript
import { storage } from './storage';

const STORAGE_KEYS = {
  SERVER_URL: 'folio_kavita_server_url',
  API_KEY: 'folio_kavita_api_key',
};

// Getting values
const url = await storage.getItem(STORAGE_KEYS.SERVER_URL);
const key = await storage.getItem(STORAGE_KEYS.API_KEY);

// Setting values
await storage.setItem(STORAGE_KEYS.SERVER_URL, url);
await storage.setItem(STORAGE_KEYS.API_KEY, key);

// Environment fallback
const envUrl = process.env.EXPO_PUBLIC_KAVITA_URL || '';
```

### New Pattern (✅ Use this)

```typescript
import { credentials } from '@/config/credentials';

// Getting values (checks ENV first, then storage)
const url = await credentials.kavita.getServerUrl();
const key = await credentials.kavita.getApiKey();

// Setting values
await credentials.kavita.setServerUrl(url);
await credentials.kavita.setApiKey(key);

// All-in-one clear
await credentials.kavita.clearAll();
```

## Services Updated

The following services have been migrated to use the unified credentials API:

- ✅ `services/kavitaAPI.ts`
- ✅ `services/audiobookshelfAPI.ts`
- ✅ `services/GoogleBooksSearchProvider.ts`

## Profile Support

For multi-profile support:

```typescript
import { getActiveProfile, setActiveProfile } from '@/config/credentials';

// Set active profile
await setActiveProfile('profile-123');

// Get active profile
const profileId = await getActiveProfile();

// JWT tokens are automatically scoped to the active profile
const jwt = await credentials.kavita.getJwtToken(); // Returns profile-specific token
```

## Adding New Credentials

To add a new credential type:

1. Add storage keys to `STORAGE_KEYS` in `/config/credentials.ts`
2. Add environment variable name to `ENV_VARS`
3. Add getter/setter methods to the appropriate credentials namespace
4. Update the service to use the new credentials API

Example:

```typescript
// In /config/credentials.ts
export const STORAGE_KEYS = {
  ...existing keys...
  NEW_SERVICE: {
    SERVER_URL: 'folio_new_service_server_url',
    API_KEY: 'folio_new_service_api_key',
  },
};

export const ENV_VARS = {
  ...existing vars...
  NEW_SERVICE: {
    URL: 'EXPO_PUBLIC_NEW_SERVICE_URL',
    API_KEY: 'EXPO_PUBLIC_NEW_SERVICE_API_KEY',
  },
};

export const credentials = {
  ...existing namespaces...
  newService: {
    async getServerUrl(): Promise<string | null> {
      return getEnv(ENV_VARS.NEW_SERVICE.URL) || 
             await storage.getItem(STORAGE_KEYS.NEW_SERVICE.SERVER_URL);
    },
    async setServerUrl(url: string): Promise<void> {
      await storage.setItem(STORAGE_KEYS.NEW_SERVICE.SERVER_URL, url);
    },
    // ... etc
  },
};
```
