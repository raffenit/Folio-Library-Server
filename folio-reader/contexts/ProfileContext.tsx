import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { storage } from '../services/storage';
import { autoBackup } from '../services/backup';

const PROFILES_KEY = 'folio_profiles_v1';
const ACTIVE_PROFILE_KEY = 'folio_active_profile_id';

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

  // Load profiles on mount
  useEffect(() => {
    loadProfiles();
  }, []);

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
        loadedProfiles = JSON.parse(profilesJson);
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

  const saveProfiles = async (newProfiles: Profile[]) => {
    await storage.setItem(PROFILES_KEY, JSON.stringify(newProfiles));
    setProfiles(newProfiles);
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
    
    // Migrate credentials
    if (legacyKavitaUrl) {
      await storage.setItem(getProfileStorageKey('kavita_url'), legacyKavitaUrl);
    }
    if (legacyKavitaKey) {
      await storage.setItem(getProfileStorageKey('kavita_api_key'), legacyKavitaKey);
    }
    if (legacyAbsUrl) {
      await storage.setItem(getProfileStorageKey('abs_url'), legacyAbsUrl);
    }
    if (legacyAbsToken) {
      await storage.setItem(getProfileStorageKey('abs_token'), legacyAbsToken);
    }
    
    // Clear legacy keys
    await storage.multiRemove([
      'kavita_url', 'kavita_api_key', 'abs_url', 'abs_token',
      'kavita_token', 'kavita_server_url'
    ]);
    
    setHasLegacyData(false);
    return profile;
  }, [createProfile, getProfileStorageKey]);

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
