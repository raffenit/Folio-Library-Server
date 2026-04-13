import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Profile, PROFILE_COLORS, useProfile } from '../contexts/ProfileContext';
import { Typography, Spacing, Radius, Colors } from '../constants/theme';

// Helper to compress and resize image before storing
const compressImage = (dataUrl: string, maxWidth: number = 200, quality: number = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Calculate new dimensions while maintaining aspect ratio
      let width = img.naturalWidth;
      let height = img.naturalHeight;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to compressed JPEG
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
};

// Helper to handle image file selection and convert to base64
const pickImage = (): Promise<string | null> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'web') {
      // Native platforms - use a simpler approach or alert
      resolve(null);
      return;
    }

    // Web: Create file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          // Compress the image before returning
          const compressed = await compressImage(reader.result as string, 200, 0.7);
          resolve(compressed);
        } catch (err) {
          console.error('[ProfileSelector] Image compression failed:', err);
          // Fall back to original if compression fails
          resolve(reader.result as string);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.click();
  });
};

interface ProfileSelectorProps {
  onSelectProfile: (profile: Profile) => void;
  onAddProfile?: () => void;
}

export function ProfileSelector({ onSelectProfile, onAddProfile }: ProfileSelectorProps) {
  const { profiles, loading, hasLegacyData, migrateLegacyData, createProfile, selectProfile, updateProfile, deleteProfile, importCloudProfiles, syncApiKey, syncServerUrl } = useProfile();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PROFILE_COLORS[0]);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(PROFILE_COLORS[0]);

  // Avatar state
  const [newAvatar, setNewAvatar] = useState<string | null>(null);
  const [editAvatar, setEditAvatar] = useState<string | null>(null);

  // Cloud import state
  const [showCloudModal, setShowCloudModal] = useState(false);
  const [cloudUrl, setCloudUrl] = useState('');
  const [cloudApiKey, setCloudApiKey] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedProfiles, setImportedProfiles] = useState<Profile[] | null>(null);

  // Debug: log credential changes
  useEffect(() => {
    console.log('[ProfileSelector] Credentials updated:', { 
      syncServerUrl, 
      syncApiKey: syncApiKey ? '[SET length:' + syncApiKey.length + ']' : '[NULL]',
      loading 
    });
  }, [syncServerUrl, syncApiKey, loading]);

  const handleLegacyMigration = async () => {
    const profile = await migrateLegacyData();
    onSelectProfile(profile);
  };

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) return;
    console.log('[ProfileSelector] Creating profile...');
    const profile = await createProfile(newProfileName.trim(), selectedColor, newAvatar || undefined);
    console.log('[ProfileSelector] Profile created:', profile.id);
    setShowAddModal(false);
    setNewProfileName('');
    setNewAvatar(null);
    console.log('[ProfileSelector] Calling onSelectProfile');
    onSelectProfile(profile);
    console.log('[ProfileSelector] onSelectProfile called');
  };

  const handleSelectProfile = async (profile: Profile) => {
    await selectProfile(profile.id);
    onSelectProfile(profile);
  };

  const openEditModal = (profile: Profile) => {
    setEditingProfile(profile);
    setEditName(profile.name);
    setEditColor(profile.color);
    setEditAvatar(profile.avatar || null);
    setShowEditModal(true);
  };

  const handlePickAvatar = async (isEdit: boolean) => {
    const image = await pickImage();
    if (image) {
      if (isEdit) {
        setEditAvatar(image);
      } else {
        setNewAvatar(image);
      }
    }
  };

  const handleEditProfile = async () => {
    if (!editingProfile || !editName.trim()) return;
    const updates: Partial<Profile> = {
      name: editName.trim(),
      color: editColor,
    };
    if (editAvatar !== undefined) {
      updates.avatar = editAvatar || undefined;
    }
    await updateProfile(editingProfile.id, updates);
    setShowEditModal(false);
    setEditingProfile(null);
    setEditAvatar(null);
  };

  const handleDeleteProfile = async (profile: Profile) => {
    if (confirm(`Delete profile "${profile.name}"? This will remove all profile data.`)) {
      await deleteProfile(profile.id);
    }
  };

  const handleCloudImport = async () => {
    if (!cloudUrl.trim() || !cloudApiKey.trim()) return;
    
    setImportLoading(true);
    setImportError(null);
    
    const result = await importCloudProfiles(cloudUrl.trim(), cloudApiKey.trim());
    
    setImportLoading(false);
    
    if (result.success && result.profiles && result.profiles.length > 0) {
      setImportedProfiles(result.profiles);
    } else {
      setImportError(result.error || 'Failed to import profiles');
    }
  };

  const handleSelectImportedProfile = async (profile: Profile) => {
    await selectProfile(profile.id);
    onSelectProfile(profile);
    setShowCloudModal(false);
    setImportedProfiles(null);
    setCloudUrl('');
    setCloudApiKey('');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // If there's legacy data, show migration option
  if (hasLegacyData && profiles.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Welcome Back!</Text>
        <Text style={styles.subtitle}>Migrate your existing data to a profile?</Text>
        <TouchableOpacity style={styles.migrateButton} onPress={handleLegacyMigration}>
          <Text style={styles.migrateButtonText}>Continue with Existing Data</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.startFreshButton} 
          onPress={() => setShowAddModal(true)}
        >
          <Text style={styles.startFreshText}>Start Fresh (Create New Profile)</Text>
        </TouchableOpacity>

        {/* Add Profile Modal for fresh start */}
        <AddProfileModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          onCreate={handleCreateProfile}
          name={newProfileName}
          setName={setNewProfileName}
          color={selectedColor}
          setColor={setSelectedColor}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Who's reading?</Text>
      
      <ScrollView contentContainerStyle={styles.profilesGrid}>
        {profiles.map((profile) => (
          <View key={profile.id} style={styles.profileCard}>
            <TouchableOpacity
              onPress={() => handleSelectProfile(profile)}
              activeOpacity={0.8}
            >
              <View style={[styles.avatar, { backgroundColor: profile.color }]}>
                {profile.avatar ? (
                  <Image source={{ uri: profile.avatar }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>
                    {profile.name.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <Text style={styles.profileName} numberOfLines={1}>
                {profile.name}
              </Text>
            </TouchableOpacity>
            {/* Action Buttons */}
            <View style={styles.profileActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => openEditModal(profile)}
              >
                <Ionicons name="pencil" size={14} color="#999" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleDeleteProfile(profile)}
              >
                <Ionicons name="trash" size={14} color="#999" />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Add Profile Button */}
        <TouchableOpacity
          style={styles.addProfileCard}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.8}
        >
          <View style={styles.addAvatar}>
            <Ionicons name="add" size={40} color="#666" />
          </View>
          <Text style={styles.addProfileText}>Add Profile</Text>
        </TouchableOpacity>

        {/* Load from Cloud Button - shown when no profiles exist */}
        {profiles.length === 0 && (
          <TouchableOpacity
            style={styles.cloudProfileCard}
            onPress={() => {
              // Pre-fill with stored credentials if available
              console.log('[ProfileSelector] Opening cloud modal, stored credentials:', { 
                syncServerUrl, 
                syncApiKey: syncApiKey ? '[SET length:' + syncApiKey.length + ']' : '[NULL]' 
              });
              setCloudUrl(syncServerUrl || '');
              setCloudApiKey(syncApiKey || '');
              console.log('[ProfileSelector] Pre-filled cloud inputs');
              setShowCloudModal(true);
            }}
            activeOpacity={0.8}
          >
            <View style={styles.cloudAvatar}>
              <Ionicons name="cloud-download" size={32} color={Colors.accent} />
            </View>
            <Text style={styles.cloudProfileText}>Load from Cloud</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Add Profile Modal */}
      <AddProfileModal
        visible={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setNewProfileName('');
          setNewAvatar(null);
        }}
        onCreate={handleCreateProfile}
        name={newProfileName}
        setName={setNewProfileName}
        color={selectedColor}
        setColor={setSelectedColor}
        avatar={newAvatar}
        onPickAvatar={() => handlePickAvatar(false)}
        onClearAvatar={() => setNewAvatar(null)}
      />

      {/* Edit Profile Modal */}
      <AddProfileModal
        visible={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingProfile(null);
          setEditAvatar(null);
        }}
        onCreate={handleEditProfile}
        name={editName}
        setName={setEditName}
        color={editColor}
        setColor={setEditColor}
        avatar={editAvatar}
        onPickAvatar={() => handlePickAvatar(true)}
        onClearAvatar={() => setEditAvatar(null)}
        title="Edit Profile"
        confirmText="Save"
      />

      {/* Cloud Import Modal */}
      <CloudImportModal
        visible={showCloudModal}
        onClose={() => {
          setShowCloudModal(false);
          setImportedProfiles(null);
          setImportError(null);
          setCloudUrl('');
          setCloudApiKey('');
        }}
        onImport={handleCloudImport}
        url={cloudUrl}
        setUrl={setCloudUrl}
        apiKey={cloudApiKey}
        setApiKey={setCloudApiKey}
        loading={importLoading}
        error={importError}
        importedProfiles={importedProfiles}
        onSelectProfile={handleSelectImportedProfile}
      />
    </View>
  );
}

interface CloudImportModalProps {
  visible: boolean;
  onClose: () => void;
  onImport: () => void;
  url: string;
  setUrl: (url: string) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  loading: boolean;
  error: string | null;
  importedProfiles: Profile[] | null;
  onSelectProfile: (profile: Profile) => void;
}

function CloudImportModal({
  visible,
  onClose,
  onImport,
  url,
  setUrl,
  apiKey,
  setApiKey,
  loading,
  error,
  importedProfiles,
  onSelectProfile,
}: CloudImportModalProps) {
  const [discovering, setDiscovering] = useState(false);

  // Debug: log received props
  console.log('[CloudImportModal] Rendered with:', { 
    visible, 
    url, 
    apiKey: apiKey ? '[SET length:' + apiKey.length + ']' : '[NULL]' 
  });

  // Auto-discover server URL from well-known endpoints
  useEffect(() => {
    if (!visible || url) return;
    
    const discoverServer = async () => {
      setDiscovering(true);
      
      // Try common local network patterns
      const candidates = [
        'http://localhost:9000',
        'http://127.0.0.1:9000',
        typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
          ? `http://${window.location.hostname}:9000` 
          : null,
      ].filter(Boolean) as string[];
      
      for (const candidate of candidates) {
        try {
          const response = await fetch(`${candidate}/api/config`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000),
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.syncServerUrl) {
              setUrl(data.syncServerUrl);
              console.log('[CloudImport] Auto-discovered server:', data.syncServerUrl);
              break;
            } else if (data.hasAutoDiscovery) {
              setUrl(candidate);
              console.log('[CloudImport] Using discovered server:', candidate);
              break;
            }
          }
        } catch (e) {
          // Try next candidate
        }
      }
      
      setDiscovering(false);
    };
    
    discoverServer();
  }, [visible, url, setUrl]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {!importedProfiles ? (
            <>
              <Text style={styles.modalTitle}>Load from Cloud</Text>
              <Text style={styles.subtitle}>
                Enter your cloud sync server details to import profiles.
              </Text>

              <TextInput
                style={[styles.nameInput, discovering && { borderColor: Colors.accent, borderWidth: 1 }]}
                placeholder={discovering ? "Discovering server..." : "Server URL (e.g., http://your-server:9000)"}
                placeholderTextColor="#999"
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!discovering}
              />
              {url && (
                <Text style={{ color: Colors.accent, fontSize: Typography.xs, marginBottom: Spacing.md }}>
                  ✓ Server URL {discovering ? 'found' : 'configured'}
                </Text>
              )}

              <TextInput
                style={styles.nameInput}
                placeholder="API Key"
                placeholderTextColor="#999"
                value={apiKey}
                onChangeText={setApiKey}
                secureTextEntry
                autoCapitalize="none"
              />

              {error && (
                <Text style={{ color: '#FF6B6B', marginBottom: Spacing.md, fontSize: Typography.sm }}>
                  {error}
                </Text>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.createButton, (!url.trim() || !apiKey.trim() || loading) && styles.createButtonDisabled]}
                  onPress={onImport}
                  disabled={!url.trim() || !apiKey.trim() || loading}
                >
                  {loading ? (
                    <Text style={styles.createButtonText}>Loading...</Text>
                  ) : (
                    <Text style={styles.createButtonText}>Import</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.modalTitle}>Select Profile</Text>
              <Text style={styles.subtitle}>
                Choose a profile to use on this device:
              </Text>

              <ScrollView style={{ maxHeight: 300, marginBottom: Spacing.lg }}>
                {importedProfiles.map((profile) => (
                  <TouchableOpacity
                    key={profile.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: Spacing.md,
                      marginBottom: Spacing.sm,
                      backgroundColor: '#2a2a2a',
                      borderRadius: Radius.md,
                    }}
                    onPress={() => onSelectProfile(profile)}
                  >
                    <View style={[styles.avatar, { backgroundColor: profile.color, width: 40, height: 40 }]}>
                      {profile.avatar ? (
                        <Image source={{ uri: profile.avatar }} style={{ width: 40, height: 40, borderRadius: 8 }} />
                      ) : (
                        <Text style={[styles.avatarText, { fontSize: 20 }]}>
                          {profile.name.charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <Text style={{ marginLeft: Spacing.md, color: '#fff', fontSize: Typography.md }}>
                      {profile.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

interface AddProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onCreate: () => void;
  name: string;
  setName: (name: string) => void;
  color: string;
  setColor: (color: string) => void;
  avatar?: string | null;
  onPickAvatar?: () => void;
  onClearAvatar?: () => void;
  title?: string;
  confirmText?: string;
}

function AddProfileModal({
  visible,
  onClose,
  onCreate,
  name,
  setName,
  color,
  setColor,
  avatar,
  onPickAvatar,
  onClearAvatar,
  title = "Add Profile",
  confirmText = "Create",
}: AddProfileModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>

          {/* Avatar Preview & Upload */}
          <View style={styles.avatarPreviewContainer}>
            <View style={[styles.avatarPreview, { backgroundColor: color }]}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatarPreviewImage} />
              ) : (
                <Text style={styles.avatarPreviewText}>
                  {name.charAt(0).toUpperCase() || '?'}
                </Text>
              )}
            </View>
            <View style={styles.avatarActions}>
              <TouchableOpacity style={styles.avatarButton} onPress={onPickAvatar}>
                <Ionicons name="camera" size={16} color="#fff" />
                <Text style={styles.avatarButtonText}>Upload Photo</Text>
              </TouchableOpacity>
              {avatar && (
                <TouchableOpacity style={styles.avatarClearButton} onPress={onClearAvatar}>
                  <Ionicons name="close" size={16} color="#999" />
                  <Text style={styles.avatarClearText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <TextInput
            style={styles.nameInput}
            placeholder="Profile name"
            placeholderTextColor="#999"
            value={name}
            onChangeText={setName}
            maxLength={20}
            autoFocus
          />

          <Text style={styles.colorLabel}>Choose a color:</Text>
          <View style={styles.colorGrid}>
            {PROFILE_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.colorOption,
                  { backgroundColor: c },
                  color === c && styles.selectedColor,
                ]}
                onPress={() => setColor(c)}
              />
            ))}
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createButton, !name.trim() && styles.createButtonDisabled]}
              onPress={onCreate}
              disabled={!name.trim()}
            >
              <Text style={styles.createButtonText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  title: {
    fontSize: Typography.xxl,
    fontWeight: '600',
    color: '#fff',
    marginBottom: Spacing.xl * 2,
    fontFamily: Typography.serif,
  },
  subtitle: {
    fontSize: Typography.md,
    color: '#999',
    marginBottom: Spacing.xl,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: Typography.lg,
    color: '#999',
  },
  profilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.xl,
    paddingVertical: Spacing.xl,
  },
  profileCard: {
    alignItems: 'center',
    width: 100,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  avatarPreviewContainer: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  avatarPreview: {
    width: 100,
    height: 100,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  avatarPreviewImage: {
    width: 100,
    height: 100,
  },
  avatarPreviewText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  avatarActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  avatarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
  },
  avatarButtonText: {
    color: '#fff',
    fontSize: Typography.sm,
    fontWeight: '600',
  },
  avatarClearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  avatarClearText: {
    color: '#999',
    fontSize: Typography.sm,
  },
  profileName: {
    fontSize: Typography.sm,
    color: '#999',
    textAlign: 'center',
  },
  profileActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  actionButton: {
    padding: Spacing.xs,
    borderRadius: Radius.sm,
    backgroundColor: '#1a1a1a',
  },
  addProfileCard: {
    alignItems: 'center',
    width: 100,
  },
  addAvatar: {
    width: 80,
    height: 80,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  addProfileText: {
    fontSize: Typography.sm,
    color: '#666',
    textAlign: 'center',
  },
  migrateButton: {
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  migrateButtonText: {
    color: '#fff',
    fontSize: Typography.md,
    fontWeight: '600',
  },
  startFreshButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  startFreshText: {
    color: '#666',
    fontSize: Typography.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: Typography.xl,
    fontWeight: '600',
    color: '#fff',
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  nameInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: '#fff',
    fontSize: Typography.md,
    marginBottom: Spacing.lg,
  },
  colorLabel: {
    fontSize: Typography.sm,
    color: '#999',
    marginBottom: Spacing.md,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
  },
  selectedColor: {
    borderWidth: 3,
    borderColor: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.md,
  },
  cancelButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  cancelButtonText: {
    color: '#999',
    fontSize: Typography.md,
  },
  createButton: {
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: '#fff',
    fontSize: Typography.md,
    fontWeight: '600',
  },
  cloudProfileCard: {
    alignItems: 'center',
    width: 100,
  },
  cloudAvatar: {
    width: 80,
    height: 80,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: Colors.accent,
    borderStyle: 'dashed',
  },
  cloudProfileText: {
    fontSize: Typography.sm,
    color: Colors.accent,
    textAlign: 'center',
  },
});
