import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TabHeader from '../../components/TabHeader';
import { StatsDashboard } from '../../components/StatsDashboard';
import { useProfile, PROFILE_COLORS, Profile } from '../../contexts/ProfileContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Typography, Spacing, Radius } from '../../constants/theme';

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
      resolve(null);
      return;
    }
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
          console.error('[Profile] Image compression failed:', err);
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

export default function ProfileScreen() {
  const { colors } = useTheme();
  const { activeProfile, profiles, updateProfile, selectProfile } = useProfile();
  
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [switchModalVisible, setSwitchModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editAvatar, setEditAvatar] = useState<string | null>(null);

  const openEditModal = () => {
    if (!activeProfile) return;
    setEditName(activeProfile.name);
    setEditColor(activeProfile.color);
    setEditAvatar(activeProfile.avatar || null);
    setEditModalVisible(true);
  };

  const saveProfile = async () => {
    if (!activeProfile || !editName.trim()) return;
    await updateProfile(activeProfile.id, {
      name: editName.trim(),
      color: editColor,
      avatar: editAvatar || undefined,
    });
    setEditModalVisible(false);
  };

  const handlePickAvatar = async () => {
    const image = await pickImage();
    if (image) setEditAvatar(image);
  };

  const switchToProfile = async (profile: Profile) => {
    await selectProfile(profile.id);
    setSwitchModalVisible(false);
  };

  if (!activeProfile) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <Text style={{ color: colors.textSecondary }}>No profile selected</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TabHeader title="Profile" />
      
      {/* Profile Header Card */}
      <View style={{
        backgroundColor: colors.surface,
        margin: Spacing.md,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
      }}>
        {/* Avatar */}
        <TouchableOpacity onPress={openEditModal} activeOpacity={0.8}>
          {activeProfile.avatar ? (
            <Image
              source={{ uri: activeProfile.avatar }}
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: colors.surfaceElevated,
              }}
            />
          ) : (
            <View style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: activeProfile.color,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#fff' }}>
                {activeProfile.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            backgroundColor: colors.accent,
            borderRadius: 10,
            padding: 2,
          }}>
            <Ionicons name="camera" size={12} color="#fff" />
          </View>
        </TouchableOpacity>

        {/* Profile Info */}
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: Typography.xl,
            fontWeight: Typography.bold,
            color: colors.textPrimary,
          }}>
            {activeProfile.name}
          </Text>
          <Text style={{
            fontSize: Typography.sm,
            color: colors.textSecondary,
            marginTop: 2,
          }}>
            Tap to edit profile
          </Text>
        </View>

        {/* Switch Button */}
        <TouchableOpacity
          onPress={() => setSwitchModalVisible(true)}
          style={{
            padding: Spacing.sm,
            backgroundColor: colors.surfaceElevated,
            borderRadius: Radius.md,
          }}
        >
          <Ionicons name="swap-horizontal" size={24} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* Stats Dashboard */}
      <StatsDashboard />

      {/* Edit Profile Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: Spacing.lg,
        }}>
          <View style={{
            backgroundColor: colors.background,
            borderRadius: Radius.lg,
            padding: Spacing.lg,
            width: '100%',
            maxWidth: 400,
          }}>
            <Text style={{
              fontSize: Typography.xl,
              fontWeight: Typography.bold,
              color: colors.textPrimary,
              marginBottom: Spacing.lg,
            }}>
              Edit Profile
            </Text>

            {/* Avatar Section */}
            <TouchableOpacity onPress={handlePickAvatar} style={{ alignSelf: 'center', marginBottom: Spacing.lg }}>
              {editAvatar ? (
                <Image
                  source={{ uri: editAvatar }}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: colors.surfaceElevated,
                  }}
                />
              ) : (
                <View style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: editColor,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#fff' }}>
                    {editName.charAt(0).toUpperCase() || '?'}
                  </Text>
                </View>
              )}
              <View style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                backgroundColor: colors.accent,
                borderRadius: 12,
                padding: 4,
              }}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            </TouchableOpacity>

            {/* Name Input */}
            <Text style={{ fontSize: Typography.sm, color: colors.textMuted, marginBottom: Spacing.xs }}>
              Profile Name
            </Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              style={{
                backgroundColor: colors.surface,
                borderRadius: Radius.md,
                padding: Spacing.md,
                color: colors.textPrimary,
                fontSize: Typography.base,
                marginBottom: Spacing.md,
              }}
              placeholderTextColor={colors.textMuted}
            />

            {/* Color Selection */}
            <Text style={{ fontSize: Typography.sm, color: colors.textMuted, marginBottom: Spacing.xs }}>
              Profile Color
            </Text>
            <View style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: Spacing.sm,
              marginBottom: Spacing.lg,
            }}>
              {PROFILE_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  onPress={() => setEditColor(color)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: color,
                    borderWidth: editColor === color ? 3 : 0,
                    borderColor: colors.textPrimary,
                  }}
                />
              ))}
            </View>

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: Spacing.md }}>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                style={{
                  flex: 1,
                  padding: Spacing.md,
                  borderRadius: Radius.md,
                  backgroundColor: colors.surfaceElevated,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.textPrimary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveProfile}
                style={{
                  flex: 1,
                  padding: Spacing.md,
                  borderRadius: Radius.md,
                  backgroundColor: colors.accent,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.textOnAccent, fontWeight: Typography.semibold }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Switch Profile Modal */}
      <Modal
        visible={switchModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSwitchModalVisible(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: Spacing.lg,
        }}>
          <View style={{
            backgroundColor: colors.background,
            borderRadius: Radius.lg,
            padding: Spacing.lg,
            width: '100%',
            maxWidth: 400,
          }}>
            <Text style={{
              fontSize: Typography.xl,
              fontWeight: Typography.bold,
              color: colors.textPrimary,
              marginBottom: Spacing.lg,
            }}>
              Switch Profile
            </Text>

            <ScrollView style={{ maxHeight: 300 }}>
              {profiles.map((profile) => (
                <TouchableOpacity
                  key={profile.id}
                  onPress={() => switchToProfile(profile)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: Spacing.md,
                    backgroundColor: profile.id === activeProfile.id ? colors.accent + '20' : colors.surface,
                    borderRadius: Radius.md,
                    marginBottom: Spacing.sm,
                  }}
                >
                  {profile.avatar ? (
                    <Image source={{ uri: profile.avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                  ) : (
                    <View style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: profile.color,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                      <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#fff' }}>
                        {profile.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={{
                    flex: 1,
                    marginLeft: Spacing.md,
                    fontSize: Typography.base,
                    color: colors.textPrimary,
                    fontWeight: profile.id === activeProfile.id ? Typography.semibold : Typography.regular,
                  }}>
                    {profile.name}
                    {profile.id === activeProfile.id && ' (Active)'}
                  </Text>
                  {profile.id === activeProfile.id && (
                    <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setSwitchModalVisible(false)}
              style={{
                marginTop: Spacing.lg,
                padding: Spacing.md,
                borderRadius: Radius.md,
                backgroundColor: colors.surfaceElevated,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.textPrimary }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

