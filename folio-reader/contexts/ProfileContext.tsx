import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { storage } from '../services/storage';
import { autoBackup } from '../services/backup';
import { Platform } from 'react-native';

const PROFILES_KEY = 'folio_profiles_v1';
const ACTIVE_PROFILE_KEY = 'folio_active_profile_id';
const DEVICE_ID_KEY = 'folio_device_id';
const SYNC_SERVER_URL_KEY = 'folio_sync_server_url';
const SYNC_API_KEY_KEY = 'folio_sync_api_key';

// Generate or load device ID
async function getOrCreateDeviceId(): Promise<string> {
  let deviceId = await storage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `${Platform.OS}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await storage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export interface Profile {
  id: string;
  name: string;
  color: string;
  avatar?: string;
  createdAt: number;
}

interface ProfileContextValue {
  profiles: Profile[];
  activeProfile: Profile | null;
  loading: boolean;
  selectProfile: (profileId: string | null) => Promise<void>;
  createProfile: (name: string, color: string, avatar?: string) => Promise<Profile>;
  deleteProfile: (profileId: string) => Promise<void>;
  updateProfile: (profileId: string, updates: Partial<Profile>) => Promise<void>;
  getProfileStorageKey: (key: string) => string;
  hasLegacyData: boolean;
  migrateLegacyData: () => Promise<Profile>;
  // Cloud sync
  syncServerUrl: string | null;
  syncApiKey: string | null;
  setSyncCredentials: (url: string, apiKey: string) => Promise<void>;
  syncProfiles: () => Promise<boolean>;
  lastSyncTime: number | null;
  // Import from cloud (for initial setup on new devices)
  importCloudProfiles: (url: string, apiKey: string) => Promise<{ success: boolean; profiles?: Profile[]; error?: string }>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

const PROFILE_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
];

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLegacyData, setHasLegacyData] = useState(false);
  const [syncServerUrl, setSyncServerUrl] = useState<string | null>(null);
  const [syncApiKey, setSyncApiKey] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  // Load profiles and sync config on mount
  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const [url, key, did] = await Promise.all([
      storage.getItem(SYNC_SERVER_URL_KEY),
      storage.getItem(SYNC_API_KEY_KEY),
      getOrCreateDeviceId(),
    ]);
    setSyncServerUrl(url);
    setSyncApiKey(key);
    setDeviceId(did);
    await loadProfiles();
    // Attempt cloud sync after loading local profiles (non-blocking, with timeout)
    if (url && key && did) {
      const syncWithTimeout = Promise.race([
        syncFromCloud(did, url, key),
        new Promise<boolean>(resolve => setTimeout(() => {
          console.log('[ProfileSync] Startup sync timed out, continuing offline');
          resolve(false);
        }, 5000))
      ]);
      syncWithTimeout.catch(err => {
        console.log('[ProfileSync] Startup sync failed, continuing offline:', err);
      });
    }
  };

  const loadProfiles = async () => {
    try {
      setLoading(true);
      
      // Check for legacy data (pre-profile storage)
      const legacyKavitaUrl = await storage.getItem('kavita_url');
      const legacyAbsUrl = await storage.getItem('abs_url');
      const hasLegacy = !!(legacyKavitaUrl || legacyAbsUrl);
      setHasLegacyData(hasLegacy);
      
      // Load profiles
      const profilesJson = await storage.getItem(PROFILES_KEY);
      let loadedProfiles: Profile[] = [];
      
      if (profilesJson) {
        try {
          loadedProfiles = JSON.parse(profilesJson);
        } catch (parseErr) {
          console.error('[ProfileContext] Error parsing profiles:', parseErr);
        }
      }
      
      setProfiles(loadedProfiles);
      
      // Load active profile if exists
      const activeId = await storage.getItem(ACTIVE_PROFILE_KEY);
      if (activeId) {
        const active = loadedProfiles.find(p => p.id === activeId);
        if (active) {
          setActiveProfile(active);
        }
      }
    } catch (err) {
      console.error('[ProfileContext] Error loading profiles:', err);
    } finally {
      setLoading(false);
    }
  };

  // Cloud sync functions
  const setSyncCredentials = async (url: string, apiKey: string) => {
    console.log('[ProfileContext] Saving sync credentials...', { url, apiKeyPrefix: apiKey.substring(0, 4) + '...' });
    try {
      await storage.setItem(SYNC_SERVER_URL_KEY, url);
      await storage.setItem(SYNC_API_KEY_KEY, apiKey);
      setSyncServerUrl(url);
      setSyncApiKey(apiKey);
      console.log('[ProfileContext] Credentials saved successfully');
      
      // Verify they were saved
      const savedUrl = await storage.getItem(SYNC_SERVER_URL_KEY);
      const savedKey = await storage.getItem(SYNC_API_KEY_KEY);
      console.log('[ProfileContext] Verified saved:', { url: savedUrl, keyPrefix: savedKey?.substring(0, 4) + '...' });
    } catch (err) {
      console.error('[ProfileContext] Failed to save credentials:', err);
      throw err;
    }
  };

  const syncToCloud = async (did: string, url: string, key: string): Promise<boolean> => {
    try {
      // Get global server credentials to sync across devices
      const [kavitaUrl, kavitaKey, absUrl, absToken, activeServerType] = await Promise.all([
        storage.getItem('folio_kavita_server_url'),
        storage.getItem('folio_kavita_api_key'),
        storage.getItem('folio_abs_server_url'),
        storage.getItem('folio_abs_api_key'),
        storage.getItem('folio_active_server_type'),
      ]);
      
      const payload = {
        profiles,
        activeProfileId: activeProfile?.id || null,
        syncedAt: Date.now(),
        // Global server config - shared across all devices
        serverConfig: {
          kavita: { url: kavitaUrl, apiKey: kavitaKey },
          abs: { url: absUrl, apiKey: absToken },
          activeServerType,
        },
      };
      
      const response = await fetch(`${url}/api/profiles/${did}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': key,
        },
        body: JSON.stringify(payload),
      });
      
      if (response.ok) {
        setLastSyncTime(Date.now());
        console.log('[ProfileSync] Uploaded to cloud with server config');
        return true;
      }
      return false;
    } catch (err) {
      console.error('[ProfileSync] Upload failed:', err);
      return false;
    }
  };

  const syncFromCloud = async (did: string, url: string, key: string): Promise<boolean> => {
    try {
      const response = await fetch(`${url}/api/profiles/${did}`, {
        headers: {
          'Authorization': key,
        },
      });
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json();
      if (!data.found || !data.profiles) {
        return false;
      }
      
      // Merge server profiles with local (server wins for conflicts)
      const serverProfiles: Profile[] = data.profiles.profiles || [];
      const serverActiveId = data.profiles.activeProfileId;
      
      if (serverProfiles.length > 0) {
        // Simple merge: use server profiles if they exist
        // Future: could do smarter merge based on timestamps
        await storage.setItem(PROFILES_KEY, JSON.stringify(serverProfiles));
        setProfiles(serverProfiles);
        
        if (serverActiveId) {
          await storage.setItem(ACTIVE_PROFILE_KEY, serverActiveId);
          const active = serverProfiles.find(p => p.id === serverActiveId);
          if (active) {
            setActiveProfile(active);
          }
        }
        
        // Restore global server config if present
        const serverConfig = data.profiles.serverConfig;
        if (serverConfig) {
          console.log('[ProfileSync] Restoring server config from cloud');
          if (serverConfig.kavita?.url) await storage.setItem('folio_kavita_server_url', serverConfig.kavita.url);
          if (serverConfig.kavita?.apiKey) await storage.setItem('folio_kavita_api_key', serverConfig.kavita.apiKey);
          if (serverConfig.abs?.url) await storage.setItem('folio_abs_server_url', serverConfig.abs.url);
          if (serverConfig.abs?.apiKey) await storage.setItem('folio_abs_api_key', serverConfig.abs.apiKey);
          if (serverConfig.activeServerType) await storage.setItem('folio_active_server_type', serverConfig.activeServerType);
        }
        
        setLastSyncTime(Date.now());
        console.log('[ProfileSync] Downloaded from cloud:', serverProfiles.length, 'profiles');
        return true;
      }
      return false;
    } catch (err) {
      console.error('[ProfileSync] Download failed:', err);
      return false;
    }
  };

  const syncProfiles = async (): Promise<boolean> => {
    if (!deviceId || !syncServerUrl || !syncApiKey) {
      console.log('[ProfileSync] No credentials configured');
      return false;
    }
    // Upload current state
    return syncToCloud(deviceId, syncServerUrl, syncApiKey);
  };

  const saveProfiles = async (newProfiles: Profile[]) => {
    await storage.setItem(PROFILES_KEY, JSON.stringify(newProfiles));
    setProfiles(newProfiles);
    // Auto-sync to cloud if configured
    if (deviceId && syncServerUrl && syncApiKey) {
      syncToCloud(deviceId, syncServerUrl, syncApiKey).catch(console.error);
    }
    // Trigger auto-backup check after profile changes
    await autoBackup();
  };

  const selectProfile = useCallback(async (profileId: string | null, profilesList?: Profile[]) => {
    // Use provided profiles list (for when called with fresh data) or fall back to state
    const searchList = profilesList || profiles;
    if (profileId) {
      const profile = searchList.find(p => p.id === profileId);
      if (profile) {
        setActiveProfile(profile);
        await storage.setItem(ACTIVE_PROFILE_KEY, profileId);
        
        // Set global for API services to use profile-scoped storage
        if (typeof window !== 'undefined') {
          (window as any).__ACTIVE_PROFILE_ID = profileId;
        }
      }
    } else {
      setActiveProfile(null);
      await storage.deleteItem(ACTIVE_PROFILE_KEY);
      
      // Clear global
      if (typeof window !== 'undefined') {
        (window as any).__ACTIVE_PROFILE_ID = null;
      }
    }
  }, [profiles]);

  const createProfile = useCallback(async (name: string, color: string, avatar?: string): Promise<Profile> => {
    const newProfile: Profile = {
      id: `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      color,
      createdAt: Date.now(),
    };
    if (avatar) {
      newProfile.avatar = avatar;
    }
    
    const updatedProfiles = [...profiles, newProfile];
    await saveProfiles(updatedProfiles);
    
    // Always auto-select the newly created profile (pass updated list to avoid stale closure)
    await selectProfile(newProfile.id, updatedProfiles);
    
    return newProfile;
  }, [profiles, selectProfile]);

  const deleteProfile = useCallback(async (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;
    
    // Remove all profile-scoped data
    const allKeys = await storage.getAllKeys();
    const profileKeys = allKeys.filter(key => key.startsWith(`folio_${profileId}_`));
    await storage.multiRemove(profileKeys);
    
    // Remove from profiles list
    const updatedProfiles = profiles.filter(p => p.id !== profileId);
    await saveProfiles(updatedProfiles);
    
    // Clear active profile if it was deleted
    if (activeProfile?.id === profileId) {
      await selectProfile(null);
    }
  }, [profiles, activeProfile, selectProfile]);

  const updateProfile = useCallback(async (profileId: string, updates: Partial<Profile>) => {
    const updatedProfiles = profiles.map(p => 
      p.id === profileId ? { ...p, ...updates } : p
    );
    await saveProfiles(updatedProfiles);
    
    // Update active profile if it's the one being edited
    if (activeProfile?.id === profileId) {
      setActiveProfile({ ...activeProfile, ...updates });
    }
  }, [profiles, activeProfile]);

  // Get storage key scoped to current profile
  const getProfileStorageKey = useCallback((key: string): string => {
    if (!activeProfile) {
      // Fallback to legacy key if no profile selected
      return key;
    }
    return `folio_${activeProfile.id}_${key}`;
  }, [activeProfile]);

  // Migrate legacy data to a new profile
  const migrateLegacyData = useCallback(async (): Promise<Profile> => {
    const legacyKavitaUrl = await storage.getItem('kavita_url');
    const legacyKavitaKey = await storage.getItem('kavita_api_key');
    const legacyAbsUrl = await storage.getItem('abs_url');
    const legacyAbsToken = await storage.getItem('abs_token');
    
    // Create profile from legacy data
    const profile = await createProfile('Default', PROFILE_COLORS[0]);
    
    // Migrate credentials to GLOBAL keys (server credentials are shared across profiles)
    if (legacyKavitaUrl) {
      await storage.setItem('folio_kavita_server_url', legacyKavitaUrl);
    }
    if (legacyKavitaKey) {
      await storage.setItem('folio_kavita_api_key', legacyKavitaKey);
    }
    if (legacyAbsUrl) {
      await storage.setItem('folio_abs_server_url', legacyAbsUrl);
    }
    if (legacyAbsToken) {
      await storage.setItem('folio_abs_api_key', legacyAbsToken);
    }
    
    // Clear legacy keys
    await storage.multiRemove([
      'kavita_url', 'kavita_api_key', 'abs_url', 'abs_token',
      'kavita_token', 'kavita_server_url'
    ]);
    
    setHasLegacyData(false);
    return profile;
  }, [createProfile]);

  // Import profiles from cloud (for setup on new devices)
  const importCloudProfiles = useCallback(async (url: string, apiKey: string): Promise<{ success: boolean; profiles?: Profile[]; error?: string }> => {
    console.log('[importCloudProfiles] Starting with url:', url, 'apiKey:', apiKey ? '[SET]' : '[NULL]');
    try {
      // Get or create device ID
      const did = await getOrCreateDeviceId();
      console.log('[importCloudProfiles] Device ID:', did);
      
      // Fetch profiles from cloud
      const fetchUrl = `${url}/api/profiles/${did}`;
      console.log('[importCloudProfiles] Fetching:', fetchUrl);
      const response = await fetch(fetchUrl, {
        headers: {
          'Authorization': apiKey,
        },
      });
      
      console.log('[importCloudProfiles] Response status:', response.status);
      
      if (!response.ok) {
        console.log('[importCloudProfiles] Response not ok:', response.status);
        if (response.status === 404) {
          return { success: false, error: 'No profiles found on server. Create a profile first on another device.' };
        }
        return { success: false, error: `Server error: ${response.status}` };
      }
      
      const data = await response.json();
      if (!data.found || !data.profiles || !data.profiles.profiles || data.profiles.profiles.length === 0) {
        return { success: false, error: 'No profiles found on server.' };
      }
      
      const serverProfiles: Profile[] = data.profiles.profiles;
      const serverActiveId = data.profiles.activeProfileId;
      
      // Save profiles locally
      await storage.setItem(PROFILES_KEY, JSON.stringify(serverProfiles));
      setProfiles(serverProfiles);
      
      // Save sync credentials for future syncs
      await storage.setItem(SYNC_SERVER_URL_KEY, url);
      await storage.setItem(SYNC_API_KEY_KEY, apiKey);
      setSyncServerUrl(url);
      setSyncApiKey(apiKey);
      
      // Restore global server config if present
      const serverConfig = data.profiles.serverConfig;
      if (serverConfig) {
        console.log('[importCloudProfiles] Restoring server config');
        if (serverConfig.kavita?.url) await storage.setItem('folio_kavita_server_url', serverConfig.kavita.url);
        if (serverConfig.kavita?.apiKey) await storage.setItem('folio_kavita_api_key', serverConfig.kavita.apiKey);
        if (serverConfig.abs?.url) await storage.setItem('folio_abs_server_url', serverConfig.abs.url);
        if (serverConfig.abs?.apiKey) await storage.setItem('folio_abs_api_key', serverConfig.abs.apiKey);
        if (serverConfig.activeServerType) await storage.setItem('folio_active_server_type', serverConfig.activeServerType);
      }
      
      // Set active profile if server had one
      if (serverActiveId) {
        await storage.setItem(ACTIVE_PROFILE_KEY, serverActiveId);
        const active = serverProfiles.find(p => p.id === serverActiveId);
        if (active) {
          setActiveProfile(active);
        }
      }
      
      setLastSyncTime(Date.now());
      console.log('[ProfileSync] Imported from cloud:', serverProfiles.length, 'profiles');
      
      return { success: true, profiles: serverProfiles };
    } catch (err: any) {
      console.error('[ProfileSync] Import failed:', err);
      return { success: false, error: err.message || 'Failed to connect to server' };
    }
  }, []);

  const value: ProfileContextValue = {
    profiles,
    activeProfile,
    loading,
    selectProfile,
    createProfile,
    deleteProfile,
    updateProfile,
    getProfileStorageKey,
    hasLegacyData,
    migrateLegacyData,
    syncServerUrl,
    syncApiKey,
    setSyncCredentials,
    syncProfiles,
    lastSyncTime,
    importCloudProfiles,
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within ProfileProvider');
  }
  return context;
}

export { PROFILE_COLORS };
